import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    Layers,
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
    Users,
    ArrowDownRight,
    Divide
} from 'lucide-react';
import { useInvestmentProject } from '../../context/InvestmentProjectContext';
import { getInvestmentWorkerClient } from '../../workers/InvestmentWorkerClient';
import { calculateExitWaterfall } from '../../workers/financialCalculations';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Tooltip, InfoTooltip } from '../ui/Tooltip';

export const WATERFALL_EXIT_PRESETS = [
    { year: 3, label: 'Rok 3 (Early Exit)' },
    { year: 5, label: 'Rok 5 (Standard PE)' },
    { year: 7, label: 'Rok 7 (Infrastructure)' },
    { year: 10, label: 'Rok 10 (Long-Term)' },
    { year: 15, label: 'Rok 15 (Horyzont 15L)' },
];

export function ExitWaterfallVisualizer({ project: propProject, defaultOpen = true, className = '' }) {
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
                console.error('[ExitWaterfallVisualizer] Simulation calculation failed:', err);
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

    // Parametry modelu kaskadowego
    const initialMultiple = activeProject?.valuation_multiple?.multiple
        ? Number(activeProject.valuation_multiple.multiple)
        : 7.5;

    const [exitYear, setExitYear] = useState(5);
    const [exitMultiple, setExitMultiple] = useState(initialMultiple);
    const [structure, setStructure] = useState('pari_passu'); // 'pari_passu' | 'two_tier_hurdle'
    const [sponsorShare, setSponsorShare] = useState(60); // 60% Sponsor / 40% LP
    const [hurdleRate, setHurdleRate] = useState(8.0); // 8% p.a.
    const [carryShare, setCarryShare] = useState(80.0); // 80% carry to Sponsor in Tier 2
    const [scale, setScale] = useState('millions'); // 'full' | 'thousands' | 'millions'
    const [activeTab, setActiveTab] = useState('visualizer'); // 'visualizer' | 'comparison' | 'schedule'

    const currency = activeProject?.currency || 'PLN';
    const horizonYears = activeProject?.planning_horizon_years || 15;

    // Wyliczenie wyników kaskady
    const waterfallResult = useMemo(() => {
        if (!simulationData?.annualPeriods?.length) return null;

        const initialEquity = simulationData?.summary?.initialEquity ?? 0;

        return calculateExitWaterfall(
            simulationData.annualPeriods,
            initialEquity,
            currency,
            {
                exitYear,
                exitMultiple,
                structure,
                sponsorSharePercent: sponsorShare,
                hurdleRatePercent: hurdleRate,
                carrySharePercent: carryShare
            }
        );
    }, [simulationData, exitYear, exitMultiple, structure, sponsorShare, hurdleRate, carryShare, currency]);

    // Formatowanie waluty
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

    if (!activeProject) {
        return (
            <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-500 font-mono text-center">
                Brak aktywnego projektu do kalkulacji kaskady wyjścia.
            </div>
        );
    }

    return (
        <div className={`bg-zinc-900 border border-zinc-800 rounded-lg shadow-lg font-mono transition-all ${className}`} data-testid="exit-waterfall-visualizer">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-950/60 rounded-t-lg">
                <div className="flex items-center gap-3">
                    <Tooltip content="Wizualizator podziału wpływów transakcyjnych i dystrybucji zysków między inwestorów">
                        <div className="w-10 h-10 rounded-md bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0 cursor-help">
                            <Layers className="w-5 h-5" />
                        </div>
                    </Tooltip>
                    <div>
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                                ROZLICZENIE TRANSAKCJI M&A / PRIVATE EQUITY
                            </span>
                            <span className="text-zinc-600">//</span>
                            <span className="text-[10px] text-purple-400 font-semibold uppercase">
                                KASKADA WYJŚCIA & WATERFALL KAPITAŁU
                            </span>
                        </div>
                        <h2 className="text-sm sm:text-base font-bold text-zinc-100 flex items-center gap-2">
                            <span>Wizualizator Kaskady Wyjścia (Exit Waterfall)</span>
                            <span className="text-zinc-500 text-xs font-normal">| Rok {exitYear} ({structure === 'pari_passu' ? 'Pari Passu' : `Hurdle ${hurdleRate}%`})</span>
                        </h2>
                    </div>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                    {/* Header Summary Badges */}
                    {waterfallResult && (
                        <div className="hidden lg:flex items-center gap-2 text-xs bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1">
                            <Tooltip content="Zwrot Sponsora: Wielokrotność zysku z zainwestowanego kapitału własnego GP">
                                <span className="flex items-center gap-1 cursor-help">
                                    <span className="text-zinc-400">Sponsor MoIC:</span>
                                    <span className="text-emerald-400 font-bold">{waterfallResult.investor1.moic.toFixed(2)}x</span>
                                </span>
                            </Tooltip>
                            <span className="text-zinc-600">|</span>
                            <Tooltip content="Zwrot Partnera Finansowego (LP): Wielokrotność zwrotu z wkładu kapitałowego">
                                <span className="flex items-center gap-1 cursor-help">
                                    <span className="text-zinc-400">Partner MoIC:</span>
                                    <span className="text-purple-400 font-bold">{waterfallResult.investor2.moic.toFixed(2)}x</span>
                                </span>
                            </Tooltip>
                            <span className="text-zinc-600">|</span>
                            <Tooltip content="Łączna wartość kapitału własnego (Equity Value) dystrybuowana w kaskadzie">
                                <span className="flex items-center gap-1 cursor-help">
                                    <span className="text-zinc-400">Total EqV:</span>
                                    <span className="text-zinc-100 font-bold">{formatValue(waterfallResult.exitEquityValue)}</span>
                                </span>
                            </Tooltip>
                        </div>
                    )}

                    {/* Scale switcher */}
                    <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded p-0.5 text-[11px]">
                        <Tooltip content="Prezentuj kwoty w milionach">
                            <button
                                type="button"
                                onClick={() => setScale('millions')}
                                className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                                    scale === 'millions' ? 'bg-zinc-800 text-emerald-400 font-bold' : 'text-zinc-400 hover:text-zinc-200'
                                }`}
                            >
                                mln
                            </button>
                        </Tooltip>
                        <Tooltip content="Prezentuj kwoty w tysiącach">
                            <button
                                type="button"
                                onClick={() => setScale('thousands')}
                                className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                                    scale === 'thousands' ? 'bg-zinc-800 text-emerald-400 font-bold' : 'text-zinc-400 hover:text-zinc-200'
                                }`}
                            >
                                tys.
                            </button>
                        </Tooltip>
                        <Tooltip content="Prezentuj pełne kwoty w PLN">
                            <button
                                type="button"
                                onClick={() => setScale('full')}
                                className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                                    scale === 'full' ? 'bg-zinc-800 text-emerald-400 font-bold' : 'text-zinc-400 hover:text-zinc-200'
                                }`}
                            >
                                PLN
                            </button>
                        </Tooltip>
                    </div>

                    {/* Toggle button */}
                    <Tooltip content={isOpen ? "Zwiń sekcję kaskady wyjścia" : "Rozwiń wizualizator kaskady wyjścia"}>
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setIsOpen(!isOpen)}
                            className="gap-1.5 text-xs font-semibold"
                            aria-expanded={isOpen}
                            data-testid="toggle-waterfall-visualizer"
                        >
                            <span>{isOpen ? 'Zwiń Kaskadę' : 'Rozwiń Kaskadę'}</span>
                            {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </Button>
                    </Tooltip>
                </div>
            </div>

            {/* Collapsible Body */}
            {isOpen && (
                <div className="p-4 sm:p-6 space-y-6">
                    {/* Control Panel: Exit Year, Multiple, Structure, Share */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-zinc-950 border border-zinc-800/80 rounded-lg">
                        {/* Control 1: Rok Wyjścia */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5 uppercase">
                                    <Calendar className="w-3.5 h-3.5 text-purple-400" />
                                    <span>Rok Wyjścia:</span>
                                    <InfoTooltip
                                        title="Rok Wyjścia z Inwestycji"
                                        content="Moment zakończenia inwestycji kapitałowej i wypłaty wpływów transakcyjnych ze sprzedaży przedsiębiorstwa."
                                        ariaLabel="Objaśnienie roku wyjścia"
                                        size={12}
                                    />
                                </label>
                                <span className="text-xs font-bold text-purple-400" data-testid="waterfall-exit-year-display">
                                    Rok {exitYear}
                                </span>
                            </div>
                            <input
                                type="range"
                                min={1}
                                max={horizonYears}
                                step={1}
                                value={exitYear}
                                onChange={(e) => setExitYear(parseInt(e.target.value, 10))}
                                aria-label="Wybierz rok wyjścia kaskady"
                                data-testid="waterfall-year-slider"
                                className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-purple-500 focus:outline-none"
                            />
                            <div className="flex items-center gap-1 flex-wrap pt-0.5">
                                {WATERFALL_EXIT_PRESETS.filter(p => p.year <= horizonYears).map((preset) => (
                                    <Tooltip key={preset.year} content={`Ustaw horyzont wyjścia na: ${preset.label}`}>
                                        <button
                                            type="button"
                                            onClick={() => setExitYear(preset.year)}
                                            className={`px-1.5 py-0.5 text-[9px] rounded border transition-all cursor-pointer ${
                                                exitYear === preset.year
                                                    ? 'bg-purple-950/70 border-purple-500 text-purple-300 font-bold'
                                                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                                            }`}
                                        >
                                            Y{preset.year}
                                        </button>
                                    </Tooltip>
                                ))}
                            </div>
                        </div>

                        {/* Control 2: Mnożnik EV/EBITDA */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5 uppercase">
                                    <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                                    <span>Mnożnik EV:</span>
                                    <InfoTooltip
                                        title="Mnożnik Transakcyjny EV/EBITDA"
                                        content="Mnożnik wyceny całego przedsiębiorstwa stosowany przy kalkulacji ceny sprzedaży."
                                        ariaLabel="Objaśnienie mnożnika EV"
                                        size={12}
                                    />
                                </label>
                                <span className="text-xs font-bold text-cyan-400" data-testid="waterfall-multiple-display">
                                    {exitMultiple.toFixed(1)}x
                                </span>
                            </div>
                            <input
                                type="range"
                                min={3.0}
                                max={16.0}
                                step={0.25}
                                value={exitMultiple}
                                onChange={(e) => setExitMultiple(parseFloat(e.target.value))}
                                aria-label="Mnożnik wyceny kaskady"
                                data-testid="waterfall-multiple-slider"
                                className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-cyan-500 focus:outline-none"
                            />
                            <div className="flex items-center justify-between text-[10px] text-zinc-500 pt-0.5">
                                <span>3.0x</span>
                                <span>Bazowy: {initialMultiple.toFixed(1)}x</span>
                                <span>16.0x</span>
                            </div>
                        </div>

                        {/* Control 3: Struktura Wodospadu */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5 uppercase">
                                    <Divide className="w-3.5 h-3.5 text-emerald-400" />
                                    <span>Struktura Podziału:</span>
                                    <InfoTooltip
                                        title="Struktura Kaskady (Waterfall)"
                                        content="Model podziału zysków: Pari Passu (proporcjonalnie do udziałów kapitałowych) lub Two-Tier Hurdle (z premią carried interest dla Sponsora po przekroczeniu stopy progowej hurdle rate)."
                                        ariaLabel="Objaśnienie struktury kaskady"
                                        size={12}
                                    />
                                </label>
                            </div>
                            <Tooltip content="Wybierz formułę podziału wpływów transakcyjnych (Pari Passu lub Two-Tier Hurdle)">
                                <select
                                    value={structure}
                                    onChange={(e) => setStructure(e.target.value)}
                                    aria-label="Wybierz strukturę kaskady"
                                    data-testid="waterfall-structure-select"
                                    className="w-full bg-zinc-900 border border-zinc-700 text-zinc-100 text-xs rounded p-1.5 focus:outline-none cursor-pointer"
                                >
                                    <option value="pari_passu">Pari Passu (Pro-Rata)</option>
                                    <option value="two_tier_hurdle">Two-Tier Hurdle (Carry)</option>
                                </select>
                            </Tooltip>
                            {structure === 'two_tier_hurdle' ? (
                                <div className="flex items-center justify-between text-[10px] text-zinc-400 pt-0.5">
                                    <span>Hurdle: {hurdleRate.toFixed(1)}%</span>
                                    <span>Carry: {carryShare.toFixed(0)}% GP</span>
                                </div>
                            ) : (
                                <div className="text-[10px] text-zinc-500 pt-0.5">
                                    Podział ściśle pro-rata wg udziału kapitałowego
                                </div>
                            )}
                        </div>

                        {/* Control 4: Udział Sponsora */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5 uppercase">
                                    <Users className="w-3.5 h-3.5 text-amber-400" />
                                    <span>Udział Sponsora / LP:</span>
                                    <InfoTooltip
                                        title="Podział Kapitałowy Sponsora i Partnera"
                                        content="Początkowy udział kapitałowy Sponsora (GP) oraz Partnera Finansowego (LP) we wkładzie własnym."
                                        ariaLabel="Objaśnienie udziałów kapitałowych"
                                        size={12}
                                    />
                                </label>
                                <span className="text-xs font-bold text-amber-400" data-testid="waterfall-share-display">
                                    {sponsorShare}% / {100 - sponsorShare}%
                                </span>
                            </div>
                            <input
                                type="range"
                                min={10}
                                max={90}
                                step={5}
                                value={sponsorShare}
                                onChange={(e) => setSponsorShare(parseInt(e.target.value, 10))}
                                aria-label="Udział Sponsora w kapitale"
                                data-testid="waterfall-share-slider"
                                className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-500 focus:outline-none"
                            />
                            <div className="flex items-center justify-between text-[10px] text-zinc-400 pt-0.5">
                                <span className="text-emerald-400">Sponsor: {sponsorShare}%</span>
                                <span className="text-purple-400">Partner: {100 - sponsorShare}%</span>
                            </div>
                        </div>
                    </div>

                    {/* Sub-tab Navigation */}
                    <div className="border-b border-zinc-800 flex items-center gap-2 flex-wrap">
                        <Tooltip content="Wykres mostu kaskadowego od Enterprise Value przez spłatę długu do wypłat inwestorów">
                            <button
                                type="button"
                                onClick={() => setActiveTab('visualizer')}
                                className={`px-3.5 py-2 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                                    activeTab === 'visualizer'
                                        ? 'border-purple-400 text-zinc-100 bg-zinc-900/60'
                                        : 'border-transparent text-zinc-400 hover:text-zinc-200'
                                }`}
                            >
                                1. Wykres Kaskady (Waterfall Bridge)
                            </button>
                        </Tooltip>
                        <Tooltip content="Porównanie stóp zwrotu MoIC i IRR oraz zysków netto Sponsora i Partnera LP">
                            <button
                                type="button"
                                onClick={() => setActiveTab('comparison')}
                                className={`px-3.5 py-2 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                                    activeTab === 'comparison'
                                        ? 'border-purple-400 text-zinc-100 bg-zinc-900/60'
                                        : 'border-transparent text-zinc-400 hover:text-zinc-200'
                                }`}
                            >
                                2. Zwroty Inwestorów (Sponsor vs LP)
                            </button>
                        </Tooltip>
                        <Tooltip content="Szczegółowy harmonogram wypłat dywidend operacyjnych i wpływów ze sprzedaży w kolejnych latach">
                            <button
                                type="button"
                                onClick={() => setActiveTab('schedule')}
                                className={`px-3.5 py-2 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                                    activeTab === 'schedule'
                                        ? 'border-purple-400 text-zinc-100 bg-zinc-900/60'
                                        : 'border-transparent text-zinc-400 hover:text-zinc-200'
                                }`}
                            >
                                3. Harmonogram Wypłat Kaskadowych
                            </button>
                        </Tooltip>
                    </div>

                    {/* Tab 1: Kaskada Wizualna (Waterfall Bridge) */}
                    {activeTab === 'visualizer' && waterfallResult && (
                        <div className="space-y-4">
                            {/* Summary strip */}
                            <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-lg">
                                <h3 className="text-xs font-bold text-zinc-200 uppercase mb-4 flex items-center justify-between flex-wrap gap-2">
                                    <span className="flex items-center gap-2">
                                        <Layers className="w-4 h-4 text-purple-400" />
                                        <span>Kaskada Przejścia: Wycena EV &rarr; Spłata Długu Netto &rarr; Wpływy dla Inwestorów</span>
                                    </span>
                                    <span className="text-[11px] text-zinc-400 font-normal">
                                        Exit Year {waterfallResult.exitYear} @ {waterfallResult.exitMultiple.toFixed(1)}x EV/EBITDA
                                    </span>
                                </h3>

                                {/* Visual Horizontal Waterfall Bars */}
                                <div className="space-y-3" data-testid="waterfall-bars-container">
                                    {waterfallResult.waterfallSteps.map((step) => {
                                        const maxAmount = Math.max(...waterfallResult.waterfallSteps.map(s => Math.abs(s.amount)), 1);
                                        const widthPercent = Math.max(5, Math.min(100, Math.round((Math.abs(step.amount) / maxAmount) * 100)));

                                        let barColorClass = 'bg-cyan-500';
                                        let textColorClass = 'text-cyan-400';
                                        let signPrefix = '';

                                        if (step.category === 'ev') {
                                            barColorClass = 'bg-cyan-500/80';
                                            textColorClass = 'text-cyan-400';
                                            signPrefix = '+';
                                        } else if (step.category === 'debt') {
                                            barColorClass = 'bg-rose-500/80';
                                            textColorClass = 'text-rose-400';
                                            signPrefix = '';
                                        } else if (step.category === 'cash') {
                                            barColorClass = 'bg-emerald-500/80';
                                            textColorClass = 'text-emerald-400';
                                            signPrefix = '+';
                                        } else if (step.category === 'equity') {
                                            barColorClass = 'bg-amber-500/90';
                                            textColorClass = 'text-amber-400';
                                            signPrefix = '=';
                                        } else if (step.category === 'sponsor') {
                                            barColorClass = 'bg-emerald-500';
                                            textColorClass = 'text-emerald-400';
                                            signPrefix = '->';
                                        } else if (step.category === 'partner') {
                                            barColorClass = 'bg-purple-500';
                                            textColorClass = 'text-purple-400';
                                            signPrefix = '->';
                                        }

                                        return (
                                            <Tooltip key={step.id} content={`${step.label}: ${formatValue(step.amount)} (Saldo po operacji: ${formatValue(step.runningBalance)})`}>
                                                <div className="space-y-1 cursor-help">
                                                    <div className="flex items-center justify-between text-xs">
                                                        <span className="font-semibold text-zinc-300 flex items-center gap-1.5">
                                                            <span className={`text-[11px] font-bold ${textColorClass}`}>{signPrefix}</span>
                                                            <span>{step.label}</span>
                                                        </span>
                                                        <div className="flex items-center gap-3">
                                                            <span className={`font-bold ${textColorClass}`}>
                                                                {formatValue(step.amount)}
                                                            </span>
                                                            <span className="text-[10px] text-zinc-500">
                                                                (Saldo: {formatValue(step.runningBalance)})
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* Bar */}
                                                    <div className="h-3 w-full bg-zinc-900 rounded overflow-hidden">
                                                        <div
                                                            className={`h-full rounded transition-all duration-300 ${barColorClass}`}
                                                            style={{ width: `${widthPercent}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </Tooltip>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Tab 2: Porównanie Zwrotów (Sponsor vs LP) */}
                    {activeTab === 'comparison' && waterfallResult && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                {/* Inwestor 1: Sponsor / GP */}
                                <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-lg space-y-3" data-testid="sponsor-card">
                                    <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full bg-emerald-400" />
                                            <h4 className="text-xs font-bold text-zinc-100 uppercase">
                                                {waterfallResult.investor1.name}
                                            </h4>
                                        </div>
                                        <Badge variant="brand">{waterfallResult.investor1.sharePercent.toFixed(0)}% UDZIAŁU</Badge>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                        <Tooltip content="Wartość początkowego wkładu kapitałowego wniesionego przez Sponsora">
                                            <div className="p-2.5 bg-zinc-900/60 rounded border border-zinc-800/80 cursor-help">
                                                <span className="text-[10px] text-zinc-400 uppercase">Wkład Własny (Equity)</span>
                                                <div className="text-sm font-bold text-zinc-100 mt-0.5">
                                                    {formatValue(waterfallResult.investor1.initialEquity)}
                                                </div>
                                            </div>
                                        </Tooltip>

                                        <Tooltip content="Wpływy ze sprzedaży przedsiębiorstwa w roku wyjścia przypadające Sponsorowi">
                                            <div className="p-2.5 bg-zinc-900/60 rounded border border-zinc-800/80 cursor-help">
                                                <span className="text-[10px] text-zinc-400 uppercase">Wpływy ze Sprzedaży (Exit)</span>
                                                <div className="text-sm font-bold text-emerald-400 mt-0.5" data-testid="sponsor-exit-proceeds">
                                                    {formatValue(waterfallResult.investor1.exitProceeds)}
                                                </div>
                                            </div>
                                        </Tooltip>

                                        <Tooltip content="Skumulowane dywidendy i wypłaty operacyjne otrzymane przed momentem sprzedaży">
                                            <div className="p-2.5 bg-zinc-900/60 rounded border border-zinc-800/80 cursor-help">
                                                <span className="text-[10px] text-zinc-400 uppercase">Wypłaty Operacyjne (Pre-Exit)</span>
                                                <div className="text-sm font-bold text-zinc-300 mt-0.5">
                                                    {formatValue(waterfallResult.investor1.preExitDistributions)}
                                                </div>
                                            </div>
                                        </Tooltip>

                                        <Tooltip content="Całkowita suma przepływów pieniężnych uzyskanych przez Sponsora z inwestycji">
                                            <div className="p-2.5 bg-zinc-900/60 rounded border border-zinc-800/80 cursor-help">
                                                <span className="text-[10px] text-zinc-400 uppercase">Łączne Wpływy (Total)</span>
                                                <div className="text-sm font-bold text-zinc-100 mt-0.5">
                                                    {formatValue(waterfallResult.investor1.totalProceeds)}
                                                </div>
                                            </div>
                                        </Tooltip>
                                    </div>

                                    <div className="p-3 bg-emerald-950/30 border border-emerald-500/30 rounded-lg flex items-center justify-between text-xs">
                                        <div>
                                            <span className="text-[10px] text-zinc-400 uppercase">Wskaźniki Zwrotu Sponsora</span>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <Tooltip content="Mnożnik zwrotu z wkładu własnego (Total Proceeds / Initial Equity)">
                                                    <span className="text-base font-bold text-emerald-400 cursor-help" data-testid="sponsor-moic">
                                                        {waterfallResult.investor1.moic.toFixed(2)}x MoIC
                                                    </span>
                                                </Tooltip>
                                                <span className="text-zinc-600">//</span>
                                                <Tooltip content="Roczna stopa zwrotu (Internal Rate of Return) z uwzględnieniem harmonogramu przepływów">
                                                    <span className="text-sm font-bold text-cyan-400 cursor-help" data-testid="sponsor-irr">
                                                        {waterfallResult.investor1.irrPercent !== null ? `${waterfallResult.investor1.irrPercent.toFixed(1)}% IRR` : '—'}
                                                    </span>
                                                </Tooltip>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-[10px] text-zinc-400 uppercase">Zysk Netto</span>
                                            <div className="text-sm font-bold text-emerald-400">
                                                +{formatValue(waterfallResult.investor1.netGain)}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Inwestor 2: Partner Finansowy / LP */}
                                <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-lg space-y-3" data-testid="partner-card">
                                    <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full bg-purple-400" />
                                            <h4 className="text-xs font-bold text-zinc-100 uppercase">
                                                {waterfallResult.investor2.name}
                                            </h4>
                                        </div>
                                        <Badge variant="secondary">{waterfallResult.investor2.sharePercent.toFixed(0)}% UDZIAŁU</Badge>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                        <Tooltip content="Wartość początkowego wkładu kapitałowego wniesionego przez Partnera Finansowego (LP)">
                                            <div className="p-2.5 bg-zinc-900/60 rounded border border-zinc-800/80 cursor-help">
                                                <span className="text-[10px] text-zinc-400 uppercase">Wkład Własny (Equity)</span>
                                                <div className="text-sm font-bold text-zinc-100 mt-0.5">
                                                    {formatValue(waterfallResult.investor2.initialEquity)}
                                                </div>
                                            </div>
                                        </Tooltip>

                                        <Tooltip content="Wpływy ze sprzedaży przedsiębiorstwa w roku wyjścia przypadające Partnerowi Finansowemu">
                                            <div className="p-2.5 bg-zinc-900/60 rounded border border-zinc-800/80 cursor-help">
                                                <span className="text-[10px] text-zinc-400 uppercase">Wpływy ze Sprzedaży (Exit)</span>
                                                <div className="text-sm font-bold text-purple-400 mt-0.5" data-testid="partner-exit-proceeds">
                                                    {formatValue(waterfallResult.investor2.exitProceeds)}
                                                </div>
                                            </div>
                                        </Tooltip>

                                        <Tooltip content="Skumulowane dywidendy i wypłaty operacyjne otrzymane przez Partnera Finansowego">
                                            <div className="p-2.5 bg-zinc-900/60 rounded border border-zinc-800/80 cursor-help">
                                                <span className="text-[10px] text-zinc-400 uppercase">Wypłaty Operacyjne (Pre-Exit)</span>
                                                <div className="text-sm font-bold text-zinc-300 mt-0.5">
                                                    {formatValue(waterfallResult.investor2.preExitDistributions)}
                                                </div>
                                            </div>
                                        </Tooltip>

                                        <Tooltip content="Całkowita suma przepływów pieniężnych uzyskanych przez Partnera Finansowego z inwestycji">
                                            <div className="p-2.5 bg-zinc-900/60 rounded border border-zinc-800/80 cursor-help">
                                                <span className="text-[10px] text-zinc-400 uppercase">Łączne Wpływy (Total)</span>
                                                <div className="text-sm font-bold text-zinc-100 mt-0.5">
                                                    {formatValue(waterfallResult.investor2.totalProceeds)}
                                                </div>
                                            </div>
                                        </Tooltip>
                                    </div>

                                    <div className="p-3 bg-purple-950/30 border border-purple-500/30 rounded-lg flex items-center justify-between text-xs">
                                        <div>
                                            <span className="text-[10px] text-zinc-400 uppercase">Wskaźniki Zwrotu Partnera</span>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <Tooltip content="Mnożnik zwrotu z wkładu kapitałowego Partnera Finansowego LP">
                                                    <span className="text-base font-bold text-purple-400 cursor-help" data-testid="partner-moic">
                                                        {waterfallResult.investor2.moic.toFixed(2)}x MoIC
                                                    </span>
                                                </Tooltip>
                                                <span className="text-zinc-600">//</span>
                                                <Tooltip content="Roczna stopa zwrotu (IRR) Partnera Finansowego">
                                                    <span className="text-sm font-bold text-cyan-400 cursor-help" data-testid="partner-irr">
                                                        {waterfallResult.investor2.irrPercent !== null ? `${waterfallResult.investor2.irrPercent.toFixed(1)}% IRR` : '—'}
                                                    </span>
                                                </Tooltip>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-[10px] text-zinc-400 uppercase">Zysk Netto</span>
                                            <div className="text-sm font-bold text-purple-400">
                                                +{formatValue(waterfallResult.investor2.netGain)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Tab 3: Harmonogram Wypłat Kaskadowych */}
                    {activeTab === 'schedule' && waterfallResult && (
                        <div className="space-y-4">
                            <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-lg overflow-x-auto">
                                <h3 className="text-xs font-bold text-zinc-200 uppercase mb-3 flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-purple-400" />
                                    <span>Roczna Dystrybucja Przepływów Pomiędzy Inwestorami do Roku {exitYear}</span>
                                </h3>

                                <table className="w-full text-xs text-left border-collapse" data-testid="waterfall-schedule-table">
                                    <thead>
                                        <tr className="border-b border-zinc-800 text-[11px] text-zinc-400 bg-zinc-900/80">
                                            <th className="p-2.5 font-bold uppercase">
                                                <Tooltip content="Kolejny rok inwestycji lub moment wkładu początkowego">
                                                    <span className="cursor-help">Okres</span>
                                                </Tooltip>
                                            </th>
                                            <th className="p-2.5 text-right font-bold uppercase">
                                                <Tooltip content="Przepływy pieniężne przypadające Sponsorowi (GP)">
                                                    <span className="cursor-help">Sponsor (Inv 1)</span>
                                                </Tooltip>
                                            </th>
                                            <th className="p-2.5 text-right font-bold uppercase">
                                                <Tooltip content="Przepływy pieniężne przypadające Partnerowi Finansowemu (LP)">
                                                    <span className="cursor-help">Partner (Inv 2)</span>
                                                </Tooltip>
                                            </th>
                                            <th className="p-2.5 text-right font-bold uppercase">
                                                <Tooltip content="Łączna roczna suma dystrybucji do wszystkich wspólników">
                                                    <span className="cursor-help">Łącznie Dystrybucja</span>
                                                </Tooltip>
                                            </th>
                                            <th className="p-2.5 text-center font-bold uppercase">
                                                <Tooltip content="Charakter przepływu: wkład kapitałowy, dywidenda bieżąca lub dezinwestycja">
                                                    <span className="cursor-help">Typ Przepływu</span>
                                                </Tooltip>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-800/60">
                                        <tr className="bg-zinc-900/40 font-semibold">
                                            <td className="p-2.5 text-zinc-400 font-bold">t=0 (Wkład)</td>
                                            <td className="p-2.5 text-right text-rose-400">-{formatValue(waterfallResult.investor1.initialEquity)}</td>
                                            <td className="p-2.5 text-right text-rose-400">-{formatValue(waterfallResult.investor2.initialEquity)}</td>
                                            <td className="p-2.5 text-right text-rose-400">-{formatValue(waterfallResult.initialEquityTotal)}</td>
                                            <td className="p-2.5 text-center"><Badge variant="default">Wkład Początkowy</Badge></td>
                                        </tr>

                                        {Array.from({ length: exitYear }, (_, i) => i + 1).map((yr) => {
                                            const isExit = yr === exitYear;
                                            return (
                                                <tr key={yr} className={isExit ? 'bg-emerald-950/20 font-bold' : 'hover:bg-zinc-900/20'}>
                                                    <td className="p-2.5 text-zinc-200">
                                                        Rok {yr} {isExit && <span className="text-emerald-400 font-semibold ml-1">(EXIT)</span>}
                                                    </td>
                                                    <td className="p-2.5 text-right text-emerald-400">
                                                        {formatValue(isExit ? waterfallResult.investor1.exitProceeds : waterfallResult.investor1.preExitDistributions / Math.max(1, exitYear - 1))}
                                                    </td>
                                                    <td className="p-2.5 text-right text-purple-400">
                                                        {formatValue(isExit ? waterfallResult.investor2.exitProceeds : waterfallResult.investor2.preExitDistributions / Math.max(1, exitYear - 1))}
                                                    </td>
                                                    <td className="p-2.5 text-right text-zinc-100">
                                                        {formatValue(isExit ? waterfallResult.exitProceedsTotal : waterfallResult.preExitDistributionsTotal / Math.max(1, exitYear - 1))}
                                                    </td>
                                                    <td className="p-2.5 text-center">
                                                        <Badge variant={isExit ? 'success' : 'secondary'}>
                                                            {isExit ? 'Wpływy ze Sprzedaży (Exit)' : 'Dywidenda Operacyjna'}
                                                        </Badge>
                                                    </td>
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

export default ExitWaterfallVisualizer;
