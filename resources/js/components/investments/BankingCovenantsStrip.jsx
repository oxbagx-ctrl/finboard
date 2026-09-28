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
import { Tooltip, InfoTooltip } from '../ui/Tooltip';

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
    const [activePreset, setActivePreset] = useState('standard');
    const [thresholds, setThresholds] = useState(COVENANT_PRESETS.standard.thresholds);
    const [scale, setScale] = useState('thousands'); // 'thousands' | 'millions' | 'full'
    const [filter, setFilter] = useState('all'); // 'all' | 'debt_only' | 'breaches_only'

    // Apply Preset Thresholds
    const applyPreset = useCallback((presetKey) => {
        const preset = COVENANT_PRESETS[presetKey];
        if (preset) {
            setThresholds({ ...preset.thresholds });
            setActivePreset(presetKey);
        }
    }, []);

    // Custom threshold modifier
    const updateThreshold = useCallback((key, value) => {
        setThresholds(prev => ({
            ...prev,
            [key]: parseFloat(value) || 0
        }));
        setActivePreset('custom');
    }, []);

    // Currency
    const currency = activeProject?.currency || 'PLN';

    // Format currency amount based on scale
    const formatAmount = useCallback((val) => {
        if (val === null || val === undefined || isNaN(Number(val))) return '—';
        const num = Number(val);
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
            maximumFractionDigits: scale === 'full' ? 0 : 2,
        }).format(scaled);

        return `${formatted}${suffix} ${currency}`;
    }, [scale, currency]);

    if (!activeProject) {
        return (
            <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs text-zinc-500 dark:text-zinc-400 font-mono text-center shadow-sm">
                Brak aktywnego projektu do audytu kowenantów bankowych.
            </div>
        );
    }

    // Calculate Covenants in Real Time
    const covenantsResult = useMemo(() => {
        if (!activeSimulationData?.annualPeriods?.length) return null;

        const waccPercent = activeSimulationData?.appraisal?.waccPercent ?? 8.50;

        return calculateBankingCovenants(
            activeSimulationData.annualPeriods,
            thresholds,
            waccPercent
        );
    }, [activeSimulationData, thresholds]);

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
                <Tooltip content="Projekt w pełni bankowalny – wszystkie roczne okresy spłaty spełniają wymagane kowenanty LMA.">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold tracking-wider cursor-help">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        PROJEKT BANKOWALNY (LMA)
                    </span>
                </Tooltip>
            );
        }
        if (summary.bankabilityStatus === 'warning') {
            return (
                <Tooltip content="Ostrzeżenie płynnościowe: bufor bezpieczeństwa wskaźnika DSCR w roku wąskiego gardła wynosi poniżej 10%.">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-[11px] font-bold tracking-wider cursor-help">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                        TIGHT MARGIN (BUFOR &lt; 10%)
                    </span>
                </Tooltip>
            );
        }
        return (
            <Tooltip content={`Wykryto ${summary.totalBreachesCount} naruszeń wskaźników bankowych w horyzoncie spłaty – wymagana restrukturyzacja zadłużenia lub dopłata kapitałowa (Equity Cure).`}>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-[11px] font-bold tracking-wider cursor-help">
                    <XCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                    NARUSZENIE KOWENANTU ({summary.totalBreachesCount})
                </span>
            </Tooltip>
        );
    };

    return (
        <div data-testid="banking-covenants-strip" className={`bg-white dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-xl ${className}`}>
            {/* Header Strip Bar */}
            <div className="p-4 bg-zinc-50 dark:bg-zinc-950/60 border-b border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Tooltip content="Audyt bankowalności i wskaźników ostrożnościowych LMA (Loan Market Association) w 15-letnim horyzoncie długu">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center border cursor-help ${
                            summary?.bankabilityStatus === 'compliant'
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                                : summary?.bankabilityStatus === 'warning'
                                ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400'
                                : 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400'
                        }`}>
                            <Landmark className="w-4 h-4" />
                        </div>
                    </Tooltip>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-sm tracking-wide text-zinc-900 dark:text-zinc-100 uppercase">
                                KOWENANTY BANKOWE & TEST BANKOWALNOŚCI (15 LAT)
                            </span>
                            {renderBankabilityBadge()}
                        </div>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                            {summary?.isBankable
                                ? `Wszystkie roczne okresy spłaty spełniają wymogi minimalnego pokrycia długu (${thresholds.minDscr.toFixed(2)}x) • 0 naruszeń`
                                : `Wykryto ${summary?.totalBreachesCount ?? 0} naruszeń wskaźników bankowych w horyzoncie 15 lat (wąskie gardło: Rok ${summary?.pinchYear ?? '—'})`
                            }
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Preset Switcher */}
                    <div className="flex items-center bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-0.5 text-[11px]">
                        <Tooltip content="Standardowe wytyczne rynkowe LMA dla długu Senior Debt (DSCR 1.20x, ICR 2.50x, Leverage 3.50x)">
                            <button
                                type="button"
                                onClick={() => applyPreset('standard')}
                                className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                                    activePreset === 'standard'
                                        ? 'bg-white dark:bg-zinc-800 text-emerald-600 dark:text-emerald-400 font-semibold shadow-sm'
                                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                                }`}
                            >
                                Standard (1.20x)
                            </button>
                        </Tooltip>
                        <Tooltip content="Zaostrzone wymogi komitetu ryzyka dla projektów infrastrukturalnych (DSCR 1.30x, ICR 3.00x, Leverage 3.00x)">
                            <button
                                type="button"
                                onClick={() => applyPreset('conservative')}
                                className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                                    activePreset === 'conservative'
                                        ? 'bg-white dark:bg-zinc-800 text-amber-600 dark:text-amber-400 font-semibold shadow-sm'
                                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                                }`}
                            >
                                Konserwatywny (1.30x)
                            </button>
                        </Tooltip>
                        {activePreset === 'custom' && (
                            <Tooltip content="Niestandardowe progi ostrożnościowe zdefiniowane w konfiguratorze testów warunków skrajnych">
                                <span className="px-2 py-1 text-cyan-600 dark:text-cyan-400 font-semibold cursor-help">
                                    Indywidualny
                                </span>
                            </Tooltip>
                        )}
                    </div>

                    {/* Scale switcher */}
                    <div className="flex items-center bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-0.5 text-[11px]">
                        <Tooltip content="Prezentuj kwoty w tysiącach">
                            <button
                                type="button"
                                onClick={() => setScale('thousands')}
                                className={`px-2 py-1 rounded cursor-pointer ${scale === 'thousands' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold shadow-xs' : 'text-zinc-600 dark:text-zinc-400'}`}
                            >
                                tys.
                            </button>
                        </Tooltip>
                        <Tooltip content="Prezentuj kwoty w milionach">
                            <button
                                type="button"
                                onClick={() => setScale('millions')}
                                className={`px-2 py-1 rounded cursor-pointer ${scale === 'millions' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold shadow-xs' : 'text-zinc-600 dark:text-zinc-400'}`}
                            >
                                mln
                            </button>
                        </Tooltip>
                        <Tooltip content="Prezentuj pełne kwoty jednostkowe">
                            <button
                                type="button"
                                onClick={() => setScale('full')}
                                className={`px-2 py-1 rounded cursor-pointer ${scale === 'full' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold shadow-xs' : 'text-zinc-600 dark:text-zinc-400'}`}
                            >
                                pełne
                            </button>
                        </Tooltip>
                    </div>

                    {/* Toggle expand/collapse button */}
                    <Tooltip content={isExpanded ? "Zwiń audyt kowenantów bankowych" : "Rozwiń 15-letni audyt kowenantów i matrycę wskaźników"}>
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setIsExpanded(!isExpanded)}
                            aria-expanded={isExpanded}
                            className="text-xs flex items-center gap-1.5 border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800/80 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200"
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
                    </Tooltip>
                </div>
            </div>

            {/* Key Metric Tiles Strip */}
            <div className="p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 bg-zinc-50/50 dark:bg-zinc-900/40">
                {/* 1. DSCR Tile */}
                <div className={`p-3 rounded-lg border flex flex-col justify-between shadow-xs ${
                    summary?.minDscr != null && summary.minDscr >= thresholds.minDscr
                        ? 'bg-white dark:bg-zinc-950/70 border-zinc-200 dark:border-zinc-800'
                        : 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/40'
                }`}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                            <span className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
                                KOWENANT DSCR
                            </span>
                            <InfoTooltip
                                title="DSCR (Debt Service Coverage Ratio)"
                                content="Wskaźnik Pokrycia Obsługi Długu (Standard LMA). Relacja rocznych przepływów CFADS (Cash Flow Available for Debt Service) do sumy rat kapitałowych i odsetek. Wartość poniżej progu bankowego oznacza naruszenie kowenantu kredytowego."
                                ariaLabel="Objaśnienie kowenantu DSCR"
                                size={11}
                            />
                        </div>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            summary?.minDscr != null && summary.minDscr >= thresholds.minDscr
                                ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                                : 'bg-rose-500/20 text-rose-600 dark:text-rose-400'
                        }`}>
                            {summary?.minDscr != null && summary.minDscr >= thresholds.minDscr ? 'ZGODNY' : 'NARUSZENIE'}
                        </span>
                    </div>
                    <div className="my-1.5">
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-xl font-bold font-mono tabular-nums text-zinc-900 dark:text-zinc-100">
                                {summary?.minDscr != null ? `${summary.minDscr.toFixed(2)}x` : '—'}
                            </span>
                            <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">
                                (śr. {summary?.avgDscr != null ? `${summary.avgDscr.toFixed(2)}x` : '—'})
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400 pt-1 border-t border-zinc-200 dark:border-zinc-800/50">
                        <span>Wymóg: <strong className="text-zinc-800 dark:text-zinc-200">≥ {thresholds.minDscr.toFixed(2)}x</strong></span>
                        {summary?.pinchHeadroomPercent != null && (
                            <span className={`font-mono text-[10px] font-semibold ${
                                summary.pinchHeadroomPercent >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                            }`}>
                                {summary.pinchHeadroomPercent >= 0 ? '+' : ''}{summary.pinchHeadroomPercent.toFixed(1)}% bufor
                            </span>
                        )}
                    </div>
                </div>

                {/* 2. ICR Tile */}
                <div className={`p-3 rounded-lg border flex flex-col justify-between shadow-xs ${
                    summary?.minIcr != null && summary.minIcr >= thresholds.minIcr
                        ? 'bg-white dark:bg-zinc-950/70 border-zinc-200 dark:border-zinc-800'
                        : 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/40'
                }`}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                            <span className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
                                POKRYCIE ODSETEK (ICR)
                            </span>
                            <InfoTooltip
                                title="ICR (Interest Coverage Ratio)"
                                content="Wskaźnik Pokrycia Odsetek. Relacja zysku operacyjnego (EBIT) do kosztów obsługi odsetek. Chroni przed utratą płynności odsetkowej. Minimalny wymóg bankowy LMA: ≥ 2.50x."
                                ariaLabel="Objaśnienie wskaźnika ICR"
                                size={11}
                            />
                        </div>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            summary?.minIcr != null && summary.minIcr >= thresholds.minIcr
                                ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                                : 'bg-rose-500/20 text-rose-600 dark:text-rose-400'
                        }`}>
                            {summary?.minIcr != null && summary.minIcr >= thresholds.minIcr ? 'BEZPIECZNY' : 'RYZYKO'}
                        </span>
                    </div>
                    <div className="my-1.5">
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-xl font-bold font-mono tabular-nums text-zinc-900 dark:text-zinc-100">
                                {summary?.minIcr != null ? `${summary.minIcr.toFixed(2)}x` : '—'}
                            </span>
                            <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">
                                (śr. {summary?.avgIcr != null ? `${summary.avgIcr.toFixed(2)}x` : '—'})
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400 pt-1 border-t border-zinc-200 dark:border-zinc-800/50">
                        <span>Wymóg: <strong className="text-zinc-800 dark:text-zinc-200">≥ {thresholds.minIcr.toFixed(2)}x</strong></span>
                        <span className="text-[10px] text-zinc-400 dark:text-zinc-500">EBIT / Odsetki</span>
                    </div>
                </div>

                {/* 3. Current Ratio Tile */}
                <div className={`p-3 rounded-lg border flex flex-col justify-between shadow-xs ${
                    summary?.minCurrentRatio != null && summary.minCurrentRatio >= thresholds.minCurrentRatio
                        ? 'bg-white dark:bg-zinc-950/70 border-zinc-200 dark:border-zinc-800'
                        : 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/40'
                }`}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                            <span className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
                                PŁYNNOŚĆ BIEŻĄCA (CR)
                            </span>
                            <InfoTooltip
                                title="Current Ratio (Płynność Bieżąca)"
                                content="Relacja aktywów obrotowych do zobowiązań krótkoterminowych w bilansie. Weryfikuje pokrycie operacyjnego kapitału obrotowego (NWC). Minimalny wymóg bankowy: ≥ 1.10x."
                                ariaLabel="Objaśnienie wskaźnika płynności bieżącej"
                                size={11}
                            />
                        </div>
                        <span className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400">
                            Aktywa / Zob.
                        </span>
                    </div>
                    <div className="my-1.5">
                        <div className="flex items-baseline gap-1.5">
                            <span className={`text-xl font-bold font-mono tabular-nums ${
                                summary?.minCurrentRatio != null
                                    ? summary.minCurrentRatio >= thresholds.minCurrentRatio
                                        ? 'text-zinc-900 dark:text-zinc-100'
                                        : 'text-rose-600 dark:text-rose-400'
                                    : 'text-zinc-900 dark:text-zinc-100'
                            }`}>
                                {summary?.minCurrentRatio != null
                                    ? summary.minCurrentRatio < 0
                                        ? '0.00x'
                                        : `${summary.minCurrentRatio.toFixed(2)}x`
                                    : '—'}
                            </span>
                            <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">
                                {summary?.minCurrentRatio != null && summary.minCurrentRatio < 0 ? (
                                    <span className="text-rose-600 dark:text-rose-400 font-semibold">(Deficyt NWC)</span>
                                ) : (
                                    `(śr. ${summary?.avgCurrentRatio != null ? (summary.avgCurrentRatio < 0 ? '0.00x' : `${summary.avgCurrentRatio.toFixed(2)}x`) : '—'})`
                                )}
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400 pt-1 border-t border-zinc-200 dark:border-zinc-800/50">
                        <span>Wymóg: <strong className="text-zinc-800 dark:text-zinc-200">≥ {thresholds.minCurrentRatio.toFixed(2)}x</strong></span>
                        {summary?.minCurrentRatio != null ? (
                            summary.minCurrentRatio < thresholds.minCurrentRatio ? (
                                <span className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold">DEFICYT PŁYNNOŚCI</span>
                            ) : summary.minCurrentRatio < thresholds.minCurrentRatio * 1.10 ? (
                                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">OSTRZEŻENIE</span>
                            ) : (
                                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">ZGODNY</span>
                            )
                        ) : (
                            <span className="text-[10px] text-zinc-400 dark:text-zinc-500">—</span>
                        )}
                    </div>
                </div>

                {/* 4. Peak Leverage (Net Debt / EBITDA) Tile */}
                <div className={`p-3 rounded-lg border flex flex-col justify-between shadow-xs ${
                    summary?.peakLeverage != null && summary.peakLeverage <= thresholds.maxLeverage
                        ? 'bg-white dark:bg-zinc-950/70 border-zinc-200 dark:border-zinc-800'
                        : 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/40'
                }`}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                            <span className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
                                DŹWIGNIA (NET DEBT/EBITDA)
                            </span>
                            <InfoTooltip
                                title="Maksymalna Dźwignia Finansowa (Peak Leverage)"
                                content="Wskaźnik Dług Netto / EBITDA w szczytowym momencie zadłużenia. Wyznacza maksymalną dopuszczalną wielokrotność zysku operacyjnego w relacji do zadłużenia netto. Limit bankowy: ≤ 3.50x."
                                ariaLabel="Objaśnienie wskaźnika dźwigni finansowej"
                                size={11}
                            />
                        </div>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            summary?.peakLeverage != null && summary.peakLeverage <= thresholds.maxLeverage
                                ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                                : 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                        }`}>
                            {summary?.peakLeverage != null && summary.peakLeverage <= thresholds.maxLeverage ? 'KONTROLA' : 'WYSOKA'}
                        </span>
                    </div>
                    <div className="my-1.5">
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-xl font-bold font-mono tabular-nums text-zinc-900 dark:text-zinc-100">
                                {summary?.peakLeverage != null ? `${summary.peakLeverage.toFixed(2)}x` : '0.00x'}
                            </span>
                            <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">
                                (szczyt)
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400 pt-1 border-t border-zinc-200 dark:border-zinc-800/50">
                        <span>Limit: <strong className="text-zinc-800 dark:text-zinc-200">≤ {thresholds.maxLeverage.toFixed(2)}x</strong></span>
                        <span className="text-[10px] text-zinc-400 dark:text-zinc-500">Delewaraging</span>
                    </div>
                </div>

                {/* 5. DSRF Coverage Tile */}
                <div className={`p-3 rounded-lg border flex flex-col justify-between shadow-xs ${
                    summary?.minDsrfMonths != null && summary.minDsrfMonths >= thresholds.minDsrfMonths
                        ? 'bg-white dark:bg-zinc-950/70 border-zinc-200 dark:border-zinc-800'
                        : 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/40'
                }`}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                            <span className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
                                REZERWA DSRF
                            </span>
                            <InfoTooltip
                                title="DSRF / DSRA (Debt Service Reserve Facility)"
                                content="Wymóg utrzymywania wyodrębnionego bufora gotówkowego na rachunku rezerwowym obsługi długu (DSRA). Wymóg LMA: równowartość minimum 6 miesięcy przyszłych rat kapitałowo-odsetkowych."
                                ariaLabel="Objaśnienie rezerwy DSRF"
                                size={11}
                            />
                        </div>
                        <span className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400">
                            Gotówka / Rata
                        </span>
                    </div>
                    <div className="my-1.5">
                        <div className="flex items-baseline gap-1.5">
                            <span className={`text-xl font-bold font-mono tabular-nums ${
                                summary?.minDsrfMonths != null
                                    ? summary.minDsrfMonths >= thresholds.minDsrfMonths
                                        ? 'text-emerald-600 dark:text-emerald-400'
                                        : 'text-rose-600 dark:text-rose-400'
                                    : 'text-zinc-900 dark:text-zinc-100'
                            }`}>
                                {summary?.minDsrfMonths != null
                                    ? summary.minDsrfMonths < 0
                                        ? '0.0 m.'
                                        : `${summary.minDsrfMonths.toFixed(1)} m.`
                                    : '—'}
                            </span>
                            <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">
                                {summary?.minDsrfMonths != null && summary.minDsrfMonths < 0 ? (
                                    <span className="text-rose-600 dark:text-rose-400 font-semibold">(Luka gotówkowa)</span>
                                ) : (
                                    '(min. bufor)'
                                )}
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400 pt-1 border-t border-zinc-200 dark:border-zinc-800/50">
                        <span>Wymóg: <strong className="text-zinc-800 dark:text-zinc-200">≥ {thresholds.minDsrfMonths} mies.</strong></span>
                        {summary?.minDsrfMonths != null ? (
                            summary.minDsrfMonths < thresholds.minDsrfMonths ? (
                                <span className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold">BRAK REZERWY</span>
                            ) : summary.minDsrfMonths < thresholds.minDsrfMonths * 1.25 ? (
                                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">NISKI BUFOR</span>
                            ) : (
                                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">ZABEZPIECZONE</span>
                            )
                        ) : (
                            <span className="text-[10px] text-zinc-400 dark:text-zinc-500">—</span>
                        )}
                    </div>
                </div>

                {/* 6. LLCR Tile */}
                <div className={`p-3 rounded-lg border flex flex-col justify-between shadow-xs ${
                    summary?.minLlcr != null && summary.minLlcr >= thresholds.minLlcr
                        ? "bg-white dark:bg-zinc-950/70 border-zinc-200 dark:border-zinc-800"
                        : "bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/40"
                }`}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                            <span className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
                                POKRYCIE CAŁEGO DŁUGU (LLCR)
                            </span>
                            <InfoTooltip
                                title="LLCR (Loan Life Coverage Ratio)"
                                content="Wskaźnik Pokrycia Długu w Całym Okresie Kredytowania. Relacja sumy zdyskontowanych przyszłych przepływów CFADS do aktualnego salda długu. Wymóg LMA dla długu Senior Debt: ≥ 1.35x."
                                ariaLabel="Objaśnienie wskaźnika LLCR"
                                size={11}
                            />
                        </div>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            summary?.minLlcr != null && summary.minLlcr >= thresholds.minLlcr
                                ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                                : summary?.minLlcr != null && summary.minLlcr >= thresholds.minLlcr * 0.90
                                ? "bg-amber-500/20 text-amber-600 dark:text-amber-400"
                                : "bg-rose-500/20 text-rose-600 dark:text-rose-400"
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
                    <div className="flex items-center justify-between text-[11px] text-zinc-600 dark:text-zinc-400 pt-1 border-t border-zinc-200 dark:border-zinc-800/50">
                        <span>Wymóg: <strong className="text-zinc-900 dark:text-zinc-200">≥ {(thresholds.minLlcr ?? 1.35).toFixed(2)}x</strong></span>
                        <span className="text-[10px] text-zinc-500">NPV CFADS / Dług</span>
                    </div>
                </div>
            </div>

            {/* Expanded Detailed Audit Section */}
            {isExpanded && (
                <div className="border-t border-zinc-200 dark:border-zinc-800 p-4 space-y-4 bg-zinc-50/50 dark:bg-zinc-950/40">
                    {/* Navigation Sub-Tabs */}
                    <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3 flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                            <Tooltip content="Roczna 15-letnia matryca kowenantów z oznaczeniem wąskich gardeł i statusów">
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('matrix')}
                                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                                        activeTab === 'matrix'
                                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                                            : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                                    }`}
                                >
                                    1. Roczna Matryca Kowenantów (15L)
                                </button>
                            </Tooltip>
                            <Tooltip content="Konfiguracja progów ostrożnościowych dla symulacji warunków skrajnych">
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('config')}
                                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                                        activeTab === 'config'
                                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                                            : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                                    }`}
                                >
                                    2. Konfigurator Wymogów Banku (Stress)
                                </button>
                            </Tooltip>
                            <Tooltip content="Szczegółowa analiza buforu bezpieczeństwa oraz symulacja pakietu dokapitalizowania naprawczego">
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('headroom')}
                                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                                        activeTab === 'headroom'
                                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                                            : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                                    }`}
                                >
                                    3. Wąskie Gardło & Analiza Buforu
                                </button>
                            </Tooltip>
                        </div>

                        {activeTab === 'matrix' && (
                            <div className="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-0.5 text-[11px]">
                                <span className="text-zinc-500 px-2 flex items-center gap-1">
                                    <Filter className="w-3 h-3" /> Filtr:
                                </span>
                                <Tooltip content="Wyświetl wszystkie 15 lat horyzontu planowania">
                                    <button
                                        type="button"
                                        onClick={() => setFilter('all')}
                                        className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${filter === 'all' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold shadow-xs' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'}`}
                                    >
                                        Wszystkie (15L)
                                    </button>
                                </Tooltip>
                                <Tooltip content="Filtruj wyłącznie lata z aktywną obsługą długu kredytowego">
                                    <button
                                        type="button"
                                        onClick={() => setFilter('debt_only')}
                                        className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${filter === 'debt_only' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold shadow-xs' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'}`}
                                    >
                                        Lata z długiem
                                    </button>
                                </Tooltip>
                                <Tooltip content="Wyświetl wyłącznie lata z naruszeniem lub ostrzeżeniem wskaźników bankowych">
                                    <button
                                        type="button"
                                        onClick={() => setFilter('breaches_only')}
                                        className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${filter === 'breaches_only' ? 'bg-white dark:bg-zinc-800 text-rose-600 dark:text-rose-400 font-semibold shadow-xs' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'}`}
                                    >
                                        Ryzyko / Naruszenia
                                    </button>
                                </Tooltip>
                            </div>
                        )}
                    </div>

                    {/* Sub-Tab 1: Roczna Matryca Kowenantów (15L) */}
                    {activeTab === 'matrix' && (
                        <div className="space-y-3">
                            <div className="overflow-x-auto border border-zinc-200 dark:border-zinc-800 rounded-lg">
                                <table className="w-full text-xs font-mono text-left">
                                    <thead className="bg-zinc-100 dark:bg-zinc-900/90 text-zinc-600 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800 text-[11px] uppercase tracking-wider">
                                        <tr>
                                            <th className="py-2.5 px-3">
                                                <Tooltip content="Kolejny rok 15-letniego horyzontu inwestycji">
                                                    <span className="cursor-help">Okres</span>
                                                </Tooltip>
                                            </th>
                                            <th className="py-2.5 px-3 text-right">
                                                <Tooltip content="Zysk operacyjny powiększony o amortyzację (EBITDA)">
                                                    <span className="cursor-help">EBITDA</span>
                                                </Tooltip>
                                            </th>
                                            <th className="py-2.5 px-3 text-right">
                                                <Tooltip content="Przepływy pieniężne operacyjne dostępne na obsługę długu bankowego (Cash Flow Available for Debt Service)">
                                                    <span className="cursor-help">CFADS</span>
                                                </Tooltip>
                                            </th>
                                            <th className="py-2.5 px-3 text-right">
                                                <Tooltip content="Łączna roczna suma spłaty raty kapitałowej i odsetek kredytowych">
                                                    <span className="cursor-help">Obsługa Długu</span>
                                                </Tooltip>
                                            </th>
                                            <th className="py-2.5 px-3 text-center">
                                                <Tooltip content={`Wskaźnik Pokrycia Obsługi Długu (CFADS / Obsługa Długu). Wymóg LMA: ≥ ${thresholds.minDscr.toFixed(2)}x`}>
                                                    <span className="cursor-help">DSCR (≥ {thresholds.minDscr.toFixed(2)}x)</span>
                                                </Tooltip>
                                            </th>
                                            <th className="py-2.5 px-3 text-center">
                                                <Tooltip content={`Wskaźnik Pokrycia Długu w Całym Okresie (NPV CFADS / Saldo Długu). Wymóg LMA: ≥ ${(thresholds.minLlcr ?? 1.35).toFixed(2)}x`}>
                                                    <span className="cursor-help">LLCR (≥ {(thresholds.minLlcr ?? 1.35).toFixed(2)}x)</span>
                                                </Tooltip>
                                            </th>
                                            <th className="py-2.5 px-3 text-center">
                                                <Tooltip content={`Wskaźnik Pokrycia Odsetek (EBIT / Odsetki). Wymóg LMA: ≥ ${thresholds.minIcr.toFixed(2)}x`}>
                                                    <span className="cursor-help">ICR (≥ {thresholds.minIcr.toFixed(2)}x)</span>
                                                </Tooltip>
                                            </th>
                                            <th className="py-2.5 px-3 text-center">
                                                <Tooltip content={`Wskaźnik Płynności Bieżącej (Aktywa Obrotowe / Zobowiązania Krótkoterminowe). Wymóg LMA: ≥ ${thresholds.minCurrentRatio.toFixed(2)}x`}>
                                                    <span className="cursor-help">CR (Płynność)</span>
                                                </Tooltip>
                                            </th>
                                            <th className="py-2.5 px-3 text-center">
                                                <Tooltip content={`Wskaźnik Dźwigni Finansowej (Dług Netto / EBITDA). Limit: ≤ ${thresholds.maxLeverage.toFixed(2)}x`}>
                                                    <span className="cursor-help">Dźwignia Net Debt</span>
                                                </Tooltip>
                                            </th>
                                            <th className="py-2.5 px-3 text-center">
                                                <Tooltip content={`Rezerwa Obsługi Długu na rachunku DSRA w miesiącach. Wymóg LMA: ≥ ${thresholds.minDsrfMonths} mies.`}>
                                                    <span className="cursor-help">DSRF (m.)</span>
                                                </Tooltip>
                                            </th>
                                            <th className="py-2.5 px-3 text-center">
                                                <Tooltip content="Łączna zgodność ze wszystkimi kowenantami bankowymi w danym roku">
                                                    <span className="cursor-help">Zgodność</span>
                                                </Tooltip>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/60 bg-white dark:bg-zinc-950/40">
                                        {filteredMetrics.map((m) => {
                                             const isPinch = m.year === summary?.pinchYear && m.hasDebtService;
                                             return (
                                                 <tr
                                                     key={m.year}
                                                     className={`hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors ${
                                                         isPinch ? 'bg-amber-500/10' : ''
                                                     } ${!m.isCompliant ? 'bg-rose-500/10' : ''}`}
                                                 >
                                                     <td className="py-2 px-3 font-semibold text-zinc-900 dark:text-zinc-200">
                                                         <div className="flex items-center gap-1.5">
                                                             <span>Rok {m.year}</span>
                                                             {isPinch && (
                                                                 <Tooltip content="Rok o najniższym buforze pokrycia obsługi długu (Pinch Year) w całym 15-letnim modelu">
                                                                     <span className="text-[9px] px-1 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 font-sans font-bold cursor-help">
                                                                         WĄSKIE GARDŁO
                                                                     </span>
                                                                 </Tooltip>
                                                             )}
                                                         </div>
                                                     </td>
                                                     <td className="py-2 px-3 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                                                         {formatAmount(m.ebitda)}
                                                     </td>
                                                     <td className="py-2 px-3 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                                                         {formatAmount(m.cfads)}
                                                     </td>
                                                     <td className="py-2 px-3 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                                                         {m.hasDebtService ? formatAmount(m.totalDebtService) : '—'}
                                                     </td>

                                                     {/* DSCR */}
                                                     <td className="py-2 px-3 text-center">
                                                         {m.dscr != null ? (
                                                             <Tooltip content={`DSCR: ${m.dscr.toFixed(2)}x (Wymóg: ≥ ${(thresholds?.minDscr ?? 1.20).toFixed(2)}x) • ${m.dscrStatus === 'compliant' ? 'Bufor bezpieczny' : m.dscrStatus === 'warning' ? 'Wąski bufor <10%' : 'Naruszenie kowenantu'}`}>
                                                                 <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold cursor-help ${
                                                                     m.dscrStatus === 'compliant'
                                                                         ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                                                                         : m.dscrStatus === 'warning'
                                                                         ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30'
                                                                         : 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/30'
                                                                 }`}>
                                                                     {m.dscr.toFixed(2)}x
                                                                 </span>
                                                             </Tooltip>
                                                         ) : (
                                                             <span className="text-zinc-400 dark:text-zinc-600">—</span>
                                                         )}
                                                     </td>

                                                     {/* LLCR */}
                                                     <td className="py-2 px-3 text-center">
                                                         {m.llcr != null ? (
                                                             <Tooltip content={`LLCR: ${m.llcr.toFixed(2)}x (Wymóg: ≥ ${(thresholds.minLlcr ?? 1.35).toFixed(2)}x)`}>
                                                                 <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold cursor-help ${
                                                                     m.llcrStatus === 'compliant'
                                                                         ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                                                                         : m.llcrStatus === 'warning'
                                                                         ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30'
                                                                         : 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/30'
                                                                 }`}>
                                                                     {m.llcr < 0 ? '0.00x' : `${m.llcr.toFixed(2)}x`}
                                                                 </span>
                                                             </Tooltip>
                                                         ) : (
                                                             <span className="text-zinc-400 dark:text-zinc-600">—</span>
                                                         )}
                                                     </td>

                                                     {/* ICR */}
                                                     <td className="py-2 px-3 text-center">
                                                         {m.icr != null ? (
                                                             <Tooltip content={`ICR: ${m.icr.toFixed(2)}x (Wymóg: ≥ ${(thresholds?.minIcr ?? 2.50).toFixed(2)}x)`}>
                                                                 <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold cursor-help ${
                                                                     m.icrStatus === 'compliant'
                                                                         ? 'text-emerald-600 dark:text-emerald-400'
                                                                         : m.icrStatus === 'warning'
                                                                         ? 'text-amber-600 dark:text-amber-400'
                                                                         : 'text-rose-600 dark:text-rose-400'
                                                                 }`}>
                                                                     {m.icr.toFixed(2)}x
                                                                 </span>
                                                             </Tooltip>
                                                         ) : (
                                                             <span className="text-zinc-400 dark:text-zinc-600">—</span>
                                                         )}
                                                     </td>

                                                     {/* Current Ratio */}
                                                     <td className="py-2 px-3 text-center text-zinc-700 dark:text-zinc-300 tabular-nums">
                                                         {m.currentRatio != null ? (
                                                             <Tooltip content={`Current Ratio: ${m.currentRatio.toFixed(2)}x (Wymóg: ≥ ${(thresholds?.minCurrentRatio ?? 1.10).toFixed(2)}x)`}>
                                                                 <span className="cursor-help">
                                                                     {m.currentRatio < 0 ? (
                                                                         <span className="text-rose-600 dark:text-rose-400 font-semibold">0.00x</span>
                                                                     ) : (
                                                                         `${m.currentRatio.toFixed(2)}x`
                                                                     )}
                                                                 </span>
                                                             </Tooltip>
                                                         ) : '—'}
                                                     </td>

                                                     {/* Net Debt / EBITDA */}
                                                     <td className="py-2 px-3 text-center">
                                                         {m.leverageRatio != null ? (
                                                             <Tooltip content={`Dźwignia Net Debt/EBITDA: ${m.leverageRatio.toFixed(2)}x (Limit: ≤ ${(thresholds?.maxLeverage ?? 3.50).toFixed(2)}x)`}>
                                                                 <span className={`tabular-nums cursor-help ${
                                                                     m.leverageRatio > thresholds.maxLeverage
                                                                         ? 'text-rose-600 dark:text-rose-400 font-bold'
                                                                         : 'text-zinc-700 dark:text-zinc-300'
                                                                 }`}>
                                                                     {m.leverageRatio.toFixed(2)}x
                                                                 </span>
                                                             </Tooltip>
                                                         ) : (
                                                             <span className="text-zinc-400 dark:text-zinc-600">—</span>
                                                         )}
                                                     </td>

                                                     {/* DSRF Months */}
                                                     <td className="py-2 px-3 text-center">
                                                         {m.dsrfMonths != null ? (
                                                             <Tooltip content={`Rezerwa DSRF: ${m.dsrfMonths.toFixed(1)} mies. (Wymóg: ≥ ${thresholds.minDsrfMonths} mies.)`}>
                                                                 <span className={`tabular-nums cursor-help ${
                                                                     m.dsrfMonths < thresholds.minDsrfMonths
                                                                         ? 'text-rose-600 dark:text-rose-400 font-bold'
                                                                         : 'text-emerald-600 dark:text-emerald-400'
                                                                 }`}>
                                                                     {m.dsrfMonths < 0 ? '0.0 m.' : `${m.dsrfMonths.toFixed(1)} m.`}
                                                                 </span>
                                                             </Tooltip>
                                                         ) : (
                                                             <span className="text-zinc-400 dark:text-zinc-600">—</span>
                                                         )}
                                                     </td>

                                                     {/* Status Badge */}
                                                     <td className="py-2 px-3 text-center">
                                                         {m.hasDebtService ? (
                                                             m.isCompliant ? (
                                                                 <Tooltip content="Wszystkie kowenanty bankowe w tym roku są w pełni spełnione (Status Zgodny)">
                                                                     <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-sans font-semibold text-[10px] cursor-help">
                                                                         <CheckCircle2 className="w-3 h-3" /> Zgodny
                                                                     </span>
                                                                 </Tooltip>
                                                             ) : (
                                                                 <Tooltip content={`Wykryte naruszenia: ${m.breaches.join(', ')}`}>
                                                                     <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-sans font-bold text-[10px] cursor-help">
                                                                         <XCircle className="w-3 h-3" /> Naruszenie
                                                                     </span>
                                                                 </Tooltip>
                                                             )
                                                         ) : (
                                                             <Tooltip content="Brak obsługi długu kredytowego w tym roku (okres pre-debt lub po całkowitej spłacie)">
                                                                 <span className="text-zinc-400 dark:text-zinc-500 font-sans text-[10px] cursor-help">—</span>
                                                             </Tooltip>
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
                            <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg space-y-4">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-zinc-900 dark:text-zinc-200 uppercase tracking-wide">
                                        Progi Ostrożnościowe Komitetu Kredytowego
                                    </span>
                                    <Tooltip content="Przywróć domyślne progi ostrożnościowe Loan Market Association">
                                        <Button
                                            variant="secondary"
                                            size="xs"
                                            onClick={() => applyPreset('standard')}
                                            className="text-[10px]"
                                        >
                                            Przywróć standardy LMA
                                        </Button>
                                    </Tooltip>
                                </div>

                                {/* Slider 1: Min DSCR */}
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-zinc-600 dark:text-zinc-400">Minimalny Wymóg DSCR (CFADS / Obsługa Długu)</span>
                                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{thresholds.minDscr.toFixed(2)}x</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="1.00"
                                        max="1.60"
                                        step="0.05"
                                        value={thresholds.minDscr}
                                        onChange={(e) => updateThreshold('minDscr', e.target.value)}
                                        aria-label="Minimalny Wymóg DSCR"
                                        className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
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
                                        <span className="text-zinc-600 dark:text-zinc-400">Minimalne Pokrycie Całego Długu (LLCR = NPV CFADS / Dług)</span>
                                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{(thresholds.minLlcr ?? 1.35).toFixed(2)}x</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="1.00"
                                        max="2.00"
                                        step="0.05"
                                        value={thresholds.minLlcr ?? 1.35}
                                        onChange={(e) => updateThreshold('minLlcr', e.target.value)}
                                        aria-label="Minimalne Pokrycie Całego Długu LLCR"
                                        className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
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
                                        <span className="text-zinc-600 dark:text-zinc-400">Minimalne Pokrycie Odsetek (ICR = EBIT / Odsetki)</span>
                                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{thresholds.minIcr.toFixed(2)}x</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="1.50"
                                        max="4.00"
                                        step="0.25"
                                        value={thresholds.minIcr}
                                        onChange={(e) => updateThreshold('minIcr', e.target.value)}
                                        aria-label="Minimalne Pokrycie Odsetek ICR"
                                        className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                                    />
                                </div>

                                {/* Slider 3: Max Net Debt / EBITDA */}
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-zinc-600 dark:text-zinc-400">Maksymalna Dopuszczalna Dźwignia (Net Debt / EBITDA)</span>
                                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{thresholds.maxLeverage.toFixed(2)}x</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="2.00"
                                        max="6.00"
                                        step="0.25"
                                        value={thresholds.maxLeverage}
                                        onChange={(e) => updateThreshold('maxLeverage', e.target.value)}
                                        aria-label="Maksymalna Dopuszczalna Dźwignia Net Debt do EBITDA"
                                        className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                                    />
                                </div>
                            </div>

                            <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg space-y-4">
                                <span className="text-xs font-bold text-zinc-900 dark:text-zinc-200 uppercase tracking-wide block">
                                    Wymogi Płynnościowe & Rezerw
                                </span>

                                {/* Slider 4: Min Current Ratio */}
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-zinc-600 dark:text-zinc-400">Minimalny Wskaźnik Płynności Bieżącej (Current Ratio)</span>
                                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{thresholds.minCurrentRatio.toFixed(2)}x</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="1.00"
                                        max="2.00"
                                        step="0.05"
                                        value={thresholds.minCurrentRatio}
                                        onChange={(e) => updateThreshold('minCurrentRatio', e.target.value)}
                                        aria-label="Minimalny Wskaźnik Płynności Bieżącej Current Ratio"
                                        className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                                    />
                                </div>

                                {/* Slider 5: Min DSRF Months */}
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-zinc-600 dark:text-zinc-400">Wymagana Rezerwa Obsługi Długu (DSRF w miesiącach)</span>
                                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{thresholds.minDsrfMonths} mies.</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="3"
                                        max="12"
                                        step="1"
                                        value={thresholds.minDsrfMonths}
                                        onChange={(e) => updateThreshold('minDsrfMonths', e.target.value)}
                                        aria-label="Wymagana Rezerwa Obsługi Długu DSRF w miesiącach"
                                        className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                                    />
                                    <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                                        <span>3 mies. (Minimalny)</span>
                                        <span>6 mies. (Standard LMA)</span>
                                        <span>12 mies. (Infrastruktura krytyczna)</span>
                                    </div>
                                </div>

                                <div className="p-3 bg-zinc-50 dark:bg-zinc-950/60 rounded border border-zinc-200 dark:border-zinc-800 text-[11px] text-zinc-600 dark:text-zinc-400 space-y-1">
                                    <span className="font-semibold text-zinc-900 dark:text-zinc-200 block">Wpływ na Bankowalność:</span>
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
                            <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-zinc-900 dark:text-zinc-200 uppercase">
                                        Rok Wąskiego Gardła (Pinch Year)
                                    </span>
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300">
                                        ROK {summary?.pinchYear ?? '—'}
                                    </span>
                                </div>
                                <p className="text-xs text-zinc-600 dark:text-zinc-400">
                                    Rok, w którym wskaźnik DSCR osiąga minimum w całym okresie spłaty długu:
                                </p>
                                <div className="p-3 bg-zinc-50 dark:bg-zinc-950 rounded border border-zinc-200 dark:border-zinc-800">
                                    <div className="flex justify-between text-xs text-zinc-600 dark:text-zinc-400">
                                        <span>Min DSCR w Roku {summary?.pinchYear ?? '—'}:</span>
                                        <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">{summary?.pinchDscr ? `${summary.pinchDscr.toFixed(2)}x` : '—'}</span>
                                    </div>
                                    <div className="flex justify-between text-xs text-zinc-600 dark:text-zinc-400 mt-1">
                                        <span>Margines do progu ({thresholds.minDscr.toFixed(2)}x):</span>
                                        <span className={`font-mono font-bold ${
                                            (summary?.pinchHeadroomPercent ?? 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                                        }`}>
                                            {(summary?.pinchHeadroomPercent ?? 0) >= 0 ? '+' : ''}{summary?.pinchHeadroomPercent?.toFixed(1) ?? '—'}%
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Card 2: Stress Cushion */}
                            <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg space-y-2">
                                <span className="text-xs font-bold text-zinc-900 dark:text-zinc-200 uppercase block">
                                    Odporność na Spadek Przychodów
                                </span>
                                <p className="text-xs text-zinc-600 dark:text-zinc-400">
                                    Maksymalny dopuszczalny spadek CFADS w roku wąskiego gardła przed naruszeniem kowenantu:
                                </p>
                                <div className="p-3 bg-zinc-50 dark:bg-zinc-950 rounded border border-zinc-200 dark:border-zinc-800 text-center">
                                    <span className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
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
                            <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg space-y-2">
                                <span className="text-xs font-bold text-zinc-900 dark:text-zinc-200 uppercase block">
                                    Rekomendacje Strukturyzacji
                                </span>
                                <ul className="text-[11px] text-zinc-600 dark:text-zinc-400 space-y-1.5 list-disc list-inside">
                                    {summary?.isBankable ? (
                                        <>
                                            <li className="text-emerald-600 dark:text-emerald-400">Struktura długu w pełni bankowalna wg standardów LMA.</li>
                                            <li>Możliwe rozważenie lekkiego zwiększenia lewarowania lub skrócenia spłaty.</li>
                                            <li>Bufor gotówkowy DSRF zabezpiecza ponad 6 miesięcy obsługi zadłużenia.</li>
                                        </>
                                    ) : (
                                        <>
                                            <li className="text-rose-600 dark:text-rose-400 font-bold">Wymagana restrukturyzacja harmonogramu spłat długu.</li>
                                            <li>Rekomendacja: wydłużenie karencji w spłacie kapitału o 12 miesięcy.</li>
                                            <li>Alternatywa: przejście z rat równych na profil dopasowany do CFADS.</li>
                                        </>
                                    )}
                                </ul>
                            </div>
                            {/* Deal Advisory: Equity Cure Simulator OR LMA Bankability Certificate */}
                            <div className="md:col-span-3">
                                {covenantsResult?.equityCure?.isCureNeeded ? (
                                    <div className="p-4 bg-rose-500/10 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/40 rounded-lg space-y-4">
                                        <div className="flex items-center justify-between border-b border-rose-200 dark:border-rose-800/30 pb-3">
                                            <div className="flex items-center gap-2">
                                                <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                                                <div>
                                                    <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wide">
                                                        Deal Advisory: Pakiet Naprawczy (Equity Cure Simulator)
                                                    </h4>
                                                    <p className="text-xs text-zinc-600 dark:text-zinc-400">
                                                        Symulacja minimalnego zastrzyku kapitałowego wymaganego do przywrócenia pełnej bankowalności projektu (LMA Standard)
                                                    </p>
                                                </div>
                                            </div>
                                            <span className="px-2.5 py-1 rounded text-xs font-bold bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30">
                                                EQUITY CURE WYMAGANE
                                            </span>
                                        </div>

                                        {/* 3 Metric Cards for Equity Cure */}
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                            <div className="p-3 bg-white dark:bg-zinc-950/80 rounded border border-rose-200 dark:border-rose-900/40">
                                                <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block">
                                                    Łączny Wymóg Dokapitalizowania
                                                </span>
                                                <span className="text-xl font-bold font-mono text-rose-600 dark:text-rose-400 mt-1 block">
                                                    {formatAmount(covenantsResult.equityCure.totalEquityCureRequired)}
                                                </span>
                                                <span className="text-[10px] text-zinc-500">Skumulowana kwota wsparcia w horyzoncie 15L</span>
                                            </div>

                                            <div className="p-3 bg-white dark:bg-zinc-950/80 rounded border border-rose-200 dark:border-rose-900/40">
                                                <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block">
                                                    Szczytowy Roczny Zastrzyk
                                                </span>
                                                <span className="text-xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-1 block">
                                                    {formatAmount(covenantsResult.equityCure.peakAnnualCure)}
                                                </span>
                                                <span className="text-[10px] text-zinc-500">Maksymalny pojedynczy transfer kapitału</span>
                                            </div>

                                            <div className="p-3 bg-white dark:bg-zinc-950/80 rounded border border-rose-200 dark:border-rose-900/40">
                                                <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block">
                                                    Lata z Deficytem Kowenantowym
                                                </span>
                                                <span className="text-xl font-bold font-mono text-zinc-900 dark:text-zinc-100 mt-1 block">
                                                    {covenantsResult.equityCure.curesByYear.length} {covenantsResult.equityCure.curesByYear.length === 1 ? 'rok' : 'lata'}
                                                </span>
                                                <span className="text-[10px] text-zinc-500">
                                                    {covenantsResult.equityCure.curesByYear.map(c => `Rok ${c.year}`).join(', ') || 'Brak'}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Schedule of Required Cures Table */}
                                        <div className="overflow-x-auto border border-zinc-200 dark:border-zinc-800 rounded-lg">
                                            <table className="w-full text-xs font-mono text-left">
                                                <thead className="bg-zinc-100 dark:bg-zinc-900/90 text-zinc-600 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800 text-[11px] uppercase tracking-wider">
                                                    <tr>
                                                        <th className="py-2 px-3">Rok</th>
                                                        <th className="py-2 px-3 text-right">Wymagane Dokapitalizowanie</th>
                                                        <th className="py-2 px-3">Główny Powód Deficytu</th>
                                                        <th className="py-2 px-3">Naruszone Wymogi</th>
                                                        <th className="py-2 px-3">Sugerowany Instrument Naprawczy</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/60 bg-white dark:bg-zinc-950/40">
                                                    {covenantsResult.equityCure.curesByYear.map((c) => (
                                                        <tr key={c.year} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                                                            <td className="py-2 px-3 font-bold text-zinc-900 dark:text-zinc-200">Rok {c.year}</td>
                                                            <td className="py-2 px-3 text-right font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                                                                {formatAmount(c.cureAmount)}
                                                            </td>
                                                            <td className="py-2 px-3 text-zinc-700 dark:text-zinc-300 font-sans">{c.primaryDriver}</td>
                                                            <td className="py-2 px-3 font-sans">
                                                                <div className="flex flex-wrap gap-1">
                                                                    {c.covenantBreaches.map((b, i) => (
                                                                        <span key={i} className="px-1.5 py-0.5 rounded text-[10px] bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30">
                                                                            {b}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            </td>
                                                            <td className="py-2 px-3 text-zinc-600 dark:text-zinc-400 font-sans">
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
                                        <div className="p-3 bg-white dark:bg-zinc-950/60 rounded border border-rose-200 dark:border-rose-900/30 text-xs text-zinc-700 dark:text-zinc-300 space-y-2">
                                            <span className="font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wide block">
                                                Zalecenia Deal Advisory dla Zespołu Transakcyjnego:
                                            </span>
                                            <ul className="space-y-1 list-disc list-inside text-zinc-600 dark:text-zinc-400 text-[11px]">
                                                {covenantsResult.equityCure.recommendations.map((rec, i) => (
                                                    <li key={i}>{rec}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-4 bg-emerald-500/10 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 rounded-lg space-y-4">
                                        <div className="flex items-center justify-between border-b border-emerald-200 dark:border-emerald-800/30 pb-3">
                                            <div className="flex items-center gap-2">
                                                <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                                                <div>
                                                    <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wide">
                                                        Certyfikat Bankowalności LMA (Project Bankability Certificate)
                                                    </h4>
                                                    <p className="text-xs text-zinc-600 dark:text-zinc-400">
                                                        Projekt spełnia wszystkie instytucjonalne wymogi ostrożnościowe Loan Market Association w całym 15-letnim okresie
                                                    </p>
                                                </div>
                                            </div>
                                            <span className="px-2.5 py-1 rounded text-xs font-bold bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                                                <CheckCircle2 className="w-3.5 h-3.5" />
                                                LMA COMPLIANT
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                                            <div className="p-3 bg-white dark:bg-zinc-950/70 rounded border border-emerald-200 dark:border-emerald-900/30 space-y-1">
                                                <span className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase font-bold block">Pokrycie Roczne (DSCR)</span>
                                                <span className="text-emerald-600 dark:text-emerald-400 font-mono font-bold text-base">
                                                    {summary?.minDscr != null ? `${summary.minDscr.toFixed(2)}x` : '—'}
                                                </span>
                                                <span className="text-[10px] text-zinc-500 block">Wymóg: ≥ {thresholds.minDscr.toFixed(2)}x (Bezpieczny bufor)</span>
                                            </div>
                                            <div className="p-3 bg-white dark:bg-zinc-950/70 rounded border border-emerald-200 dark:border-emerald-900/30 space-y-1">
                                                <span className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase font-bold block">Pokrycie Całego Długu (LLCR)</span>
                                                <span className="text-emerald-600 dark:text-emerald-400 font-mono font-bold text-base">
                                                    {summary?.minLlcr != null ? `${summary.minLlcr.toFixed(2)}x` : '—'}
                                                </span>
                                                <span className="text-[10px] text-zinc-500 block">Wymóg: ≥ {(thresholds.minLlcr ?? 1.35).toFixed(2)}x (Standard LMA)</span>
                                            </div>
                                            <div className="p-3 bg-white dark:bg-zinc-950/70 rounded border border-emerald-200 dark:border-emerald-900/30 space-y-1">
                                                <span className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase font-bold block">Rezerwa DSRA / DSRF</span>
                                                <span className="text-emerald-600 dark:text-emerald-400 font-mono font-bold text-base">
                                                    {summary?.minDsrfMonths != null ? `${summary.minDsrfMonths.toFixed(1)} mies.` : '—'}
                                                </span>
                                                <span className="text-[10px] text-zinc-500 block">Wymóg: ≥ {thresholds.minDsrfMonths} mies. na rachunku escrow</span>
                                            </div>
                                        </div>

                                        <div className="p-3 bg-white dark:bg-zinc-950/60 rounded border border-emerald-200 dark:border-emerald-900/30 text-[11px] text-zinc-700 dark:text-zinc-300">
                                            <span className="font-semibold text-emerald-600 dark:text-emerald-400 block mb-1">Opinia Komitetu Kredytowego:</span>
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
