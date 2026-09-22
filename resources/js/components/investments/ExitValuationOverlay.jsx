import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    TrendingUp,
    DollarSign,
    Sliders,
    Calendar,
    ChevronDown,
    ChevronUp,
    Percent,
    PieChart,
    ArrowUpRight,
    Coins,
    Building2,
    ShieldCheck,
    CheckCircle2,
    Clock,
    Zap,
    Scale,
    Layers,
    Info,
    ArrowRight
} from 'lucide-react';
import { useInvestmentProject } from '../../context/InvestmentProjectContext';
import { getInvestmentWorkerClient } from '../../workers/InvestmentWorkerClient';
import { calculateExitValuation } from '../../workers/financialCalculations';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

// Predefiniowane benchmarki mnożników sektorowych
export const SECTOR_MULTIPLES = [
    { label: 'OZE / PV / Wiatr', multiple: 8.0, category: 'Infrastruktura' },
    { label: 'Przemysł / KŚT', multiple: 7.0, category: 'Produkcja' },
    { label: 'Logistyka & Magazyny', multiple: 8.5, category: 'Nieruchomości' },
    { label: 'Tech / B2B SaaS', multiple: 12.0, category: 'Technologia' },
    { label: 'MedTech / Pharma', multiple: 10.0, category: 'Ochrona Zdrowia' },
];

export const EXIT_YEAR_PRESETS = [
    { year: 3, label: 'Rok 3 (Early Exit)' },
    { year: 5, label: 'Rok 5 (Standard PE)' },
    { year: 7, label: 'Rok 7 (Infrastructure)' },
    { year: 10, label: 'Rok 10 (Long-Term)' },
    { year: 15, label: 'Rok 15 (Horyzont 15L)' },
];

export function ExitValuationOverlay({ project: propProject, defaultOpen = true, className = '' }) {
    const { selectedProject: contextProject } = useInvestmentProject();
    const activeProject = propProject || contextProject;

    const [simulationData, setSimulationData] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!activeProject) {
            setSimulationData(null);
            return;
        }

        let isMounted = true;
        setLoading(true);

        const client = getInvestmentWorkerClient();
        const activeAssumptions = activeProject.operating_assumptions;

        client.simulate(activeProject, activeAssumptions, null, 15)
            .then((res) => {
                if (isMounted) {
                    setSimulationData(res);
                }
            })
            .catch((err) => {
                console.error('[ExitValuationOverlay] Simulation calculation failed:', err);
            })
            .finally(() => {
                if (isMounted) setLoading(false);
            });

        return () => {
            isMounted = false;
        };
    }, [activeProject]);

    // Stan nakładki: zwinięta / rozwinięta
    const [isOpen, setIsOpen] = useState(defaultOpen);

    // Aktywne parametry wyjścia
    const initialMultiple = activeProject?.valuation_multiple?.multiple
        ? Number(activeProject.valuation_multiple.multiple)
        : 7.5;

    const [exitYear, setExitYear] = useState(5);
    const [exitMultiple, setExitMultiple] = useState(initialMultiple);
    const [tvMethod, setTvMethod] = useState('exit_multiple');
    const [perpetualGrowth, setPerpetualGrowth] = useState(2.5);
    const [activeSubTab, setActiveSubTab] = useState('bridge'); // 'bridge' | 'buyer' | 'matrix'
    const [scale, setScale] = useState('millions'); // 'full' | 'thousands' | 'millions'

    const currency = activeProject?.currency || 'PLN';
    const horizonYears = activeProject?.planning_horizon_years || 15;

    // Wyliczenie wyceny wyjścia w czasie rzeczywistym
    const valuationResult = useMemo(() => {
        if (!simulationData?.annualPeriods?.length) return null;

        const initialEquity = simulationData?.summary?.initialEquity ?? 0;
        const waccPercent = simulationData?.appraisal?.waccPercent ?? 8.50;

        return calculateExitValuation(
            simulationData.annualPeriods,
            initialEquity,
            waccPercent,
            currency,
            {
                exitYear,
                exitMultiple,
                tvMethod,
                perpetualGrowthRatePercent: perpetualGrowth,
                waccPercent
            }
        );
    }, [simulationData, exitYear, exitMultiple, tvMethod, perpetualGrowth, currency]);

    // Formatowanie wartości liczbowych i walutowych
    const formatValue = useCallback((val, isPercent = false, isRatio = false) => {
        if (val === null || val === undefined || isNaN(Number(val))) {
            return '—';
        }
        const num = Number(val);
        if (isPercent) {
            return `${num.toFixed(1)}%`;
        }
        if (isRatio) {
            return `${num.toFixed(2)}x`;
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
            minimumFractionDigits: scale === 'full' ? 0 : 2,
            maximumFractionDigits: scale === 'full' ? 0 : 2,
        }).format(scaled);

        return `${formatted}${suffix} ${currency}`;
    }, [scale, currency]);

    // Data kalendarzowa wyjścia
    const exitDateLabel = useMemo(() => {
        const start = activeProject?.start_date ? new Date(activeProject.start_date) : new Date('2026-01-01');
        const exitDateYear = start.getFullYear() + exitYear - 1;
        return `${exitDateYear}-12-31`;
    }, [activeProject, exitYear]);

    if (!activeProject) {
        return (
            <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-500 font-mono text-center">
                Brak aktywnego projektu do wyliczenia wyceny wyjścia.
            </div>
        );
    }

    return (
        <div className={`bg-zinc-900 border border-zinc-800 rounded-lg shadow-lg font-mono transition-all ${className}`} data-testid="exit-valuation-overlay">
            {/* Header Bar */}
            <div className="p-4 sm:p-5 border-b border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-950/60 rounded-t-lg">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-md bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                        <TrendingUp className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                                NAKŁADKA INWESTORSKA M&A / PRIVATE EQUITY
                            </span>
                            <span className="text-zinc-600">//</span>
                            <span className="text-[10px] text-emerald-400 font-semibold uppercase">
                                WYCENA WYJŚCIA & BUYER YIELD
                            </span>
                        </div>
                        <h2 className="text-sm sm:text-base font-bold text-zinc-100 flex items-center gap-2">
                            <span>Wycena Wyjścia (Exit Valuation)</span>
                            <span className="text-zinc-500 text-xs font-normal">| Rok {exitYear} ({exitDateLabel})</span>
                        </h2>
                    </div>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                    {/* Szybkie wskaźniki podsumowujące w nagłówku */}
                    {valuationResult && (
                        <div className="hidden lg:flex items-center gap-2 text-xs bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1">
                            <span className="text-zinc-400">EV:</span>
                            <span className="text-zinc-100 font-bold">{formatValue(valuationResult.enterpriseValue)}</span>
                            <span className="text-zinc-600">|</span>
                            <span className="text-zinc-400">MoIC:</span>
                            <span className="text-emerald-400 font-bold">{valuationResult.equityMoic.toFixed(2)}x</span>
                            <span className="text-zinc-600">|</span>
                            <span className="text-zinc-400">IRR:</span>
                            <span className="text-cyan-400 font-bold">{valuationResult.equityIrrPercent !== null ? `${valuationResult.equityIrrPercent.toFixed(1)}%` : '—'}</span>
                            <span className="text-zinc-600">|</span>
                            <span className="text-zinc-400">Buyer Yield:</span>
                            <span className="text-amber-400 font-bold">{valuationResult.buyerEbitdaYieldPercent.toFixed(1)}%</span>
                        </div>
                    )}

                    {/* Scale switcher */}
                    <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded p-0.5 text-[11px]">
                        <button
                            type="button"
                            onClick={() => setScale('millions')}
                            className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                                scale === 'millions' ? 'bg-zinc-800 text-emerald-400 font-bold' : 'text-zinc-400 hover:text-zinc-200'
                            }`}
                        >
                            mln
                        </button>
                        <button
                            type="button"
                            onClick={() => setScale('thousands')}
                            className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                                scale === 'thousands' ? 'bg-zinc-800 text-emerald-400 font-bold' : 'text-zinc-400 hover:text-zinc-200'
                            }`}
                        >
                            tys.
                        </button>
                        <button
                            type="button"
                            onClick={() => setScale('full')}
                            className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                                scale === 'full' ? 'bg-zinc-800 text-emerald-400 font-bold' : 'text-zinc-400 hover:text-zinc-200'
                            }`}
                        >
                            PLN
                        </button>
                    </div>

                    {/* Collapse / Expand Toggle */}
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setIsOpen(!isOpen)}
                        className="gap-1.5 text-xs font-semibold"
                        aria-expanded={isOpen}
                        data-testid="toggle-exit-overlay"
                    >
                        <span>{isOpen ? 'Zwiń Wycenę' : 'Rozwiń Wycenę'}</span>
                        {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </Button>
                </div>
            </div>

            {/* Collapsible Body */}
            {isOpen && (
                <div className="p-4 sm:p-6 space-y-6">
                    {/* Control Panel: Exit Year & Valuation Method / Multiples */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 p-4 bg-zinc-950 border border-zinc-800/80 rounded-lg">
                        {/* Lewa strona: Moment wyjścia (Exit Timing) */}
                        <div className="lg:col-span-6 space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-zinc-200 flex items-center gap-1.5 uppercase">
                                    <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                                    <span>Horyzont Wyjścia (Exit Timing):</span>
                                    <span className="text-emerald-400 font-bold" data-testid="exit-year-display">Rok {exitYear}</span>
                                    <span className="text-zinc-500 font-normal">({exitDateLabel})</span>
                                </label>
                                <span className="text-[11px] text-zinc-400">
                                    {exitYear * 12} mies. inwestycji
                                </span>
                            </div>

                            {/* Slider roku wyjścia */}
                            <input
                                type="range"
                                min={1}
                                max={horizonYears}
                                step={1}
                                value={exitYear}
                                onChange={(e) => setExitYear(parseInt(e.target.value, 10))}
                                aria-label="Wybierz rok wyjścia"
                                data-testid="exit-year-slider"
                                className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500 focus:outline-none"
                            />

                            {/* Szybkie presety lat wyjścia */}
                            <div className="flex items-center gap-1.5 flex-wrap pt-1">
                                {EXIT_YEAR_PRESETS.filter(p => p.year <= horizonYears).map((preset) => (
                                    <button
                                        key={preset.year}
                                        type="button"
                                        onClick={() => setExitYear(preset.year)}
                                        className={`px-2 py-1 text-[10px] rounded border transition-all cursor-pointer ${
                                            exitYear === preset.year
                                                ? 'bg-emerald-950/70 border-emerald-500 text-emerald-300 font-bold'
                                                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                                        }`}
                                    >
                                        {preset.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Prawa strona: Mnożnik EV/EBITDA i Metoda */}
                        <div className="lg:col-span-6 space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <label className="text-xs font-bold text-zinc-200 flex items-center gap-1.5 uppercase">
                                        <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                                        <span>Mnożnik Wyceny:</span>
                                    </label>
                                    <select
                                        value={tvMethod}
                                        onChange={(e) => setTvMethod(e.target.value)}
                                        aria-label="Metoda wyceny wyjścia"
                                        className="bg-zinc-900 border border-zinc-700 text-zinc-100 text-[11px] rounded px-2 py-0.5 focus:outline-none cursor-pointer"
                                    >
                                        <option value="exit_multiple">EV / EBITDA Multiple</option>
                                        <option value="gordon_growth">Renta Wieczysta Gordona</option>
                                        <option value="book_value">Wartość Księgowa (NAV)</option>
                                    </select>
                                </div>

                                {tvMethod === 'exit_multiple' && (
                                    <span className="text-xs font-bold text-cyan-400" data-testid="exit-multiple-display">
                                        {exitMultiple.toFixed(1)}x EV/EBITDA
                                    </span>
                                )}
                                {tvMethod === 'gordon_growth' && (
                                    <span className="text-xs font-bold text-cyan-400">
                                        g = {perpetualGrowth.toFixed(1)}%
                                    </span>
                                )}
                            </div>

                            {tvMethod === 'exit_multiple' && (
                                <>
                                    <input
                                        type="range"
                                        min={3.0}
                                        max={16.0}
                                        step={0.25}
                                        value={exitMultiple}
                                        onChange={(e) => setExitMultiple(parseFloat(e.target.value))}
                                        aria-label="Suwak mnożnika EV/EBITDA"
                                        data-testid="exit-multiple-slider"
                                        className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-cyan-500 focus:outline-none"
                                    />

                                    {/* Presety sektorowe */}
                                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                                        {SECTOR_MULTIPLES.map((sec) => (
                                            <button
                                                key={sec.label}
                                                type="button"
                                                onClick={() => setExitMultiple(sec.multiple)}
                                                className={`px-2 py-1 text-[10px] rounded border transition-all cursor-pointer ${
                                                    Math.abs(exitMultiple - sec.multiple) < 0.05
                                                        ? 'bg-cyan-950/70 border-cyan-500 text-cyan-300 font-bold'
                                                        : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                                                }`}
                                            >
                                                {sec.label} ({sec.multiple.toFixed(1)}x)
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}

                            {tvMethod === 'gordon_growth' && (
                                <div className="space-y-2">
                                    <input
                                        type="range"
                                        min={0.5}
                                        max={4.0}
                                        step={0.1}
                                        value={perpetualGrowth}
                                        onChange={(e) => setPerpetualGrowth(parseFloat(e.target.value))}
                                        aria-label="Stopa wzrostu renty Gordona"
                                        className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-cyan-500 focus:outline-none"
                                    />
                                    <p className="text-[11px] text-zinc-400">
                                        Perpetual Growth Rate (g): {perpetualGrowth.toFixed(1)}% | WACC: {valuationResult?.waccPercent ?? 8.5}% | Spread: {((valuationResult?.waccPercent ?? 8.5) - perpetualGrowth).toFixed(1)}%
                                    </p>
                                </div>
                            )}

                            {tvMethod === 'book_value' && (
                                <div className="p-2.5 bg-zinc-900 rounded border border-zinc-800 text-[11px] text-zinc-400">
                                    Wycena oparta na wartości księgowej netto aktywów trwałych i kapitale obrotowym na koniec roku {exitYear}.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Executive KPI Cards */}
                    {valuationResult && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            {/* Karta 1: Enterprise Value */}
                            <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-lg relative overflow-hidden">
                                <div className="flex items-center justify-between text-zinc-400 text-xs mb-1">
                                    <span className="font-semibold uppercase tracking-wider">Enterprise Value (EV)</span>
                                    <Building2 className="w-4 h-4 text-cyan-400" />
                                </div>
                                <div className="text-xl sm:text-2xl font-bold text-zinc-100 tracking-tight" data-testid="kpi-enterprise-value">
                                    {formatValue(valuationResult.enterpriseValue)}
                                </div>
                                <div className="text-[11px] text-zinc-400 mt-1 flex items-center justify-between">
                                    <span>Exit EBITDA:</span>
                                    <span className="text-zinc-200 font-semibold">{formatValue(valuationResult.exitEbitda)}</span>
                                </div>
                                <div className="text-[10px] text-zinc-500 mt-0.5">
                                    Mnożnik wyjścia: {valuationResult.exitMultiple.toFixed(1)}x EV/EBITDA
                                </div>
                            </div>

                            {/* Karta 2: Equity Value */}
                            <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-lg relative overflow-hidden">
                                <div className="flex items-center justify-between text-zinc-400 text-xs mb-1">
                                    <span className="font-semibold uppercase tracking-wider">Equity Value (EqV)</span>
                                    <Coins className="w-4 h-4 text-emerald-400" />
                                </div>
                                <div className="text-xl sm:text-2xl font-bold text-emerald-400 tracking-tight" data-testid="kpi-equity-value">
                                    {formatValue(valuationResult.equityValue)}
                                </div>
                                <div className="text-[11px] text-zinc-400 mt-1 flex items-center justify-between">
                                    <span>Dług Netto (Net Debt):</span>
                                    <span className={valuationResult.netDebtAtExit > 0 ? 'text-amber-400 font-semibold' : 'text-emerald-400 font-semibold'}>
                                        {formatValue(valuationResult.netDebtAtExit)}
                                    </span>
                                </div>
                                <div className="text-[10px] text-zinc-500 mt-0.5">
                                    Wpływy ze sprzedaży po spłacie długu
                                </div>
                            </div>

                            {/* Karta 3: Zwrot Inwestora (MoIC & IRR) */}
                            <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-lg relative overflow-hidden">
                                <div className="flex items-center justify-between text-zinc-400 text-xs mb-1">
                                    <span className="font-semibold uppercase tracking-wider">Zwrot Inwestora (Sponsor)</span>
                                    <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                                </div>
                                <div className="text-xl sm:text-2xl font-bold text-zinc-100 tracking-tight flex items-baseline gap-2">
                                    <span className="text-emerald-400" data-testid="kpi-equity-moic">{valuationResult.equityMoic.toFixed(2)}x</span>
                                    <span className="text-xs text-zinc-400 font-normal">MoIC</span>
                                    <span className="text-zinc-600">//</span>
                                    <span className="text-cyan-400 text-lg font-bold" data-testid="kpi-equity-irr">
                                        {valuationResult.equityIrrPercent !== null ? `${valuationResult.equityIrrPercent.toFixed(1)}%` : '—'}
                                    </span>
                                    <span className="text-xs text-zinc-400 font-normal">IRR</span>
                                </div>
                                <div className="text-[11px] text-zinc-400 mt-1 flex items-center justify-between">
                                    <span>Zysk Kapitałowy Netto:</span>
                                    <span className="text-emerald-400 font-semibold">+{formatValue(valuationResult.netCapitalGain)}</span>
                                </div>
                                <div className="text-[10px] text-zinc-500 mt-0.5">
                                    Wkład początkowy: {formatValue(valuationResult.initialEquity)}
                                </div>
                            </div>

                            {/* Karta 4: Buyer Yield */}
                            <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-lg relative overflow-hidden">
                                <div className="flex items-center justify-between text-zinc-400 text-xs mb-1">
                                    <span className="font-semibold uppercase tracking-wider">Yield Kupującego (Entry)</span>
                                    <Percent className="w-4 h-4 text-amber-400" />
                                </div>
                                <div className="text-xl sm:text-2xl font-bold text-amber-400 tracking-tight" data-testid="kpi-buyer-yield">
                                    {valuationResult.buyerEbitdaYieldPercent.toFixed(1)}%
                                </div>
                                <div className="text-[11px] text-zinc-400 mt-1 flex items-center justify-between">
                                    <span>Spread ponad WACC:</span>
                                    <span className={valuationResult.buyerYieldSpreadPercent >= 0 ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
                                        {valuationResult.buyerYieldSpreadPercent >= 0 ? `+${valuationResult.buyerYieldSpreadPercent.toFixed(1)} p.p.` : `${valuationResult.buyerYieldSpreadPercent.toFixed(1)} p.p.`}
                                    </span>
                                </div>
                                <div className="text-[10px] text-zinc-500 mt-0.5">
                                    FCFF Cash Yield: {valuationResult.buyerFcffYieldPercent.toFixed(1)}% | Zwrot EV: {valuationResult.buyerImpliedPaybackYears} lat
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Sub-tab Navigation */}
                    <div className="border-b border-zinc-800 flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setActiveSubTab('bridge')}
                            className={`px-3.5 py-2 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                                activeSubTab === 'bridge'
                                    ? 'border-emerald-400 text-zinc-100 bg-zinc-900/60'
                                    : 'border-transparent text-zinc-400 hover:text-zinc-200'
                            }`}
                        >
                            1. Most Wyceny (EV to Equity Bridge)
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveSubTab('buyer')}
                            className={`px-3.5 py-2 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                                activeSubTab === 'buyer'
                                    ? 'border-emerald-400 text-zinc-100 bg-zinc-900/60'
                                    : 'border-transparent text-zinc-400 hover:text-zinc-200'
                            }`}
                        >
                            2. Ekonomia Nabywcy (Buyer Economics)
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveSubTab('matrix')}
                            className={`px-3.5 py-2 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                                activeSubTab === 'matrix'
                                    ? 'border-emerald-400 text-zinc-100 bg-zinc-900/60'
                                    : 'border-transparent text-zinc-400 hover:text-zinc-200'
                            }`}
                        >
                            3. Macierz Wrażliwości Wyjścia (2D Matrix)
                        </button>
                    </div>

                    {/* Tab 1: Most Wyceny (EV to Equity Value Bridge) */}
                    {activeSubTab === 'bridge' && valuationResult && (
                        <div className="space-y-4">
                            <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-lg">
                                <h3 className="text-xs font-bold text-zinc-200 uppercase mb-3 flex items-center gap-2">
                                    <Scale className="w-4 h-4 text-emerald-400" />
                                    <span>Dekompozycja Wyceny i Struktura Zobowiązań na Dzień Wyjścia (Rok {exitYear})</span>
                                </h3>

                                <div className="space-y-2 text-xs">
                                    {/* Pozycja 1: Wycena Przedsiębiorstwa */}
                                    <div className="flex items-center justify-between p-2 rounded bg-zinc-900/60 border border-zinc-800">
                                        <div className="flex items-center gap-2">
                                            <span className="w-5 h-5 rounded bg-cyan-950 text-cyan-400 flex items-center justify-center font-bold text-[10px]">+</span>
                                            <span className="font-semibold text-zinc-200">Wycena Przedsiębiorstwa (Enterprise Value):</span>
                                            <span className="text-zinc-400 text-[11px]">EBITDA {formatValue(valuationResult.exitEbitda)} × {valuationResult.exitMultiple.toFixed(1)}x</span>
                                        </div>
                                        <span className="font-bold text-cyan-400">{formatValue(valuationResult.enterpriseValue)}</span>
                                    </div>

                                    {/* Pozycja 2: Dług Brutto */}
                                    <div className="flex items-center justify-between p-2 rounded bg-zinc-900/40 border border-zinc-800/80">
                                        <div className="flex items-center gap-2">
                                            <span className="w-5 h-5 rounded bg-rose-950 text-rose-400 flex items-center justify-center font-bold text-[10px]">-</span>
                                            <span className="text-zinc-300">Zadłużenie Kredytowe Senior Debt (Gross Debt):</span>
                                            <span className="text-zinc-500 text-[11px]">Stan kredytu na koniec roku {exitYear}</span>
                                        </div>
                                        <span className="font-semibold text-rose-400">-{formatValue(valuationResult.grossDebtAtExit)}</span>
                                    </div>

                                    {/* Pozycja 3: Gotówka */}
                                    <div className="flex items-center justify-between p-2 rounded bg-zinc-900/40 border border-zinc-800/80">
                                        <div className="flex items-center gap-2">
                                            <span className="w-5 h-5 rounded bg-emerald-950 text-emerald-400 flex items-center justify-center font-bold text-[10px]">+</span>
                                            <span className="text-zinc-300">Środki Pieniężne i Ekwiwalenty (Cash & Equivalents):</span>
                                            <span className="text-zinc-500 text-[11px]">Stan gotówki operacyjnej na koniec roku {exitYear}</span>
                                        </div>
                                        <span className="font-semibold text-emerald-400">+{formatValue(valuationResult.cashAtExit)}</span>
                                    </div>

                                    {/* Pozycja 4: Dług Netto */}
                                    <div className="flex items-center justify-between p-2 rounded bg-zinc-900/80 border border-zinc-800 font-semibold">
                                        <div className="flex items-center gap-2">
                                            <span className="text-zinc-500 ml-7">=</span>
                                            <span className="text-zinc-300">Dług Netto do Spłaty przy Transakcji (Net Debt):</span>
                                        </div>
                                        <span className={valuationResult.netDebtAtExit > 0 ? 'text-amber-400' : 'text-emerald-400'}>
                                            {formatValue(valuationResult.netDebtAtExit)}
                                        </span>
                                    </div>

                                    {/* Wynik: Wartość Kapitału Własnego */}
                                    <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/40 mt-3 font-bold text-sm">
                                        <div className="flex items-center gap-2">
                                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                            <span className="text-zinc-100 uppercase tracking-wider">Czysta Wartość Kapitału Własnego (Equity Value):</span>
                                            <span className="text-emerald-400/80 text-xs font-normal">Wpływy ze sprzedaży dla inwestorów</span>
                                        </div>
                                        <span className="text-emerald-400 text-base" data-testid="bridge-equity-value">{formatValue(valuationResult.equityValue)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Tab 2: Ekonomia Nabywcy (Buyer Economics) */}
                    {activeSubTab === 'buyer' && valuationResult && (
                        <div className="space-y-4">
                            <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-lg">
                                <h3 className="text-xs font-bold text-zinc-200 uppercase mb-3 flex items-center gap-2">
                                    <Percent className="w-4 h-4 text-amber-400" />
                                    <span>Rentowność i Atrakcyjność Transakcyjna z Perspektywy Nabywcy (Buyer Yield Profile)</span>
                                </h3>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="p-3 bg-zinc-900/70 border border-zinc-800 rounded">
                                        <span className="text-[11px] text-zinc-400 uppercase">Entry EBITDA Yield (Cap Rate)</span>
                                        <div className="text-lg font-bold text-amber-400 mt-0.5">
                                            {valuationResult.buyerEbitdaYieldPercent.toFixed(2)}%
                                        </div>
                                        <p className="text-[10px] text-zinc-500 mt-1">
                                            Odwrotność mnożnika EV (1 / {valuationResult.exitMultiple.toFixed(1)}x). Stopa zwrotu EBITDA na cenie zakupu.
                                        </p>
                                    </div>

                                    <div className="p-3 bg-zinc-900/70 border border-zinc-800 rounded">
                                        <span className="text-[11px] text-zinc-400 uppercase">Unlevered FCF Yield</span>
                                        <div className="text-lg font-bold text-cyan-400 mt-0.5">
                                            {valuationResult.buyerFcffYieldPercent.toFixed(2)}%
                                        </div>
                                        <p className="text-[10px] text-zinc-500 mt-1">
                                            Rentowność gotówkowa nowego właściciela (FCFF {formatValue(valuationResult.exitFcff)} / EV).
                                        </p>
                                    </div>

                                    <div className="p-3 bg-zinc-900/70 border border-zinc-800 rounded">
                                        <span className="text-[11px] text-zinc-400 uppercase">Levered Equity Cash Yield</span>
                                        <div className="text-lg font-bold text-emerald-400 mt-0.5">
                                            {valuationResult.buyerFcfeYieldPercent.toFixed(2)}%
                                        </div>
                                        <p className="text-[10px] text-zinc-500 mt-1">
                                            Rentowność gotówkowa kapitału własnego nabywcy (FCFE {formatValue(valuationResult.exitFcfe)} / EqV).
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-4 p-3 bg-zinc-900/40 border border-zinc-800/80 rounded flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-2">
                                        <Zap className="w-4 h-4 text-amber-400" />
                                        <span className="text-zinc-300">Ocena atrakcyjności dla kupującego:</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-zinc-400">
                                            Spread ponad koszt kapitału WACC:
                                        </span>
                                        <Badge variant={valuationResult.buyerYieldSpreadPercent >= 0 ? 'success' : 'danger'}>
                                            {valuationResult.buyerYieldSpreadPercent >= 0 ? `+${valuationResult.buyerYieldSpreadPercent.toFixed(1)} p.p.` : `${valuationResult.buyerYieldSpreadPercent.toFixed(1)} p.p.`}
                                        </Badge>
                                        <Badge variant={valuationResult.buyerImpliedPaybackYears <= 8.5 ? 'success' : 'warning'}>
                                            Zwrot EV: {valuationResult.buyerImpliedPaybackYears} lat
                                        </Badge>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Tab 3: Macierz Wrażliwości Wyjścia (2D Sensitivity Matrix) */}
                    {activeSubTab === 'matrix' && valuationResult && (
                        <div className="space-y-4">
                            <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-lg overflow-x-auto">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-xs font-bold text-zinc-200 uppercase flex items-center gap-2">
                                        <Layers className="w-4 h-4 text-emerald-400" />
                                        <span>Macierz Wrażliwości Wyceny: Mnożnik EV/EBITDA vs Rok Wyjścia</span>
                                    </h3>
                                    <span className="text-[11px] text-zinc-500">
                                        Kliknij komórkę, aby wybrać scenariusz wyjścia
                                    </span>
                                </div>

                                <table className="w-full text-xs text-left border-collapse" data-testid="exit-sensitivity-table">
                                    <thead>
                                        <tr className="border-b border-zinc-800 text-[11px] text-zinc-400 bg-zinc-900/80">
                                            <th className="p-2.5 font-bold uppercase">Mnożnik \ Rok</th>
                                            {valuationResult.sensitivityYears.map((yr) => (
                                                <th
                                                    key={yr}
                                                    className={`p-2.5 text-center font-bold uppercase ${
                                                        yr === exitYear ? 'text-emerald-400 bg-emerald-950/30' : ''
                                                    }`}
                                                >
                                                    Rok {yr}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-800/60">
                                        {valuationResult.sensitivityMultiples.map((mult, rowIdx) => {
                                            const isSelectedMult = Math.abs(mult - exitMultiple) < 0.05;
                                            return (
                                                <tr
                                                    key={mult}
                                                    className={isSelectedMult ? 'bg-zinc-900/60 font-semibold' : 'hover:bg-zinc-900/30'}
                                                >
                                                    <td className="p-2.5 font-bold text-zinc-200 bg-zinc-950">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className={isSelectedMult ? 'text-cyan-400' : 'text-zinc-400'}>
                                                                {mult.toFixed(1)}x
                                                            </span>
                                                            {isSelectedMult && (
                                                                <Badge variant="brand" className="text-[9px] px-1 py-0">BAZA</Badge>
                                                            )}
                                                        </div>
                                                    </td>

                                                    {valuationResult.sensitivityGrid[rowIdx].map((cell) => {
                                                        const isCurrent = cell.year === exitYear && Math.abs(cell.multiple - exitMultiple) < 0.05;
                                                        return (
                                                            <td
                                                                key={`${cell.year}-${cell.multiple}`}
                                                                onClick={() => {
                                                                    setExitYear(cell.year);
                                                                    setExitMultiple(cell.multiple);
                                                                }}
                                                                className={`p-2.5 text-center cursor-pointer transition-all ${
                                                                    isCurrent
                                                                        ? 'bg-emerald-950/60 border-2 border-emerald-500 rounded font-bold'
                                                                        : 'hover:bg-zinc-800/50'
                                                                }`}
                                                            >
                                                                <div className="text-[11px] text-zinc-100 font-semibold">
                                                                    {formatValue(cell.equityValue)}
                                                                </div>
                                                                <div className="text-[10px] flex items-center justify-center gap-1.5 mt-0.5">
                                                                    <span className="text-emerald-400 font-semibold">{cell.equityMoic.toFixed(2)}x</span>
                                                                    <span className="text-zinc-600">|</span>
                                                                    <span className="text-cyan-400">
                                                                        {cell.equityIrrPercent !== null ? `${cell.equityIrrPercent.toFixed(1)}%` : '—'}
                                                                    </span>
                                                                </div>
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default ExitValuationOverlay;
