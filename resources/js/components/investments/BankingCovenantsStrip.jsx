import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    Landmark,
    ShieldCheck,
    AlertTriangle,
    XCircle,
    CheckCircle2,
    Sliders,
    ChevronDown,
    ChevronUp,
    RefreshCw,
    Activity,
    Info,
    Percent,
    Gauge,
    DollarSign,
    Filter,
    Calendar,
    Minus,
    ArrowUpRight,
    ArrowDownRight,
    TrendingUp
} from 'lucide-react';
import { useInvestmentProject } from '../../context/InvestmentProjectContext';
import { getInvestmentWorkerClient } from '../../workers/InvestmentWorkerClient';
import { calculateBankingCovenants } from '../../workers/financialCalculations';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

export const COVENANT_PRESETS = {
    standard: {
        id: 'standard',
        name: 'Standard LMA (1.20x)',
        description: 'Standardowe wytyczne rynkowe dla długu Senior Debt (DSCR 1.20x, ICR 2.50x, Leverage 3.50x)',
        thresholds: {
            minDscr: 1.20,
            minLlcr: 1.35,
            minIcr: 2.50,
            maxLeverage: 3.50,
            minCurrentRatio: 1.10,
            minDsrfMonths: 6,
        },
    },
    conservative: {
        id: 'conservative',
        name: 'Konsorcjum Konserwatywne (1.30x)',
        description: 'Zaostrzone wymogi komitetu ryzyka dla projektów infrastrukturalnych o podwyższonej zmienności',
        thresholds: {
            minDscr: 1.30,
            minLlcr: 1.45,
            minIcr: 3.00,
            maxLeverage: 3.00,
            minCurrentRatio: 1.20,
            minDsrfMonths: 9,
        },
    },
    aggressive: {
        id: 'aggressive',
        name: 'Elastyczny / Leveraged (1.15x)',
        description: 'Maksymalizacja dźwigni finansowej przy minimalnym buforze gotówkowym',
        thresholds: {
            minDscr: 1.15,
            minLlcr: 1.25,
            minIcr: 2.00,
            maxLeverage: 4.50,
            minCurrentRatio: 1.05,
            minDsrfMonths: 3,
        },
    },
};

export function BankingCovenantsStrip({
    project: propProject,
    simulationData: propSimulationData,
    defaultExpanded = false,
    className = ''
}) {
    const { selectedProject: contextProject } = useInvestmentProject();
    const activeProject = propProject || contextProject;

    // Simulation Data state (if not passed as prop)
    const [fetchedData, setFetchedData] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (propSimulationData) return;
        if (!activeProject) {
            setFetchedData(null);
            return;
        }

        let isMounted = true;
        setLoading(true);

        const client = getInvestmentWorkerClient();
        const activeAssumptions = activeProject.operating_assumptions;

        client.simulate(activeProject, activeAssumptions, null, 15)
            .then((res) => {
                if (isMounted) {
                    setFetchedData(res);
                    setLoading(false);
                }
            })
            .catch((err) => {
                console.error('[BankingCovenantsStrip] Simulation error:', err);
                if (isMounted) setLoading(false);
            });

        return () => {
            isMounted = false;
        };
    }, [activeProject, propSimulationData]);

    const activeSimulationData = propSimulationData || fetchedData;

    // Component State
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);
    const [activeTab, setActiveTab] = useState('matrix'); // 'matrix' | 'config' | 'headroom'
    const [filter, setFilter] = useState('all'); // 'all' | 'debt_only' | 'breaches_only'
    const [activePreset, setActivePreset] = useState('standard');
    const [scale, setScale] = useState('thousands'); // 'full' | 'thousands' | 'millions'

    // Thresholds State
    const [thresholds, setThresholds] = useState(COVENANT_PRESETS.standard.thresholds);

    const currency = activeProject?.currency || 'PLN';

    // Covenants Calculation
    const covenantsResult = useMemo(() => {
        if (!activeSimulationData?.annualPeriods?.length) return null;

        return calculateBankingCovenants(
            activeSimulationData.annualPeriods,
            thresholds,
            currency
        );
    }, [activeSimulationData, thresholds, currency]);

    // Handle Preset Switch
    const applyPreset = useCallback((presetKey) => {
        if (COVENANT_PRESETS[presetKey]) {
            setActivePreset(presetKey);
            setThresholds(COVENANT_PRESETS[presetKey].thresholds);
        }
    }, []);

    // Custom threshold change
    const updateThreshold = useCallback((field, value) => {
        setActivePreset('custom');
        setThresholds(prev => ({
            ...prev,
            [field]: Number(value)
        }));
    }, []);

    // Currency Formatter
    const formatAmount = useCallback((val, isRatio = false, isPercent = false) => {
        if (val === null || val === undefined || isNaN(Number(val))) {
            return '—';
        }
        const num = Number(val);
        if (isRatio) {
            return `${num.toFixed(2)}x`;
        }
        if (isPercent) {
            return `${num >= 0 ? '+' : ''}${num.toFixed(1)}%`;
        }

        let scaled = num;
        let suffix = '';
        if (scale === 'thousands') {
            scaled = num / 1_000;
            suffix = ' tys.';
        } else if (scale === 'millions') {
            scaled = num / 1_000_000;
            suffix = ' mln';
        }

        const formatted = new Intl.NumberFormat('pl-PL', {
            minimumFractionDigits: scale === 'full' ? 0 : 1,
            maximumFractionDigits: scale === 'full' ? 0 : 1,
        }).format(scaled);

        return `${formatted}${suffix} ${currency}`;
    }, [scale, currency]);

    if (!activeProject) {
        return (
            <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-500 font-mono text-center">
                Brak aktywnego projektu do audytu kowenantów bankowych.
            </div>
        );
    }

    // Continue rendering shell while worker simulates in background

    const summary = covenantsResult?.summary;
    const yearlyMetrics = covenantsResult?.yearlyMetrics || [];

    // Filtered Metrics for Table
    const filteredMetrics = yearlyMetrics.filter(m => {
        if (filter === 'debt_only') return m.hasDebtService;
        if (filter === 'breaches_only') return !m.isCompliant || m.dscrStatus === 'warning';
        return true;
    });

    // Overall Status Badges
    const renderBankabilityBadge = () => {
        if (!summary) return null;
        if (summary.bankabilityStatus === 'compliant') {
            return (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold tracking-wider">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    PROJEKT BANKOWALNY (LMA)
                </span>
            );
        }
        if (summary.bankabilityStatus === 'warning') {
            return (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[11px] font-bold tracking-wider">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                    TIGHT MARGIN (BUFOR &lt; 10%)
                </span>
            );
        }
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[11px] font-bold tracking-wider">
                <XCircle className="w-3.5 h-3.5 text-rose-400" />
                NARUSZENIE KOWENANTU ({summary.totalBreachesCount})
            </span>
        );
    };

    return (
        <div data-testid="banking-covenants-strip" className={`bg-zinc-900/90 border border-zinc-800 rounded-xl overflow-hidden shadow-xl ${className}`}>
            {/* Header Strip Bar */}
            <div className="p-4 bg-zinc-950/60 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center border ${
                        summary?.bankabilityStatus === 'compliant'
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                            : summary?.bankabilityStatus === 'warning'
                            ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                            : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                    }`}>
                        <Landmark className="w-4 h-4" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-sm tracking-wide text-zinc-100 uppercase">
                                KOWENANTY BANKOWE & TEST BANKOWALNOŚCI (15 LAT)
                            </span>
                            {renderBankabilityBadge()}
                        </div>
                        <p className="text-xs text-zinc-400 mt-0.5">
                            {summary?.isBankable
                                ? `Wszystkie roczne okresy spłaty spełniają wymogi minimalnego pokrycia długu (${thresholds.minDscr.toFixed(2)}x) • 0 naruszeń`
                                : `Wykryto ${summary?.totalBreachesCount ?? 0} naruszeń wskaźników bankowych w horyzoncie 15 lat (wąskie gardło: Rok ${summary?.pinchYear ?? '—'})`
                            }
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Preset Switcher */}
                    <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-lg p-0.5 text-[11px]">
                        <button
                            type="button"
                            onClick={() => applyPreset('standard')}
                            className={`px-2.5 py-1 rounded transition-colors ${
                                activePreset === 'standard'
                                    ? 'bg-zinc-800 text-emerald-400 font-semibold shadow-sm'
                                    : 'text-zinc-400 hover:text-zinc-200'
                            }`}
                        >
                            Standard (1.20x)
                        </button>
                        <button
                            type="button"
                            onClick={() => applyPreset('conservative')}
                            className={`px-2.5 py-1 rounded transition-colors ${
                                activePreset === 'conservative'
                                    ? 'bg-zinc-800 text-amber-400 font-semibold shadow-sm'
                                    : 'text-zinc-400 hover:text-zinc-200'
                            }`}
                        >
                            Konserwatywny (1.30x)
                        </button>
                        {activePreset === 'custom' && (
                            <span className="px-2 py-1 text-cyan-400 font-semibold">
                                Indywidualny
                            </span>
                        )}
                    </div>

                    {/* Scale switcher */}
                    <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-lg p-0.5 text-[11px]">
                        <button
                            type="button"
                            onClick={() => setScale('thousands')}
                            className={`px-2 py-1 rounded ${scale === 'thousands' ? 'bg-zinc-800 text-zinc-100 font-semibold' : 'text-zinc-400'}`}
                        >
                            tys.
                        </button>
                        <button
                            type="button"
                            onClick={() => setScale('millions')}
                            className={`px-2 py-1 rounded ${scale === 'millions' ? 'bg-zinc-800 text-zinc-100 font-semibold' : 'text-zinc-400'}`}
                        >
                            mln
                        </button>
                        <button
                            type="button"
                            onClick={() => setScale('full')}
                            className={`px-2 py-1 rounded ${scale === 'full' ? 'bg-zinc-800 text-zinc-100 font-semibold' : 'text-zinc-400'}`}
                        >
                            pełne
                        </button>
                    </div>

                    {/* Toggle expand/collapse button */}
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="text-xs flex items-center gap-1.5 border-zinc-700 bg-zinc-800/80 hover:bg-zinc-700"
                    >
                        {isExpanded ? (
                            <>
                                <span>Ukryj audyt</span>
                                <ChevronUp className="w-3.5 h-3.5" />
                            </>
                        ) : (
                            <>
                                <span>Szczegóły kowenantów (15L)</span>
                                <ChevronDown className="w-3.5 h-3.5" />
                            </>
                        )}
                    </Button>
                </div>
            </div>

            {/* Key Metric Tiles Strip */}
            <div className="p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 bg-zinc-900/40">
                {/* 1. DSCR Tile */}
                <div className={`p-3 rounded-lg border flex flex-col justify-between ${
                    summary?.minDscr != null && summary.minDscr >= thresholds.minDscr
                        ? 'bg-zinc-950/70 border-zinc-800'
                        : 'bg-rose-950/20 border-rose-800/40'
                }`}>
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                            KOWENANT DSCR
                        </span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            summary?.minDscr != null && summary.minDscr >= thresholds.minDscr
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : 'bg-rose-500/20 text-rose-400'
                        }`}>
                            {summary?.minDscr != null && summary.minDscr >= thresholds.minDscr ? 'ZGODNY' : 'NARUSZENIE'}
                        </span>
                    </div>
                    <div className="my-1.5">
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-xl font-bold font-mono tabular-nums text-zinc-100">
                                {summary?.minDscr != null ? `${summary.minDscr.toFixed(2)}x` : '—'}
                            </span>
                            <span className="text-[11px] text-zinc-400 font-mono">
                                (śr. {summary?.avgDscr != null ? `${summary.avgDscr.toFixed(2)}x` : '—'})
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-1 border-t border-zinc-800/50">
                        <span>Wymóg: <strong className="text-zinc-200">≥ {thresholds.minDscr.toFixed(2)}x</strong></span>
                        {summary?.pinchHeadroomPercent != null && (
                            <span className={`font-mono text-[10px] font-semibold ${
                                summary.pinchHeadroomPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'
                            }`}>
                                {summary.pinchHeadroomPercent >= 0 ? '+' : ''}{summary.pinchHeadroomPercent.toFixed(1)}% bufor
                            </span>
                        )}
                    </div>
                </div>

                {/* 2. ICR Tile */}
                <div className={`p-3 rounded-lg border flex flex-col justify-between ${
                    summary?.minIcr != null && summary.minIcr >= thresholds.minIcr
                        ? 'bg-zinc-950/70 border-zinc-800'
                        : 'bg-rose-950/20 border-rose-800/40'
                }`}>
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                            POKRYCIE ODSETEK (ICR)
                        </span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            summary?.minIcr != null && summary.minIcr >= thresholds.minIcr
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : 'bg-rose-500/20 text-rose-400'
                        }`}>
                            {summary?.minIcr != null && summary.minIcr >= thresholds.minIcr ? 'BEZPIECZNY' : 'RYZYKO'}
                        </span>
                    </div>
                    <div className="my-1.5">
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-xl font-bold font-mono tabular-nums text-zinc-100">
                                {summary?.minIcr != null ? `${summary.minIcr.toFixed(2)}x` : '—'}
                            </span>
                            <span className="text-[11px] text-zinc-400 font-mono">
                                (śr. {summary?.avgIcr != null ? `${summary.avgIcr.toFixed(2)}x` : '—'})
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-1 border-t border-zinc-800/50">
                        <span>Wymóg: <strong className="text-zinc-200">≥ {thresholds.minIcr.toFixed(2)}x</strong></span>
                        <span className="text-[10px] text-zinc-500">EBIT / Odsetki</span>
                    </div>
                </div>

                {/* 3. Current Ratio Tile */}
                <div className={`p-3 rounded-lg border flex flex-col justify-between ${
                    summary?.minCurrentRatio != null && summary.minCurrentRatio >= thresholds.minCurrentRatio
                        ? 'bg-zinc-950/70 border-zinc-800'
                        : 'bg-rose-950/20 border-rose-800/40'
                }`}>
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                            PŁYNNOŚĆ BIEŻĄCA (CR)
                        </span>
                        <span className="text-[10px] font-mono text-zinc-400">
                            Aktywa / Zob.
                        </span>
                    </div>
                    <div className="my-1.5">
                        <div className="flex items-baseline gap-1.5">
                            <span className={`text-xl font-bold font-mono tabular-nums ${
                                summary?.minCurrentRatio != null
                                    ? summary.minCurrentRatio >= thresholds.minCurrentRatio
                                        ? 'text-zinc-100'
                                        : 'text-rose-400'
                                    : 'text-zinc-100'
                            }`}>
                                {summary?.minCurrentRatio != null
                                    ? summary.minCurrentRatio < 0
                                        ? '0.00x'
                                        : `${summary.minCurrentRatio.toFixed(2)}x`
                                    : '—'}
                            </span>
                            <span className="text-[11px] text-zinc-400 font-mono">
                                {summary?.minCurrentRatio != null && summary.minCurrentRatio < 0 ? (
                                    <span className="text-rose-400 font-semibold">(Deficyt NWC)</span>
                                ) : (
                                    `(śr. ${summary?.avgCurrentRatio != null ? (summary.avgCurrentRatio < 0 ? '0.00x' : `${summary.avgCurrentRatio.toFixed(2)}x`) : '—'})`
                                )}
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-1 border-t border-zinc-800/50">
                        <span>Wymóg: <strong className="text-zinc-200">≥ {thresholds.minCurrentRatio.toFixed(2)}x</strong></span>
                        {summary?.minCurrentRatio != null ? (
                            summary.minCurrentRatio < thresholds.minCurrentRatio ? (
                                <span className="text-[10px] text-rose-400 font-semibold">DEFICYT PŁYNNOŚCI</span>
                            ) : summary.minCurrentRatio < thresholds.minCurrentRatio * 1.10 ? (
                                <span className="text-[10px] text-amber-400 font-semibold">OSTRZEŻENIE</span>
                            ) : (
                                <span className="text-[10px] text-emerald-400 font-semibold">ZGODNY</span>
                            )
                        ) : (
                            <span className="text-[10px] text-zinc-500">—</span>
                        )}
                    </div>
                </div>

                {/* 4. Peak Leverage (Net Debt / EBITDA) Tile */}
                <div className={`p-3 rounded-lg border flex flex-col justify-between ${
                    summary?.peakLeverage != null && summary.peakLeverage <= thresholds.maxLeverage
                        ? 'bg-zinc-950/70 border-zinc-800'
                        : 'bg-amber-950/20 border-amber-800/40'
                }`}>
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                            DŹWIGNIA (NET DEBT/EBITDA)
                        </span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            summary?.peakLeverage != null && summary.peakLeverage <= thresholds.maxLeverage
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : 'bg-amber-500/20 text-amber-400'
                        }`}>
                            {summary?.peakLeverage != null && summary.peakLeverage <= thresholds.maxLeverage ? 'KONTROLA' : 'WYSOKA'}
                        </span>
                    </div>
                    <div className="my-1.5">
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-xl font-bold font-mono tabular-nums text-zinc-100">
                                {summary?.peakLeverage != null ? `${summary.peakLeverage.toFixed(2)}x` : '0.00x'}
                            </span>
                            <span className="text-[11px] text-zinc-400 font-mono">
                                (szczyt)
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-1 border-t border-zinc-800/50">
                        <span>Limit: <strong className="text-zinc-200">≤ {thresholds.maxLeverage.toFixed(2)}x</strong></span>
                        <span className="text-[10px] text-zinc-500">Delewaraging</span>
                    </div>
                </div>

                {/* 5. DSRF Coverage Tile */}
                <div className={`p-3 rounded-lg border flex flex-col justify-between ${
                    summary?.minDsrfMonths != null && summary.minDsrfMonths >= thresholds.minDsrfMonths
                        ? 'bg-zinc-950/70 border-zinc-800'
                        : 'bg-rose-950/20 border-rose-800/40'
                }`}>
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                            REZERWA DSRF
                        </span>
                        <span className="text-[10px] font-mono text-zinc-400">
                            Gotówka / Rata
                        </span>
                    </div>
                    <div className="my-1.5">
                        <div className="flex items-baseline gap-1.5">
                            <span className={`text-xl font-bold font-mono tabular-nums ${
                                summary?.minDsrfMonths != null
                                    ? summary.minDsrfMonths >= thresholds.minDsrfMonths
                                        ? 'text-emerald-400'
                                        : 'text-rose-400'
                                    : 'text-zinc-100'
                            }`}>
                                {summary?.minDsrfMonths != null
                                    ? summary.minDsrfMonths < 0
                                        ? '0.0 m.'
                                        : `${summary.minDsrfMonths.toFixed(1)} m.`
                                    : '—'}
                            </span>
                            <span className="text-[11px] text-zinc-400 font-mono">
                                {summary?.minDsrfMonths != null && summary.minDsrfMonths < 0 ? (
                                    <span className="text-rose-400 font-semibold">(Luka gotówkowa)</span>
                                ) : (
                                    '(min. bufor)'
                                )}
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-1 border-t border-zinc-800/50">
                        <span>Wymóg: <strong className="text-zinc-200">≥ {thresholds.minDsrfMonths} mies.</strong></span>
                        {summary?.minDsrfMonths != null ? (
                            summary.minDsrfMonths < thresholds.minDsrfMonths ? (
                                <span className="text-[10px] text-rose-400 font-semibold">BRAK REZERWY</span>
                            ) : summary.minDsrfMonths < thresholds.minDsrfMonths * 1.25 ? (
                                <span className="text-[10px] text-amber-400 font-semibold">NISKI BUFOR</span>
                            ) : (
                                <span className="text-[10px] text-emerald-400 font-semibold">ZABEZPIECZONE</span>
                            )
                        ) : (
                            <span className="text-[10px] text-zinc-500">—</span>
                        )}
                    </div>
                </div>

                {/* 6. LLCR Tile */}
                <div className={`p-3 rounded-lg border flex flex-col justify-between ${
                    summary?.minLlcr != null && summary.minLlcr >= thresholds.minLlcr
                        ? "bg-zinc-950/70 border-zinc-800"
                        : "bg-rose-950/20 border-rose-800/40"
                }`}>
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                            POKRYCIE CAŁEGO DŁUGU (LLCR)
                        </span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            summary?.minLlcr != null && summary.minLlcr >= thresholds.minLlcr
                                ? "bg-emerald-500/20 text-emerald-400"
                                : summary?.minLlcr != null && summary.minLlcr >= thresholds.minLlcr * 0.90
                                ? "bg-amber-500/20 text-amber-400"
                                : "bg-rose-500/20 text-rose-400"
                        }`}>
                            {summary?.minLlcr != null && summary.minLlcr >= thresholds.minLlcr
                                ? "ZGODNY"
                                : summary?.minLlcr != null && summary.minLlcr >= thresholds.minLlcr * 0.90
                                ? "OSTRZEŻENIE"
                                : "NARUSZENIE"}
                        </span>
                    </div>
                    <div className="my-1.5">
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-xl font-bold font-mono tabular-nums text-zinc-100">
                                {summary?.minLlcr != null ? (summary.minLlcr < 0 ? "0.00x" : `${summary.minLlcr.toFixed(2)}x`) : "—"}
                            </span>
                            <span className="text-[11px] text-zinc-400 font-mono">
                                (śr. {summary?.avgLlcr != null ? (summary.avgLlcr < 0 ? "0.00x" : `${summary.avgLlcr.toFixed(2)}x`) : "—"})
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-1 border-t border-zinc-800/50">
                        <span>Wymóg: <strong className="text-zinc-200">≥ {(thresholds.minLlcr ?? 1.35).toFixed(2)}x</strong></span>
                        <span className="text-[10px] text-zinc-500">NPV CFADS / Dług</span>
                    </div>
                </div>
            </div>

            {/* Expanded Detailed Audit Section */}
            {isExpanded && (
                <div className="border-t border-zinc-800 p-4 space-y-4 bg-zinc-950/40">
                    {/* Navigation Sub-Tabs */}
                    <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setActiveTab('matrix')}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                                    activeTab === 'matrix'
                                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                        : 'text-zinc-400 hover:text-zinc-200'
                                }`}
                            >
                                1. Roczna Matryca Kowenantów (15L)
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('config')}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                                    activeTab === 'config'
                                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                        : 'text-zinc-400 hover:text-zinc-200'
                                }`}
                            >
                                2. Konfigurator Wymogów Banku (Stress)
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('headroom')}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                                    activeTab === 'headroom'
                                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                        : 'text-zinc-400 hover:text-zinc-200'
                                }`}
                            >
                                3. Wąskie Gardło & Analiza Buforu
                            </button>
                        </div>

                        {activeTab === 'matrix' && (
                            <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-lg p-0.5 text-[11px]">
                                <span className="text-zinc-500 px-2 flex items-center gap-1">
                                    <Filter className="w-3 h-3" /> Filtr:
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setFilter('all')}
                                    className={`px-2 py-0.5 rounded ${filter === 'all' ? 'bg-zinc-800 text-zinc-100 font-semibold' : 'text-zinc-400'}`}
                                >
                                    Wszystkie (15L)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFilter('debt_only')}
                                    className={`px-2 py-0.5 rounded ${filter === 'debt_only' ? 'bg-zinc-800 text-zinc-100 font-semibold' : 'text-zinc-400'}`}
                                >
                                    Lata z długiem
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFilter('breaches_only')}
                                    className={`px-2 py-0.5 rounded ${filter === 'breaches_only' ? 'bg-zinc-800 text-rose-400 font-semibold' : 'text-zinc-400'}`}
                                >
                                    Ryzyko / Naruszenia
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Sub-Tab 1: Roczna Matryca Kowenantów (15L) */}
                    {activeTab === 'matrix' && (
                        <div className="space-y-3">
                            <div className="overflow-x-auto border border-zinc-800 rounded-lg">
                                <table className="w-full text-xs font-mono text-left">
                                    <thead className="bg-zinc-900/90 text-zinc-400 border-b border-zinc-800 text-[11px] uppercase tracking-wider">
                                        <tr>
                                            <th className="py-2.5 px-3">Okres</th>
                                            <th className="py-2.5 px-3 text-right">EBITDA</th>
                                            <th className="py-2.5 px-3 text-right">CFADS</th>
                                            <th className="py-2.5 px-3 text-right">Obsługa Długu</th>
                                            <th className="py-2.5 px-3 text-center">DSCR (≥ {thresholds.minDscr.toFixed(2)}x)</th>
                                            <th className="py-2.5 px-3 text-center">LLCR (≥ {(thresholds.minLlcr ?? 1.35).toFixed(2)}x)</th>
                                            <th className="py-2.5 px-3 text-center">ICR (≥ {thresholds.minIcr.toFixed(2)}x)</th>
                                            <th className="py-2.5 px-3 text-center">CR (Płynność)</th>
                                            <th className="py-2.5 px-3 text-center">Dźwignia Net Debt</th>
                                            <th className="py-2.5 px-3 text-center">DSRF (m.)</th>
                                            <th className="py-2.5 px-3 text-center">Zgodność</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-800/60 bg-zinc-950/40">
                                        {filteredMetrics.map((m) => {
                                            const isPinch = m.year === summary?.pinchYear && m.hasDebtService;
                                            return (
                                                <tr
                                                    key={m.year}
                                                    className={`hover:bg-zinc-900/50 transition-colors ${
                                                        isPinch ? 'bg-amber-950/10' : ''
                                                    } ${!m.isCompliant ? 'bg-rose-950/15' : ''}`}
                                                >
                                                    <td className="py-2 px-3 font-semibold text-zinc-200">
                                                        <div className="flex items-center gap-1.5">
                                                            <span>Rok {m.year}</span>
                                                            {isPinch && (
                                                                <span className="text-[9px] px-1 rounded bg-amber-500/20 text-amber-300 font-sans font-bold">
                                                                    WĄSKIE GARDŁO
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="py-2 px-3 text-right tabular-nums text-zinc-300">
                                                        {formatAmount(m.ebitda)}
                                                    </td>
                                                    <td className="py-2 px-3 text-right tabular-nums text-zinc-300">
                                                        {formatAmount(m.cfads)}
                                                    </td>
                                                    <td className="py-2 px-3 text-right tabular-nums text-zinc-300">
                                                        {m.hasDebtService ? formatAmount(m.totalDebtService) : '—'}
                                                    </td>

                                                    {/* DSCR */}
                                                    <td className="py-2 px-3 text-center">
                                                        {m.dscr !== null ? (
                                                            <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                                                                m.dscrStatus === 'compliant'
                                                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                                                    : m.dscrStatus === 'warning'
                                                                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                                                                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                                                            }`}>
                                                                {m.dscr.toFixed(2)}x
                                                            </span>
                                                        ) : (
                                                            <span className="text-zinc-600">—</span>
                                                        )}
                                                    </td>

                                                    {/* LLCR */}
                                                    <td className="py-2 px-3 text-center">
                                                        {m.llcr !== null ? (
                                                            <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                                                                m.llcrStatus === 'compliant'
                                                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                                                    : m.llcrStatus === 'warning'
                                                                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                                                                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                                                            }`}>
                                                                {m.llcr < 0 ? '0.00x' : `${m.llcr.toFixed(2)}x`}
                                                            </span>
                                                        ) : (
                                                            <span className="text-zinc-600">—</span>
                                                        )}
                                                    </td>

                                                    {/* ICR */}
                                                    <td className="py-2 px-3 text-center">
                                                        {m.icr !== null ? (
                                                            <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                                                                m.icrStatus === 'compliant'
                                                                    ? 'text-emerald-400'
                                                                    : m.icrStatus === 'warning'
                                                                    ? 'text-amber-400'
                                                                    : 'text-rose-400'
                                                            }`}>
                                                                {m.icr.toFixed(2)}x
                                                            </span>
                                                        ) : (
                                                            <span className="text-zinc-600">—</span>
                                                        )}
                                                    </td>

                                                    {/* Current Ratio */}
                                                    <td className="py-2 px-3 text-center text-zinc-300 tabular-nums">
                                                        {m.currentRatio !== null ? (
                                                            m.currentRatio < 0 ? (
                                                                <span className="text-rose-400 font-semibold">0.00x</span>
                                                            ) : (
                                                                `${m.currentRatio.toFixed(2)}x`
                                                            )
                                                        ) : '—'}
                                                    </td>

                                                    {/* Net Debt / EBITDA */}
                                                    <td className="py-2 px-3 text-center">
                                                        {m.leverageRatio !== null ? (
                                                            <span className={`tabular-nums ${
                                                                m.leverageRatio > thresholds.maxLeverage
                                                                    ? 'text-rose-400 font-bold'
                                                                    : 'text-zinc-300'
                                                            }`}>
                                                                {m.leverageRatio.toFixed(2)}x
                                                            </span>
                                                        ) : (
                                                            <span className="text-zinc-600">—</span>
                                                        )}
                                                    </td>

                                                    {/* DSRF Months */}
                                                    <td className="py-2 px-3 text-center">
                                                        {m.dsrfMonths !== null ? (
                                                            <span className={`tabular-nums ${
                                                                m.dsrfMonths < thresholds.minDsrfMonths
                                                                    ? 'text-rose-400 font-bold'
                                                                    : 'text-emerald-400'
                                                            }`}>
                                                                {m.dsrfMonths < 0 ? '0.0 m.' : `${m.dsrfMonths.toFixed(1)} m.`}
                                                            </span>
                                                        ) : (
                                                            <span className="text-zinc-600">—</span>
                                                        )}
                                                    </td>

                                                    {/* Status Badge */}
                                                    <td className="py-2 px-3 text-center">
                                                        {m.hasDebtService ? (
                                                            m.isCompliant ? (
                                                                <span className="inline-flex items-center gap-1 text-emerald-400 font-sans font-semibold text-[10px]">
                                                                    <CheckCircle2 className="w-3 h-3" /> Zgodny
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 text-rose-400 font-sans font-bold text-[10px]" title={m.breaches.join(', ')}>
                                                                    <XCircle className="w-3 h-3" /> Naruszenie
                                                                </span>
                                                            )
                                                        ) : (
                                                            <span className="text-zinc-500 font-sans text-[10px]">—</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Sub-Tab 2: Konfigurator Wymogów Banku (Stress Sliders) */}
                    {activeTab === 'config' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg space-y-4">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-zinc-200 uppercase tracking-wide">
                                        Progi Ostrożnościowe Komitetu Kredytowego
                                    </span>
                                    <Button
                                        variant="secondary"
                                        size="xs"
                                        onClick={() => applyPreset('standard')}
                                        className="text-[10px]"
                                    >
                                        Przywróć standardy LMA
                                    </Button>
                                </div>

                                {/* Slider 1: Min DSCR */}
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-zinc-400">Minimalny Wymóg DSCR (CFADS / Obsługa Długu)</span>
                                        <span className="font-mono font-bold text-emerald-400">{thresholds.minDscr.toFixed(2)}x</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="1.00"
                                        max="1.60"
                                        step="0.05"
                                        value={thresholds.minDscr}
                                        onChange={(e) => updateThreshold('minDscr', e.target.value)}
                                        className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                                    />
                                    <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                                        <span>1.00x (Granica defaultu)</span>
                                        <span>1.20x (Standard)</span>
                                        <span>1.60x (Super-konserwatywny)</span>
                                    </div>
                                </div>

                                {/* Slider: Min LLCR */}
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-zinc-400">Minimalne Pokrycie Całego Długu (LLCR = NPV CFADS / Dług)</span>
                                        <span className="font-mono font-bold text-emerald-400">{(thresholds.minLlcr ?? 1.35).toFixed(2)}x</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="1.00"
                                        max="2.00"
                                        step="0.05"
                                        value={thresholds.minLlcr ?? 1.35}
                                        onChange={(e) => updateThreshold('minLlcr', e.target.value)}
                                        className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                                    />
                                    <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                                        <span>1.10x (Ryzykowny)</span>
                                        <span>1.35x (Standard LMA)</span>
                                        <span>1.60x (Konserwatywny)</span>
                                    </div>
                                </div>

                                {/* Slider 2: Min ICR */}
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-zinc-400">Minimalne Pokrycie Odsetek (ICR = EBIT / Odsetki)</span>
                                        <span className="font-mono font-bold text-emerald-400">{thresholds.minIcr.toFixed(2)}x</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="1.50"
                                        max="4.00"
                                        step="0.25"
                                        value={thresholds.minIcr}
                                        onChange={(e) => updateThreshold('minIcr', e.target.value)}
                                        className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                                    />
                                </div>

                                {/* Slider 3: Max Net Debt / EBITDA */}
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-zinc-400">Maksymalna Dopuszczalna Dźwignia (Net Debt / EBITDA)</span>
                                        <span className="font-mono font-bold text-emerald-400">{thresholds.maxLeverage.toFixed(2)}x</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="2.00"
                                        max="6.00"
                                        step="0.25"
                                        value={thresholds.maxLeverage}
                                        onChange={(e) => updateThreshold('maxLeverage', e.target.value)}
                                        className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                                    />
                                </div>
                            </div>

                            <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg space-y-4">
                                <span className="text-xs font-bold text-zinc-200 uppercase tracking-wide block">
                                    Wymogi Płynnościowe & Rezerw
                                </span>

                                {/* Slider 4: Min Current Ratio */}
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-zinc-400">Minimalny Wskaźnik Płynności Bieżącej (Current Ratio)</span>
                                        <span className="font-mono font-bold text-emerald-400">{thresholds.minCurrentRatio.toFixed(2)}x</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="1.00"
                                        max="2.00"
                                        step="0.05"
                                        value={thresholds.minCurrentRatio}
                                        onChange={(e) => updateThreshold('minCurrentRatio', e.target.value)}
                                        className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                                    />
                                </div>

                                {/* Slider 5: Min DSRF Months */}
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-zinc-400">Wymagana Rezerwa Obsługi Długu (DSRF w miesiącach)</span>
                                        <span className="font-mono font-bold text-emerald-400">{thresholds.minDsrfMonths} mies.</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="3"
                                        max="12"
                                        step="1"
                                        value={thresholds.minDsrfMonths}
                                        onChange={(e) => updateThreshold('minDsrfMonths', e.target.value)}
                                        className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                                    />
                                    <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                                        <span>3 mies. (Minimalny)</span>
                                        <span>6 mies. (Standard LMA)</span>
                                        <span>12 mies. (Infrastruktura krytyczna)</span>
                                    </div>
                                </div>

                                <div className="p-3 bg-zinc-950/60 rounded border border-zinc-800 text-[11px] text-zinc-400 space-y-1">
                                    <span className="font-semibold text-zinc-200 block">Wpływ na Bankowalność:</span>
                                    <p>
                                        Modyfikacja progów pozwala audytorowi i analitykowi ryzyka sprawdzić, jak zachowa się projekt przy ostrzejszych warunkach finansowania konsorcjalnego.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Sub-Tab 3: Wąskie Gardło & Analiza Buforu (Headroom) */}
                    {activeTab === 'headroom' && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Card 1: Pinch Year */}
                            <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-zinc-200 uppercase">
                                        Rok Wąskiego Gardła (Pinch Year)
                                    </span>
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300">
                                        ROK {summary?.pinchYear ?? '—'}
                                    </span>
                                </div>
                                <p className="text-xs text-zinc-400">
                                    Rok, w którym wskaźnik DSCR osiąga minimum w całym okresie spłaty długu:
                                </p>
                                <div className="p-3 bg-zinc-950 rounded border border-zinc-800">
                                    <div className="flex justify-between text-xs text-zinc-400">
                                        <span>Min DSCR w Roku {summary?.pinchYear ?? '—'}:</span>
                                        <span className="font-mono font-bold text-zinc-100">{summary?.pinchDscr ? `${summary.pinchDscr.toFixed(2)}x` : '—'}</span>
                                    </div>
                                    <div className="flex justify-between text-xs text-zinc-400 mt-1">
                                        <span>Margines do progu ({thresholds.minDscr.toFixed(2)}x):</span>
                                        <span className={`font-mono font-bold ${
                                            (summary?.pinchHeadroomPercent ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                                        }`}>
                                            {(summary?.pinchHeadroomPercent ?? 0) >= 0 ? '+' : ''}{summary?.pinchHeadroomPercent?.toFixed(1) ?? '—'}%
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Card 2: Stress Cushion */}
                            <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg space-y-2">
                                <span className="text-xs font-bold text-zinc-200 uppercase block">
                                    Odporność na Spadek Przychodów
                                </span>
                                <p className="text-xs text-zinc-400">
                                    Maksymalny dopuszczalny spadek CFADS w roku wąskiego gardła przed naruszeniem kowenantu:
                                </p>
                                <div className="p-3 bg-zinc-950 rounded border border-zinc-800 text-center">
                                    <span className="text-2xl font-bold font-mono text-emerald-400">
                                        {summary?.pinchHeadroomPercent != null && summary.pinchHeadroomPercent >= 0
                                            ? `${summary.pinchHeadroomPercent.toFixed(1)}%`
                                            : '0.0% (Naruszenie)'
                                        }
                                    </span>
                                    <p className="text-[10px] text-zinc-500 mt-1">
                                        Bufor bezpieczeństwa dla komitetu kredytowego
                                    </p>
                                </div>
                            </div>

                            {/* Card 3: Recommendations */}
                            <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg space-y-2">
                                <span className="text-xs font-bold text-zinc-200 uppercase block">
                                    Rekomendacje Strukturyzacji
                                </span>
                                <ul className="text-[11px] text-zinc-400 space-y-1.5 list-disc list-inside">
                                    {summary?.isBankable ? (
                                        <>
                                            <li className="text-emerald-400">Struktura długu w pełni bankowalna wg standardów LMA.</li>
                                            <li>Możliwe rozważenie lekkiego zwiększenia lewarowania lub skrócenia spłaty.</li>
                                            <li>Bufor gotówkowy DSRF zabezpiecza ponad 6 miesięcy obsługi zadłużenia.</li>
                                        </>
                                    ) : (
                                        <>
                                            <li className="text-rose-400 font-bold">Wymagana restrukturyzacja harmonogramu spłat długu.</li>
                                            <li>Rekomendacja: wydłużenie karencji w spłacie kapitału o 12 miesięcy.</li>
                                            <li>Alternatywa: przejście z rat równych na profil dopasowany do CFADS.</li>
                                        </>
                                    )}
                                </ul>
                            </div>
                            {/* Deal Advisory: Equity Cure Simulator OR LMA Bankability Certificate */}
                            <div className="md:col-span-3">
                                {covenantsResult?.equityCure?.isCureNeeded ? (
                                    <div className="p-4 bg-rose-950/20 border border-rose-800/40 rounded-lg space-y-4">
                                        <div className="flex items-center justify-between border-b border-rose-800/30 pb-3">
                                            <div className="flex items-center gap-2">
                                                <AlertTriangle className="w-5 h-5 text-rose-400" />
                                                <div>
                                                    <h4 className="text-sm font-bold text-zinc-100 uppercase tracking-wide">
                                                        Deal Advisory: Pakiet Naprawczy (Equity Cure Simulator)
                                                    </h4>
                                                    <p className="text-xs text-zinc-400">
                                                        Symulacja minimalnego zastrzyku kapitałowego wymaganego do przywrócenia pełnej bankowalności projektu (LMA Standard)
                                                    </p>
                                                </div>
                                            </div>
                                            <span className="px-2.5 py-1 rounded text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                                EQUITY CURE WYMAGANE
                                            </span>
                                        </div>

                                        {/* 3 Metric Cards for Equity Cure */}
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                            <div className="p-3 bg-zinc-950/80 rounded border border-rose-900/40">
                                                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                                                    Łączny Wymóg Dokapitalizowania
                                                </span>
                                                <span className="text-xl font-bold font-mono text-rose-400 mt-1 block">
                                                    {formatAmount(covenantsResult.equityCure.totalEquityCureRequired)}
                                                </span>
                                                <span className="text-[10px] text-zinc-500">Skumulowana kwota wsparcia w horyzoncie 15L</span>
                                            </div>

                                            <div className="p-3 bg-zinc-950/80 rounded border border-rose-900/40">
                                                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                                                    Szczytowy Roczny Zastrzyk
                                                </span>
                                                <span className="text-xl font-bold font-mono text-amber-400 mt-1 block">
                                                    {formatAmount(covenantsResult.equityCure.peakAnnualCure)}
                                                </span>
                                                <span className="text-[10px] text-zinc-500">Maksymalny pojedynczy transfer kapitału</span>
                                            </div>

                                            <div className="p-3 bg-zinc-950/80 rounded border border-rose-900/40">
                                                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                                                    Lata z Deficytem Kowenantowym
                                                </span>
                                                <span className="text-xl font-bold font-mono text-zinc-100 mt-1 block">
                                                    {covenantsResult.equityCure.curesByYear.length} {covenantsResult.equityCure.curesByYear.length === 1 ? 'rok' : 'lata'}
                                                </span>
                                                <span className="text-[10px] text-zinc-500">
                                                    {covenantsResult.equityCure.curesByYear.map(c => `Rok ${c.year}`).join(', ') || 'Brak'}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Schedule of Required Cures Table */}
                                        <div className="overflow-x-auto border border-zinc-800 rounded-lg">
                                            <table className="w-full text-xs font-mono text-left">
                                                <thead className="bg-zinc-900/90 text-zinc-400 border-b border-zinc-800 text-[11px] uppercase tracking-wider">
                                                    <tr>
                                                        <th className="py-2 px-3">Rok</th>
                                                        <th className="py-2 px-3 text-right">Wymagane Dokapitalizowanie</th>
                                                        <th className="py-2 px-3">Główny Powód Deficytu</th>
                                                        <th className="py-2 px-3">Naruszone Wymogi</th>
                                                        <th className="py-2 px-3">Sugerowany Instrument Naprawczy</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-zinc-800/60 bg-zinc-950/40">
                                                    {covenantsResult.equityCure.curesByYear.map((c) => (
                                                        <tr key={c.year} className="hover:bg-zinc-900/50">
                                                            <td className="py-2 px-3 font-bold text-zinc-200">Rok {c.year}</td>
                                                            <td className="py-2 px-3 text-right font-bold text-rose-400 tabular-nums">
                                                                {formatAmount(c.cureAmount)}
                                                            </td>
                                                            <td className="py-2 px-3 text-zinc-300 font-sans">{c.primaryDriver}</td>
                                                            <td className="py-2 px-3 font-sans">
                                                                <div className="flex flex-wrap gap-1">
                                                                    {c.covenantBreaches.map((b, i) => (
                                                                        <span key={i} className="px-1.5 py-0.5 rounded text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                                                            {b}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            </td>
                                                            <td className="py-2 px-3 text-zinc-400 font-sans">
                                                                {c.primaryDriver.includes('DSCR') || c.primaryDriver.includes('LLCR')
                                                                    ? 'Pożyczka podporządkowana sponsora (Shareholder Loan)'
                                                                    : c.primaryDriver.includes('CR')
                                                                    ? 'Kredyt obrotowy / Faktoring pomostowy'
                                                                    : 'Akredytywa bankowa (Letter of Credit) na rezerwę DSRA'}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* Actionable Deal Advisory Advice */}
                                        <div className="p-3 bg-zinc-950/60 rounded border border-rose-900/30 text-xs text-zinc-300 space-y-2">
                                            <span className="font-bold text-zinc-100 uppercase tracking-wide block">
                                                Zalecenia Deal Advisory dla Zespołu Transakcyjnego:
                                            </span>
                                            <ul className="space-y-1 list-disc list-inside text-zinc-400 text-[11px]">
                                                {covenantsResult.equityCure.recommendations.map((rec, i) => (
                                                    <li key={i}>{rec}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-4 bg-emerald-950/20 border border-emerald-800/40 rounded-lg space-y-4">
                                        <div className="flex items-center justify-between border-b border-emerald-800/30 pb-3">
                                            <div className="flex items-center gap-2">
                                                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                                                <div>
                                                    <h4 className="text-sm font-bold text-zinc-100 uppercase tracking-wide">
                                                        Certyfikat Bankowalności LMA (Project Bankability Certificate)
                                                    </h4>
                                                    <p className="text-xs text-zinc-400">
                                                        Projekt spełnia wszystkie instytucjonalne wymogi ostrożnościowe Loan Market Association w całym 15-letnim okresie
                                                    </p>
                                                </div>
                                            </div>
                                            <span className="px-2.5 py-1 rounded text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                                                <CheckCircle2 className="w-3.5 h-3.5" />
                                                LMA COMPLIANT
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                                            <div className="p-3 bg-zinc-950/70 rounded border border-emerald-900/30 space-y-1">
                                                <span className="text-[10px] text-zinc-400 uppercase font-bold block">Pokrycie Roczne (DSCR)</span>
                                                <span className="text-emerald-400 font-mono font-bold text-base">
                                                    {summary?.minDscr != null ? `${summary.minDscr.toFixed(2)}x` : '—'}
                                                </span>
                                                <span className="text-[10px] text-zinc-500 block">Wymóg: ≥ {thresholds.minDscr.toFixed(2)}x (Bezpieczny bufor)</span>
                                            </div>
                                            <div className="p-3 bg-zinc-950/70 rounded border border-emerald-900/30 space-y-1">
                                                <span className="text-[10px] text-zinc-400 uppercase font-bold block">Pokrycie Całego Długu (LLCR)</span>
                                                <span className="text-emerald-400 font-mono font-bold text-base">
                                                    {summary?.minLlcr != null ? `${summary.minLlcr.toFixed(2)}x` : '—'}
                                                </span>
                                                <span className="text-[10px] text-zinc-500 block">Wymóg: ≥ {(thresholds.minLlcr ?? 1.35).toFixed(2)}x (Standard LMA)</span>
                                            </div>
                                            <div className="p-3 bg-zinc-950/70 rounded border border-emerald-900/30 space-y-1">
                                                <span className="text-[10px] text-zinc-400 uppercase font-bold block">Rezerwa DSRA / DSRF</span>
                                                <span className="text-emerald-400 font-mono font-bold text-base">
                                                    {summary?.minDsrfMonths != null ? `${summary.minDsrfMonths.toFixed(1)} mies.` : '—'}
                                                </span>
                                                <span className="text-[10px] text-zinc-500 block">Wymóg: ≥ {thresholds.minDsrfMonths} mies. na rachunku escrow</span>
                                            </div>
                                        </div>

                                        <div className="p-3 bg-zinc-950/60 rounded border border-emerald-900/30 text-[11px] text-zinc-300">
                                            <span className="font-semibold text-emerald-400 block mb-1">Opinia Komitetu Kredytowego:</span>
                                            Struktura montażu finansowego i prognozy przepływów pieniężnych (CFADS) wykazują pełną odporność na wahania rynkowe. Nie zidentyfikowano zapotrzebowania na dokapitalizowanie naprawcze (Equity Cure) ani kredyty pomostowe.
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default BankingCovenantsStrip;
