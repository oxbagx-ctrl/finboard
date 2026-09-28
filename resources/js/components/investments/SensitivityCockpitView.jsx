import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
    Sliders,
    TrendingUp,
    TrendingDown,
    Activity,
    RotateCcw,
    AlertTriangle,
    ShieldCheck,
    CheckCircle2,
    Zap,
    ArrowRight,
    BarChart3,
    HelpCircle,
    Layers,
    DollarSign,
    Coins,
    Building2,
    Clock,
    RefreshCw
} from 'lucide-react';
import {
    ResponsiveContainer,
    ComposedChart,
    Bar,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend
} from 'recharts';
import { useInvestmentProject } from '../../context/InvestmentProjectContext';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Card, MetricCard } from '../ui/Card';
import { CustomChartTooltip } from '../charts/CustomChartTooltip';
import { getInvestmentWorkerClient } from '../../workers/InvestmentWorkerClient';
import { ReinvestmentManager } from './ReinvestmentManager';
import { ScenarioPresetSelector, SCENARIO_PRESETS } from './ScenarioPresetSelector';
import { DebtRepaymentModeSwitcher } from './DebtRepaymentModeSwitcher';
import { InfoTooltip, Tooltip as UiTooltip } from '../ui/Tooltip';
import { useTheme } from '../../context/ThemeContext';

export const SensitivityCockpitView = () => {
    const { isDark } = useTheme();
    const gridStroke = isDark ? '#27272a' : '#e4e4e7';
    const axisLineStroke = isDark ? '#3f3f46' : '#d4d4d8';
    const chartCursorFill = isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)';

    const { selectedProject } = useInvestmentProject();

    // What-If Sliders State (Percentage Deltas)
    const [capexDelta, setCapexDelta] = useState(0);       // -30% .. +50%
    const [revenueDelta, setRevenueDelta] = useState(0);   // -30% .. +30%
    const [varCostDelta, setVarCostDelta] = useState(0);   // -20% .. +30%
    const [fixedCostDelta, setFixedCostDelta] = useState(0); // -20% .. +30%
    const [payrollDelta, setPayrollDelta] = useState(0);   // -15% .. +30%
    const [reinvestmentDelta, setReinvestmentDelta] = useState(0); // -50% .. +50%
    const [reinvestmentsEnabled, setReinvestmentsEnabled] = useState(true);
    const [showReinvestmentDetails, setShowReinvestmentDetails] = useState(false);
    const [waccOverride, setWaccOverride] = useState(null); // null or number (4.0 .. 18.0)
    const [repaymentTypeOverride, setRepaymentTypeOverride] = useState(null); // 'annuity' | 'linear' | 'bullet' | null
    const [activeScenario, setActiveScenario] = useState('base');

    // Chart Mode: 'nominal' (P&L and CF) vs 'discounted' (DCF & NPV)
    const [chartMode, setChartMode] = useState('nominal');

    // Visual Anchoring: Glow highlight on top KPI cards when WACC slider is adjusted
    const [isWaccHighlightActive, setIsWaccHighlightActive] = useState(false);
    const waccHighlightTimeoutRef = useRef(null);

    // Simulation calculation results
    const [baseResult, setBaseResult] = useState(null);
    const [whatIfResult, setWhatIfResult] = useState(null);
    const [calculating, setCalculating] = useState(false);
    const [lastExecutionMs, setLastExecutionMs] = useState(0);

    const workerClient = useMemo(() => getInvestmentWorkerClient(), []);

    // Format currency helper
    const formatMoney = useCallback((val, curr = selectedProject?.currency || 'PLN') => {
        if (val === null || val === undefined || isNaN(val)) return '0,00 ' + curr;
        return new Intl.NumberFormat('pl-PL', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(val) + ' ' + curr;
    }, [selectedProject]);

    // Format percent helper
    const formatPercent = (val) => {
        if (val === null || val === undefined || isNaN(val)) return '—';
        return `${Number(val).toFixed(2)}%`;
    };

    // Format reinvestment summary helper (compact institutional notation)
    const formatReinvestmentSummary = useCallback((val, curr = selectedProject?.currency || 'PLN') => {
        if (!val || val <= 0) return '0,00 ' + curr;
        if (Math.abs(val) >= 1_000_000) {
            return `${(val / 1_000_000).toFixed(2).replace('.', ',')} mln ${curr}`;
        }
        if (Math.abs(val) >= 1_000) {
            return `${(val / 1_000).toFixed(1).replace('.', ',')} tys. ${curr}`;
        }
        return formatMoney(val, curr);
    }, [selectedProject, formatMoney]);

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (waccHighlightTimeoutRef.current) {
                clearTimeout(waccHighlightTimeoutRef.current);
            }
        };
    }, []);

    // Trigger Visual Anchoring glow on WACC changes
    const triggerWaccHighlight = useCallback(() => {
        setIsWaccHighlightActive(true);
        if (waccHighlightTimeoutRef.current) {
            clearTimeout(waccHighlightTimeoutRef.current);
        }
        waccHighlightTimeoutRef.current = setTimeout(() => {
            setIsWaccHighlightActive(false);
        }, 1200);
    }, []);

    // Calculate baseline scenario
    useEffect(() => {
        if (!selectedProject) {
            setBaseResult(null);
            setWhatIfResult(null);
            return;
        }

        let isMounted = true;
        setCalculating(true);

        workerClient.simulate(selectedProject, selectedProject.operating_assumptions, {})
            .then((res) => {
                if (isMounted) {
                    setBaseResult(res);
                }
            })
            .catch((err) => {
                console.error('[SensitivityCockpitView] Baseline calculation failed:', err);
            })
            .finally(() => {
                if (isMounted) setCalculating(false);
            });

        return () => {
            isMounted = false;
        };
    }, [selectedProject, workerClient]);

    // Recalculate What-If scenario when sliders change
    useEffect(() => {
        if (!selectedProject) return;

        let isMounted = true;
        setCalculating(true);

        const overrides = {
            capexMultiplier: 1.0 + capexDelta / 100.0,
            revenueMultiplier: 1.0 + revenueDelta / 100.0,
            variableCostMultiplier: 1.0 + varCostDelta / 100.0,
            fixedCostMultiplier: 1.0 + fixedCostDelta / 100.0,
            payrollMultiplier: 1.0 + payrollDelta / 100.0,
            reinvestmentMultiplier: 1.0 + reinvestmentDelta / 100.0,
            reinvestmentsEnabled: reinvestmentsEnabled,
            waccOverridePercent: waccOverride,
            repaymentTypeOverride: repaymentTypeOverride,
        };

        const t0 = performance.now();
        workerClient.simulate(selectedProject, selectedProject.operating_assumptions, overrides)
            .then((res) => {
                if (isMounted) {
                    setWhatIfResult(res);
                    const t1 = performance.now();
                    setLastExecutionMs(Math.round((t1 - t0) * 100) / 100);
                }
            })
            .catch((err) => {
                console.error('[SensitivityCockpitView] What-If simulation failed:', err);
            })
            .finally(() => {
                if (isMounted) setCalculating(false);
            });

        return () => {
            isMounted = false;
        };
    }, [
        selectedProject,
        capexDelta,
        revenueDelta,
        varCostDelta,
        fixedCostDelta,
        payrollDelta,
        reinvestmentDelta,
        reinvestmentsEnabled,
        waccOverride,
        repaymentTypeOverride,
        workerClient
    ]);

    // Scenario Selection Handler
    const handleSelectScenario = (scenarioId, deltas) => {
        setCapexDelta(deltas.capexDelta ?? 0);
        setRevenueDelta(deltas.revenueDelta ?? 0);
        setVarCostDelta(deltas.varCostDelta ?? 0);
        setFixedCostDelta(deltas.fixedCostDelta ?? 0);
        setPayrollDelta(deltas.payrollDelta ?? 0);
        setReinvestmentDelta(deltas.reinvestmentDelta ?? 0);
        setReinvestmentsEnabled(true);
        setWaccOverride(deltas.waccOverride ?? null);
        if (deltas.repaymentTypeOverride !== undefined) {
            setRepaymentTypeOverride(deltas.repaymentTypeOverride);
        }
        setActiveScenario(scenarioId);
    };

    const handleResetAll = () => {
        setCapexDelta(0);
        setRevenueDelta(0);
        setVarCostDelta(0);
        setFixedCostDelta(0);
        setPayrollDelta(0);
        setReinvestmentDelta(0);
        setReinvestmentsEnabled(true);
        setWaccOverride(null);
        setRepaymentTypeOverride(null);
        setActiveScenario('base');
    };

    // Legacy handler aliases for tests and quick buttons
    const applyBaseScenario = () => handleResetAll();
    const applyOptimisticScenario = () => handleSelectScenario('optimistic', SCENARIO_PRESETS.find(p => p.id === 'optimistic')?.deltas || {});
    const applyPessimisticScenario = () => handleSelectScenario('pessimistic', SCENARIO_PRESETS.find(p => p.id === 'pessimistic')?.deltas || {});
    const applyWageShockScenario = () => handleSelectScenario('wage_shock', SCENARIO_PRESETS.find(p => p.id === 'wage_shock')?.deltas || {});

    // Calculate deltas between What-If and Base
    const deltas = useMemo(() => {
        if (!baseResult || !whatIfResult) return null;

        const baseNpv = baseResult.summary.projectNpv || 0;
        const whatIfNpv = whatIfResult.summary.projectNpv || 0;
        const npvDiff = whatIfNpv - baseNpv;
        const npvDiffPct = baseNpv !== 0 ? (npvDiff / Math.abs(baseNpv)) * 100 : 0;

        const baseIrr = baseResult.summary.projectIrrPercent ?? 0;
        const whatIfIrr = whatIfResult.summary.projectIrrPercent ?? 0;
        const irrDiff = whatIfIrr - baseIrr;

        const baseCapex = baseResult.summary.totalCapex || 0;
        const whatIfCapex = whatIfResult.summary.totalCapex || 0;
        const capexDiff = whatIfCapex - baseCapex;
        const capexDiffPct = baseCapex !== 0 ? (capexDiff / baseCapex) * 100 : 0;

        const baseMoic = baseResult.summary.equityMoic || 0;
        const whatIfMoic = whatIfResult.summary.equityMoic || 0;
        const moicDiff = whatIfMoic - baseMoic;

        const baseMinDscr = baseResult.summary.minDscr ?? 0;
        const whatIfMinDscr = whatIfResult.summary.minDscr ?? 0;
        const dscrDiff = whatIfMinDscr - baseMinDscr;

        return {
            npvDiff,
            npvDiffPct,
            irrDiff,
            capexDiff,
            capexDiffPct,
            moicDiff,
            dscrDiff
        };
    }, [baseResult, whatIfResult]);

    // Chart data for 15-year financial evolution (Nominal P&L/CF and Discounted DCF/NPV)
    const chartData = useMemo(() => {
        if (!whatIfResult?.annualPeriods) return [];

        const effectiveWaccDecimal = (waccOverride !== null
            ? waccOverride
            : (whatIfResult?.appraisal?.waccPercent ?? baseResult?.appraisal?.waccPercent ?? 8.50)) / 100.0;

        let cumulativeNpv = 0;

        return whatIfResult.annualPeriods.map((p) => {
            // Detect if this year contains cyclical reinvestment CAPEX
            const isReinvestmentYear = reinvestmentsEnabled && p.year > 1 && (p.capex > 0);
            const label = isReinvestmentYear ? `Rok ${p.year} (CAPEX)` : `Rok ${p.year}`;

            // Discount factor: df = 1 / (1 + WACC)^t
            const df = Math.pow(1.0 + effectiveWaccDecimal, -p.year);
            const discFcff = Math.round(p.fcff * df);
            cumulativeNpv += discFcff;

            return {
                label,
                year: p.year,
                isReinvestmentYear,
                'Przychody': Math.round(p.revenue),
                'Koszty OPEX': Math.round(p.totalOpex),
                'CAPEX & Reinwestycje': Math.round(p.capex || 0),
                'EBITDA': Math.round(p.ebitda),
                'Free Cash Flow (FCFF)': Math.round(p.fcff),
                'Zdyskontowany FCFF': discFcff,
                'Skumulowane NPV': cumulativeNpv,
                'Dług Końcowy': Math.round(p.closingDebt),
            };
        });
    }, [whatIfResult, baseResult, waccOverride, reinvestmentsEnabled]);

    const formatYAxis = (val) => {
        if (Math.abs(val) >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
        if (Math.abs(val) >= 1000) return `${(val / 1000).toFixed(0)}k`;
        return val;
    };

    if (!selectedProject) {
        return (
            <Card>
                <div className="py-12 text-center text-zinc-500 font-mono text-xs">
                    <Activity className="w-8 h-8 mx-auto text-zinc-600 mb-3 animate-pulse" />
                    <p className="font-semibold text-zinc-300 uppercase tracking-wide">
                        Brak Wybranego Projektu Inwestycyjnego
                    </p>
                    <p className="text-[11px] text-zinc-500 mt-1">
                        Wybierz projekt z listy powyżej lub zainicjalizuj nowy, aby uruchomić symulator What-If.
                    </p>
                </div>
            </Card>
        );
    }

    const currentNpv = whatIfResult?.summary?.projectNpv ?? 0;
    const currentIrr = whatIfResult?.summary?.projectIrrPercent;
    const currentWacc = waccOverride !== null ? waccOverride : (whatIfResult?.appraisal?.waccPercent ?? 8.5);
    const currentMoic = whatIfResult?.summary?.equityMoic ?? 0;
    const currentMinDscr = whatIfResult?.summary?.minDscr;
    const currentAvgDscr = whatIfResult?.summary?.avgDscr;
    const isBankable = whatIfResult?.appraisal?.isBankable ?? false;

    // Current total 15-year reinvestment capex
    const currentReinvestmentCapex = reinvestmentsEnabled
        ? (whatIfResult?.summary?.totalReinvestmentCapex ?? baseResult?.summary?.totalReinvestmentCapex ?? 0)
        : 0;

    // Visual anchoring glow class for WACC-sensitive KPI metrics
    const waccGlowClass = isWaccHighlightActive
        ? 'ring-2 ring-blue-500/70 border-blue-500/80 shadow-[0_0_15px_rgba(59,130,246,0.35)]'
        : 'border-zinc-800';

    return (
        <div className="space-y-6 font-mono">
            {/* Header & Scenario Control Strip */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <UiTooltip content="Moduł symulacji wielowariantowej What-If i analizy wrażliwości Project Finance">
                        <div className="w-10 h-10 rounded bg-emerald-950/80 border border-emerald-800/80 flex items-center justify-center text-emerald-400">
                            <Activity className="w-5 h-5" />
                        </div>
                    </UiTooltip>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-sm font-bold text-zinc-100 uppercase tracking-wide">
                                Cockpit Analizy Wrażliwości & Symulator What-If
                            </h2>
                            <InfoTooltip
                                size="sm"
                                content="Interaktywny symulator analizy wrażliwości Project Finance. Umożliwia dynamiczne testowanie odporności projektu na wstrząsy popytowe, inflacyjne, kosztowe (CAPEX/OPEX), zmiany stóp procentowych (WACC) oraz alternatywne profile obsługi długu bankowego."
                                ariaLabel="Informacje o symulatorze What-If"
                            />
                            <UiTooltip content="Wielowątkowe obliczenia modelu finansowego przeliczane asynchronicznie w tle w czasie rzeczywistym">
                                <Badge variant="brand">REAL-TIME</Badge>
                            </UiTooltip>
                        </div>
                        <p className="text-[11px] text-zinc-400 mt-0.5">
                            Reaktywny silnik Web Workera przeliczający 15-letni model (180 miesięcy) i wskaźniki bankowalności
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Execution Time Badge */}
                    <UiTooltip content="Czas wykonania pełnej symulacji 15-letniego modelu (180 miesięcy) przez dedykowanego Web Workera w przeglądarce">
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-zinc-950 border border-zinc-800 text-[11px] text-zinc-400">
                            <Zap className="w-3.5 h-3.5 text-amber-400" />
                            <span>Worker:</span>
                            <span className="font-bold text-zinc-200">{lastExecutionMs || 1.8} ms</span>
                        </div>
                    </UiTooltip>
                </div>
            </div>

            {/* Scenario Preset Selector (Commit 215) */}
            <ScenarioPresetSelector
                activeScenario={activeScenario}
                baseWacc={baseResult?.appraisal?.waccPercent ?? 8.50}
                onSelectScenario={handleSelectScenario}
                onReset={handleResetAll}
            />

            {/* Live KPI Metric Cards Strip with Visual Anchoring for WACC */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                {/* 1. Project NPV */}
                <div
                    data-testid="kpi-project-npv"
                    className={`bg-zinc-900 border rounded-lg p-4 relative overflow-hidden transition-all duration-300 ${waccGlowClass}`}
                >
                    <div className="flex items-center justify-between text-[10px] text-zinc-400 uppercase font-semibold mb-1">
                        <div className="flex items-center gap-1">
                            <span>PROJECT NPV</span>
                            <InfoTooltip
                                size="xs"
                                content="Wartość Bieżąca Netto (Net Present Value) nielewarowanych wolnych przepływów pieniężnych (FCFF) zdyskontowanych stopą WACC. Wartość dodatnia oznacza kreację wartości dla inwestorów."
                                ariaLabel="Informacje o Project NPV"
                            />
                        </div>
                        <UiTooltip content="Wycena DCF nielewarowanych przepływów pieniężnych projektu">
                            <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                        </UiTooltip>
                    </div>
                    <div className="text-base font-bold text-zinc-100">
                        {formatMoney(currentNpv)}
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] mt-1">
                        {deltas && deltas.npvDiff !== 0 ? (
                            <UiTooltip content={`Odchylenie wartości NPV wobec scenariusza bazowego: ${deltas.npvDiff > 0 ? '+' : ''}${formatMoney(deltas.npvDiff)}`}>
                                <span className={deltas.npvDiff > 0 ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
                                    {deltas.npvDiff > 0 ? '+' : ''}{formatMoney(deltas.npvDiff)} ({deltas.npvDiffPct > 0 ? '+' : ''}{deltas.npvDiffPct.toFixed(1)}%)
                                </span>
                            </UiTooltip>
                        ) : (
                            <span className="text-zinc-500">Wobec scenariusza bazowego</span>
                        )}
                    </div>
                </div>

                {/* 2. Project IRR vs WACC */}
                <div
                    data-testid="kpi-project-irr"
                    className={`bg-zinc-900 border rounded-lg p-4 transition-all duration-300 ${waccGlowClass}`}
                >
                    <div className="flex items-center justify-between text-[10px] text-zinc-400 uppercase font-semibold mb-1">
                        <div className="flex items-center gap-1">
                            <span>PROJECT IRR</span>
                            <InfoTooltip
                                size="xs"
                                content="Wewnętrzna Stopa Zwrotu (Internal Rate of Return) dla całego projektu inwestycyjnego. Porównywana ze stopą dyskontową WACC (spread rentowności)."
                                ariaLabel="Informacje o Project IRR"
                            />
                        </div>
                        <UiTooltip content="Wewnętrzna stopa zwrotu projektu nielewarowanego">
                            <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
                        </UiTooltip>
                    </div>
                    <div className="text-base font-bold text-zinc-100">
                        {formatPercent(currentIrr)}
                    </div>
                    <div className="text-[10px] text-zinc-500 mt-1 flex items-center justify-between">
                        <UiTooltip content="Średni ważony koszt kapitału będący minimalną wymaganą stopą zwrotu">
                            <span>WACC: {formatPercent(currentWacc)}</span>
                        </UiTooltip>
                        {currentIrr !== null && (
                            <UiTooltip content={`Różnica pomiędzy stopą zwrotu projektu (IRR) a kosztem kapitału (WACC): ${(currentIrr - currentWacc).toFixed(2)} p.p.`}>
                                <span className={currentIrr > currentWacc ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
                                    Spread: {(currentIrr - currentWacc).toFixed(2)} p.p.
                                </span>
                            </UiTooltip>
                        )}
                    </div>
                </div>

                {/* 3. Equity MoIC */}
                <div
                    data-testid="kpi-equity-moic"
                    className={`bg-zinc-900 border rounded-lg p-4 transition-all duration-300 ${waccGlowClass}`}
                >
                    <div className="flex items-center justify-between text-[10px] text-zinc-400 uppercase font-semibold mb-1">
                        <div className="flex items-center gap-1">
                            <span>EQUITY MoIC</span>
                            <InfoTooltip
                                size="xs"
                                content="Mnożnik zwrotu z zainwestowanego kapitału własnego sponsorów (Multiple on Invested Capital = Wypłaty FCFE dla sponsorów / Wkład własny equity)."
                                ariaLabel="Informacje o Equity MoIC"
                            />
                        </div>
                        <UiTooltip content="Mnożnik zwrotu z kapitału własnego sponsorów">
                            <Coins className="w-3.5 h-3.5 text-amber-400" />
                        </UiTooltip>
                    </div>
                    <div className="text-base font-bold text-zinc-100">
                        {currentMoic.toFixed(2)}x
                    </div>
                    <div className="text-[10px] text-zinc-500 mt-1">
                        <UiTooltip content="Zdyskontowana wartość bieżąca wolnych przepływów pieniężnych dla sponsorów (FCFE) po pełnej obsłudze długu">
                            <span>Equity NPV: <span className="text-zinc-300 font-semibold">{formatMoney(whatIfResult?.summary?.equityNpv ?? 0)}</span></span>
                        </UiTooltip>
                    </div>
                </div>

                {/* 4. Payback Period */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                    <div className="flex items-center justify-between text-[10px] text-zinc-400 uppercase font-semibold mb-1">
                        <div className="flex items-center gap-1">
                            <span>OKRES ZWROTU</span>
                            <InfoTooltip
                                size="xs"
                                content="Prosty okres zwrotu (Simple Payback Period) – liczba lat niezbędna do pełnego odzyskania nakładów początkowych CAPEX z wygenerowanych nadwyżek operacyjnych."
                                ariaLabel="Informacje o okresie zwrotu"
                            />
                        </div>
                        <UiTooltip content="Horyzont zwrotu nakładów początkowych">
                            <Clock className="w-3.5 h-3.5 text-purple-400" />
                        </UiTooltip>
                    </div>
                    <div className="text-base font-bold text-zinc-100">
                        {whatIfResult?.summary?.simplePaybackYears ? `${whatIfResult.summary.simplePaybackYears} lat` : '> 15 lat'}
                    </div>
                    <div className="text-[10px] text-zinc-500 mt-1">
                        <UiTooltip content="Zdyskontowany okres zwrotu (Discounted Payback Period) uwzględniający koszt kapitału WACC">
                            <span>Zdyskontowany: <span className="text-zinc-300">{whatIfResult?.summary?.discountedPaybackYears ? `${whatIfResult.summary.discountedPaybackYears} lat` : '> 15 lat'}</span></span>
                        </UiTooltip>
                    </div>
                </div>

                {/* 5. DSCR & Bankability */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                    <div className="flex items-center justify-between text-[10px] text-zinc-400 uppercase font-semibold mb-1">
                        <div className="flex items-center gap-1">
                            <span>KOWENANT DSCR</span>
                            <InfoTooltip
                                size="xs"
                                content="Wskaźnik pokrycia obsługi długu (Debt Service Coverage Ratio = CFADS / Raty kapitałowo-odsetkowe). Banki wymagają minimalnego DSCR >= 1.20x."
                                ariaLabel="Informacje o kowenancie DSCR"
                            />
                        </div>
                        <UiTooltip content={isBankable ? 'Projekt bankowalny' : 'Ryzyko kredytowe'}>
                            {isBankable ? (
                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                            )}
                        </UiTooltip>
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="text-base font-bold text-zinc-100">
                            {currentAvgDscr ? `${currentAvgDscr.toFixed(2)}x` : '—'}
                        </div>
                        <UiTooltip content={isBankable ? 'Projekt spełnia minimalny kowenant DSCR >= 1.20x narzucany przez banki' : 'Minimalny DSCR poniżej progu 1.20x - ryzyko naruszenia kowenantów'}>
                            <Badge variant={isBankable ? 'success' : 'danger'}>
                                {isBankable ? 'BANKABLE' : 'RISK (< 1.2x)'}
                            </Badge>
                        </UiTooltip>
                    </div>
                    <div className="text-[10px] text-zinc-500 mt-1">
                        <UiTooltip content="Najniższy roczny wskaźnik DSCR odnotowany w okresie spłaty kredytu">
                            <span>Min DSCR: <span className={currentMinDscr && currentMinDscr >= 1.20 ? 'text-emerald-400' : 'text-amber-400'}>{currentMinDscr ? `${currentMinDscr.toFixed(2)}x` : '—'}</span></span>
                        </UiTooltip>
                    </div>
                </div>
            </div>

            {/* What-If Sliders Matrix */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
                <div className="flex items-center justify-between mb-4 border-b border-zinc-800 pb-3">
                    <div className="flex items-center gap-2">
                        <UiTooltip content="Regulacja kluczowych zmiennych modelu finansowego">
                            <Sliders className="w-4 h-4 text-emerald-400" />
                        </UiTooltip>
                        <h3 className="text-xs font-bold text-zinc-100 uppercase tracking-wide">
                            Suwaki Analizy Wrażliwości What-If (Kluczowe Drivery Modelu)
                        </h3>
                        <InfoTooltip
                            size="xs"
                            content="Dynamiczne suwaki pozwalają symulować odchylenia kluczowych zmiennych wejściowych modelu finansowego od wartości bazowych. Wyniki przeliczają się asynchronicznie w czasie rzeczywistym."
                            ariaLabel="Informacje o suwakach analizy wrażliwości"
                        />
                    </div>
                    <span className="text-[10px] text-zinc-500">
                        Przeciągaj suwaki, aby w czasie rzeczywistym symulować wpływ zmian na rentowność i płynność
                    </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* 1. CAPEX Modifier */}
                    <div className="space-y-2 p-3 bg-zinc-950 border border-zinc-850 rounded">
                        <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5 font-semibold text-zinc-300 uppercase">
                                <span>Nakłady CAPEX</span>
                                <InfoTooltip
                                    content="Wstępne nakłady inwestycyjne (Faza 0–1). Zwiększenie CAPEX wydłuża Payback Period (DPB) oraz obniża NPV i IRR projektu."
                                    ariaLabel="Informacje o nakładach CAPEX"
                                />
                            </div>
                            <span className={`font-mono font-bold ${capexDelta > 0 ? 'text-rose-400' : capexDelta < 0 ? 'text-emerald-400' : 'text-zinc-300'}`}>
                                {capexDelta > 0 ? `+${capexDelta}%` : `${capexDelta}%`}
                            </span>
                        </div>
                        <input
                            type="range"
                            min="-30"
                            max="50"
                            step="1"
                            value={capexDelta}
                            aria-label="Odchylenie nakładów CAPEX w procentach"
                            onChange={(e) => {
                                setCapexDelta(parseInt(e.target.value, 10));
                                setActiveScenario('custom');
                            }}
                            className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                        />
                        <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                            <span>-30%</span>
                            <span className="text-zinc-400">
                                {formatMoney(whatIfResult?.summary?.totalCapex ?? baseResult?.summary?.totalCapex ?? 0)}
                            </span>
                            <span>+50%</span>
                        </div>
                    </div>

                    {/* 2. Revenue Modifier */}
                    <div className="space-y-2 p-3 bg-zinc-950 border border-zinc-850 rounded">
                        <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5 font-semibold text-zinc-300 uppercase">
                                <span>Przychody ze Sprzedaży</span>
                                <InfoTooltip
                                    content="Symulacja wahań popytu i cen sprzedaży (±30%). Przychody bezpośrednio determinują przepływy operacyjne OCF i wskaźnik pokrycia długu DSCR."
                                    ariaLabel="Informacje o przychodach ze sprzedaży"
                                />
                            </div>
                            <span className={`font-mono font-bold ${revenueDelta > 0 ? 'text-emerald-400' : revenueDelta < 0 ? 'text-rose-400' : 'text-zinc-300'}`}>
                                {revenueDelta > 0 ? `+${revenueDelta}%` : `${revenueDelta}%`}
                            </span>
                        </div>
                        <input
                            type="range"
                            min="-30"
                            max="30"
                            step="1"
                            value={revenueDelta}
                            aria-label="Odchylenie przychodów ze sprzedaży w procentach"
                            onChange={(e) => {
                                setRevenueDelta(parseInt(e.target.value, 10));
                                setActiveScenario('custom');
                            }}
                            className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                        />
                        <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                            <span>-30%</span>
                            <span className="text-zinc-400">
                                Suma 15L: {formatMoney(whatIfResult?.summary?.totalRevenue15Y ?? 0)}
                            </span>
                            <span>+30%</span>
                        </div>
                    </div>

                    {/* 3. Variable Costs Modifier */}
                    <div className="space-y-2 p-3 bg-zinc-950 border border-zinc-850 rounded">
                        <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5 font-semibold text-zinc-300 uppercase">
                                <span>Koszty Zmienne (% Rev)</span>
                                <InfoTooltip
                                    content="Koszty bezpośrednie (COGS / surowce / media technologiczne) skalujące się proporcjonalnie do wolumenu przychodów."
                                    ariaLabel="Informacje o kosztach zmiennych"
                                />
                            </div>
                            <span className={`font-mono font-bold ${varCostDelta > 0 ? 'text-rose-400' : varCostDelta < 0 ? 'text-emerald-400' : 'text-zinc-300'}`}>
                                {varCostDelta > 0 ? `+${varCostDelta}%` : `${varCostDelta}%`}
                            </span>
                        </div>
                        <input
                            type="range"
                            min="-20"
                            max="30"
                            step="1"
                            value={varCostDelta}
                            aria-label="Odchylenie kosztów zmiennych w procentach"
                            onChange={(e) => {
                                setVarCostDelta(parseInt(e.target.value, 10));
                                setActiveScenario('custom');
                            }}
                            className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                        />
                        <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                            <span>-20%</span>
                            <span className="text-zinc-400">
                                Mnożnik: {(1.0 + varCostDelta / 100).toFixed(2)}x
                            </span>
                            <span>+30%</span>
                        </div>
                    </div>

                    {/* 4. Fixed Costs Modifier */}
                    <div className="space-y-2 p-3 bg-zinc-950 border border-zinc-850 rounded">
                        <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5 font-semibold text-zinc-300 uppercase">
                                <span>Koszty Stałe OPEX</span>
                                <InfoTooltip
                                    content="Roczna baza kosztów operacyjnych niezależnych od wolumenu (utrzymanie infrastruktury, podatki od nieruchomości, ubezpieczenia, IT)."
                                    ariaLabel="Informacje o kosztach stałych OPEX"
                                />
                            </div>
                            <span className={`font-mono font-bold ${fixedCostDelta > 0 ? 'text-rose-400' : fixedCostDelta < 0 ? 'text-emerald-400' : 'text-zinc-300'}`}>
                                {fixedCostDelta > 0 ? `+${fixedCostDelta}%` : `${fixedCostDelta}%`}
                            </span>
                        </div>
                        <input
                            type="range"
                            min="-20"
                            max="30"
                            step="1"
                            value={fixedCostDelta}
                            aria-label="Odchylenie kosztów stałych OPEX w procentach"
                            onChange={(e) => {
                                setFixedCostDelta(parseInt(e.target.value, 10));
                                setActiveScenario('custom');
                            }}
                            className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                        />
                        <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                            <span>-20%</span>
                            <span className="text-zinc-400">
                                Baza: {formatMoney(Number(selectedProject?.operating_assumptions?.annual_fixed_costs_base || 1400000) * (1 + fixedCostDelta / 100))}
                            </span>
                            <span>+30%</span>
                        </div>
                    </div>

                    {/* 5. Payroll Costs Modifier */}
                    <div className="space-y-2 p-3 bg-zinc-950 border border-zinc-850 rounded">
                        <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5 font-semibold text-zinc-300 uppercase">
                                <span>Fundusz Płac & Płace</span>
                                <InfoTooltip
                                    content="Roczny narzut wynagrodzeń wraz ze składkami ZUS i świadczeniami pracowniczymi podlegający presji płacowej."
                                    ariaLabel="Informacje o funduszu płac"
                                />
                            </div>
                            <span className={`font-mono font-bold ${payrollDelta > 0 ? 'text-rose-400' : payrollDelta < 0 ? 'text-emerald-400' : 'text-zinc-300'}`}>
                                {payrollDelta > 0 ? `+${payrollDelta}%` : `${payrollDelta}%`}
                            </span>
                        </div>
                        <input
                            type="range"
                            min="-15"
                            max="30"
                            step="1"
                            value={payrollDelta}
                            aria-label="Odchylenie funduszu płac w procentach"
                            onChange={(e) => {
                                setPayrollDelta(parseInt(e.target.value, 10));
                                setActiveScenario('custom');
                            }}
                            className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                        />
                        <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                            <span>-15%</span>
                            <span className="text-zinc-400">
                                Baza: {formatMoney(Number(selectedProject?.operating_assumptions?.annual_payroll_base || 2200000) * (1 + payrollDelta / 100))}
                            </span>
                            <span>+30%</span>
                        </div>
                    </div>

                    {/* 6. WACC Discount Rate Override */}
                    <div className="space-y-2 p-3 bg-zinc-950 border border-zinc-850 rounded">
                        <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5 font-semibold text-zinc-300 uppercase">
                                <span>Stopa Dyskontowa WACC</span>
                                <InfoTooltip
                                    content="Średni ważony koszt kapitału (WACC). Bazowa stopa dyskontowa w modelu DCF odzwierciedlająca koszt długu i oczekiwaną stopę zwrotu z kapitału własnego (CAPM)."
                                    ariaLabel="Informacje o stopie dyskontowej WACC"
                                />
                            </div>
                            <span className="font-mono font-bold text-blue-400">
                                {waccOverride !== null ? `${waccOverride.toFixed(2)}% (Manual)` : `${formatPercent(baseResult?.appraisal?.waccPercent ?? 8.50)} (Model)`}
                            </span>
                        </div>
                        <p className="text-[10px] text-zinc-400 leading-tight">
                            Wpływa na wycenę DCF (karty KPI u góry) oraz na tryb zdyskontowany wykresu
                        </p>
                        <input
                            type="range"
                            min="4.0"
                            max="16.0"
                            step="0.25"
                            value={waccOverride !== null ? waccOverride : (baseResult?.appraisal?.waccPercent ?? 8.50)}
                            aria-label="Ręczna zmiana stopy dyskontowej WACC"
                            onChange={(e) => {
                                setWaccOverride(parseFloat(e.target.value));
                                setActiveScenario('custom');
                                triggerWaccHighlight();
                            }}
                            className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                        <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                            <span>4.0%</span>
                            {waccOverride !== null && (
                                <UiTooltip content="Przywróć stopę WACC wyliczoną analitycznie na podstawie parametrów CAPM">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setWaccOverride(null);
                                            triggerWaccHighlight();
                                        }}
                                        className="text-[10px] text-zinc-400 hover:text-zinc-200 underline cursor-pointer"
                                        aria-label="Przywróć model WACC"
                                    >
                                        Przywróć model WACC
                                    </button>
                                </UiTooltip>
                            )}
                            <span>16.0%</span>
                        </div>
                    </div>

                    {/* 7. Reinvestment CAPEX (A, B, C) Modifier */}
                    <div className="space-y-2 p-3 bg-zinc-950 border border-zinc-850 rounded">
                        <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5 font-semibold text-zinc-300 uppercase">
                                <span>Reinvestment A, B, C</span>
                                <InfoTooltip
                                    content="Cykliczne nakłady odtworzeniowe (Replacement CAPEX) w cyklach 5/10/15-letnich na modernizację parku maszynowego i infrastruktury."
                                    ariaLabel="Informacje o nakładach odtworzeniowych Reinvestment"
                                />
                            </div>
                            <span className={`font-mono font-bold ${reinvestmentDelta > 0 ? 'text-rose-400' : reinvestmentDelta < 0 ? 'text-emerald-400' : 'text-zinc-300'}`}>
                                {reinvestmentsEnabled ? (reinvestmentDelta > 0 ? `+${reinvestmentDelta}%` : `${reinvestmentDelta}%`) : 'WYŁĄCZONY'}
                            </span>
                        </div>
                        <input
                            type="range"
                            min="-50"
                            max="50"
                            step="5"
                            value={reinvestmentDelta}
                            disabled={!reinvestmentsEnabled}
                            aria-label="Mnożnik nakładów odtworzeniowych Reinvestment w procentach"
                            onChange={(e) => {
                                setReinvestmentDelta(parseInt(e.target.value, 10));
                                setActiveScenario('custom');
                            }}
                            className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500 disabled:opacity-40"
                        />
                        <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                            <span>-50%</span>
                            <div className="flex items-center gap-2">
                                <UiTooltip content="Włącz lub wyłącz uwzględnianie cyklicznych nakładów odtworzeniowych w przepływach pieniężnych">
                                    <label className="flex items-center gap-1 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={reinvestmentsEnabled}
                                            aria-label="Włącz lub wyłącz cykliczny reinvestment"
                                            onChange={(e) => {
                                                setReinvestmentsEnabled(e.target.checked);
                                                setActiveScenario('custom');
                                            }}
                                            className="w-3 h-3 rounded bg-zinc-900 border-zinc-700 text-emerald-500 focus:ring-0"
                                        />
                                        <span className="text-[10px] text-zinc-400">Aktywny</span>
                                    </label>
                                </UiTooltip>
                                <UiTooltip content={showReinvestmentDetails ? 'Zwiń szczegółowy panel konfiguracji programów odtworzeniowych A, B, C' : 'Rozwiń szczegółowy panel konfiguracji nakładów odtworzeniowych A, B, C'}>
                                    <button
                                        type="button"
                                        onClick={() => setShowReinvestmentDetails(prev => !prev)}
                                        className="text-[10px] text-cyan-400 hover:text-cyan-300 underline font-bold cursor-pointer"
                                        aria-label={showReinvestmentDetails ? 'Ukryj programy odtworzeniowe A, B, C' : 'Konfiguruj programy odtworzeniowe A, B, C'}
                                    >
                                        {showReinvestmentDetails ? 'Ukryj A, B, C' : 'Konfiguruj A, B, C'}
                                    </button>
                                </UiTooltip>
                            </div>
                            <span>+50%</span>
                        </div>

                        {/* Aggregated 15Y Reinvestment Info & Empty State Handling */}
                        <div className="pt-2 border-t border-zinc-850/60 flex items-center justify-between text-[10px] font-mono">
                            {currentReinvestmentCapex > 0 ? (
                                <UiTooltip content="Łączna wartość nakładów odtworzeniowych we wszystkich programach A, B, C w horyzoncie 15 lat">
                                    <span className="text-zinc-400">
                                        Suma 15-letnia: <span className="font-bold text-zinc-200">{formatReinvestmentSummary(currentReinvestmentCapex, selectedProject?.currency || 'PLN')}</span>
                                    </span>
                                </UiTooltip>
                            ) : (
                                <div className="flex items-center justify-between w-full">
                                    <span className="text-amber-400/90 font-medium">
                                        Suma: 0,00 {selectedProject?.currency || 'PLN'} (brak aktywnych programów)
                                    </span>
                                    <UiTooltip content="Otwórz panel i zdefiniuj parametry cyklicznych nakładów odtworzeniowych dla projektu">
                                        <button
                                            type="button"
                                            onClick={() => setShowReinvestmentDetails(true)}
                                            className="text-[10px] text-cyan-400 hover:text-cyan-300 underline font-bold cursor-pointer"
                                            aria-label="Skonfiguruj A, B, C - nakłady odtworzeniowe"
                                        >
                                            Skonfiguruj A, B, C
                                        </button>
                                    </UiTooltip>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Collapsible Reinvestment Manager */}
            {showReinvestmentDetails && (
                <div className="animate-in fade-in duration-200">
                    <ReinvestmentManager
                        initialMultiplier={1.0 + reinvestmentDelta / 100.0}
                        initialEnabled={reinvestmentsEnabled}
                    />
                </div>
            )}

            {/* Debt Repayment Mode Switcher (Commit 215) */}
            <DebtRepaymentModeSwitcher
                facility={selectedProject?.debt_facility}
                contractMode={selectedProject?.debt_facility?.repayment_type || 'annuity'}
                activeMode={repaymentTypeOverride || selectedProject?.debt_facility?.repayment_type || 'annuity'}
                onChangeMode={(mode) => {
                    setRepaymentTypeOverride(mode);
                    setActiveScenario('custom');
                }}
                onResetToContract={() => {
                    setRepaymentTypeOverride(null);
                }}
                minDscr={whatIfResult?.summary?.minDscr}
                avgDscr={whatIfResult?.summary?.avgDscr}
                totalInterest={whatIfResult?.summary?.totalInterest15Y}
                baseInterest={baseResult?.summary?.totalInterest15Y}
                currency={selectedProject?.currency || 'PLN'}
            />

            {/* 15-Year Financial Evolution Chart (Nominal vs Discounted DCF & NPV Modes) */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4 border-b border-zinc-800 pb-3">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        <div className="flex items-center gap-2">
                            <UiTooltip content="Wielowymiarowy wykres 15-letniej projekcji finansowej">
                                <BarChart3 className="w-4 h-4 text-emerald-400" />
                            </UiTooltip>
                            <h3 className="text-xs font-bold text-zinc-100 uppercase tracking-wide">
                                15-letnia Ewolucja Wyników Finansowych (Scenariusz What-If)
                            </h3>
                            <InfoTooltip
                                size="xs"
                                content="Wizualizacja dynamiki przychodów, kosztów operacyjnych, nakładów CAPEX, wyniku EBITDA oraz przepływów pieniężnych (nominalnych lub zdyskontowanych stopą WACC) w pełnym 15-letnim horyzoncie modelu."
                                ariaLabel="Informacje o 15-letnim wykresie ewolucji"
                            />
                        </div>

                        {/* Chart Mode Switcher (Segmented Control) */}
                        <div className="inline-flex rounded-md p-0.5 bg-zinc-950 border border-zinc-800 text-[11px] self-start sm:self-auto">
                            <UiTooltip content="Prezentuj nominalne wielkości P&L (Przychody, OPEX, EBITDA) oraz wolne przepływy pieniężne (FCFF)">
                                <button
                                    type="button"
                                    onClick={() => setChartMode('nominal')}
                                    className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                                        chartMode === 'nominal'
                                            ? 'bg-emerald-600 text-white font-bold shadow-xs'
                                            : 'text-zinc-400 hover:text-zinc-200'
                                    }`}
                                    aria-label="Przełącz na widok nominalny P&L i CF"
                                >
                                    Nominalne (P&L i CF)
                                </button>
                            </UiTooltip>
                            <UiTooltip content="Prezentuj zdyskontowane przepływy FCFF oraz narastające skumulowane NPV z uwzględnieniem stopy WACC">
                                <button
                                    type="button"
                                    onClick={() => setChartMode('discounted')}
                                    className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                                        chartMode === 'discounted'
                                            ? 'bg-blue-600 text-white font-bold shadow-xs'
                                            : 'text-zinc-400 hover:text-zinc-200'
                                    }`}
                                    aria-label="Przełącz na widok zdyskontowany DCF i NPV"
                                >
                                    Zdyskontowane (DCF & NPV)
                                </button>
                            </UiTooltip>
                        </div>
                    </div>

                    {/* Chart Legend */}
                    {chartMode === 'nominal' ? (
                        <div className="text-[11px] text-zinc-400 flex flex-wrap items-center gap-3">
                            <UiTooltip content="Przychody operacyjne ze sprzedaży towarów i usług">
                                <span className="flex items-center gap-1.5 cursor-help">
                                    <span className="w-2.5 h-2.5 bg-[#10b981] rounded-xs" /> Przychody
                                </span>
                            </UiTooltip>
                            <UiTooltip content="Koszty operacyjne (zmienne, stałe oraz koszty pracy)">
                                <span className="flex items-center gap-1.5 cursor-help">
                                    <span className="w-2.5 h-2.5 bg-[#f43f5e] rounded-xs" /> Koszty OPEX
                                </span>
                            </UiTooltip>
                            <UiTooltip content="Nakłady początkowe CAPEX oraz cykliczne nakłady odtworzeniowe Reinvestment">
                                <span className="flex items-center gap-1.5 cursor-help">
                                    <span className="w-2.5 h-2.5 bg-[#818cf8] rounded-xs" /> CAPEX & Reinwestycje
                                </span>
                            </UiTooltip>
                            <UiTooltip content="Zysk operacyjny przed potrąceniem odsetek, podatków i amortyzacji (EBITDA)">
                                <span className="flex items-center gap-1.5 cursor-help">
                                    <span className="w-2.5 h-2.5 bg-[#f59e0b] rounded-full" /> EBITDA
                                </span>
                            </UiTooltip>
                            <UiTooltip content="Nielewarowane wolne przepływy pieniężne dla firmy (Free Cash Flow to Firm)">
                                <span className="flex items-center gap-1.5 cursor-help">
                                    <span className="w-2.5 h-2.5 bg-[#3b82f6] rounded-full" /> FCFF
                                </span>
                            </UiTooltip>
                        </div>
                    ) : (
                        <div className="text-[11px] text-zinc-400 flex flex-wrap items-center gap-3">
                            <UiTooltip content="Nielewarowane przepływy FCFF zdyskontowane stopą WACC na moment zero">
                                <span className="flex items-center gap-1.5 cursor-help">
                                    <span className="w-2.5 h-2.5 bg-[#3b82f6] rounded-xs" /> Zdyskontowany FCFF
                                </span>
                            </UiTooltip>
                            <UiTooltip content="Narastająca suma zdyskontowanych przepływów pieniężnych (Skumulowane NPV)">
                                <span className="flex items-center gap-1.5 cursor-help">
                                    <span className="w-2.5 h-2.5 bg-[#10b981] rounded-full" /> Skumulowane NPV
                                </span>
                            </UiTooltip>
                            <UiTooltip content="Stopa dyskontowa WACC zastosowana w kalkulacji DCF">
                                <span className="text-[10px] text-zinc-500 bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800">
                                    WACC: {currentWacc.toFixed(2)}%
                                </span>
                            </UiTooltip>
                        </div>
                    )}
                </div>

                <div className="w-full h-80">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart
                            data={chartData}
                            margin={{ top: 10, right: 10, left: -5, bottom: 0 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                            <XAxis
                                dataKey="label"
                                stroke="#71717a"
                                fontSize={10}
                                fontFamily="JetBrains Mono, monospace"
                                tickLine={false}
                                axisLine={{ stroke: axisLineStroke }}
                            />
                            <YAxis
                                stroke="#71717a"
                                fontSize={10}
                                fontFamily="JetBrains Mono, monospace"
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={formatYAxis}
                            />
                            <Tooltip
                                content={<CustomChartTooltip currency={selectedProject.currency || 'PLN'} />}
                                cursor={{ fill: chartCursorFill }}
                            />
                            {chartMode === 'nominal' ? (
                                <>
                                    <Bar dataKey="Przychody" fill="#10b981" radius={[2, 2, 0, 0]} maxBarSize={24} />
                                    <Bar dataKey="Koszty OPEX" fill="#f43f5e" radius={[2, 2, 0, 0]} maxBarSize={24} />
                                    <Bar dataKey="CAPEX & Reinwestycje" fill="#818cf8" radius={[2, 2, 0, 0]} maxBarSize={24} />
                                    <Line
                                        type="monotone"
                                        dataKey="EBITDA"
                                        stroke="#f59e0b"
                                        strokeWidth={2.5}
                                        dot={{ fill: '#f59e0b', r: 3 }}
                                        activeDot={{ r: 5 }}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="Free Cash Flow (FCFF)"
                                        stroke="#3b82f6"
                                        strokeWidth={2.5}
                                        dot={{ fill: '#3b82f6', r: 3 }}
                                        activeDot={{ r: 5 }}
                                    />
                                </>
                            ) : (
                                <>
                                    <Bar dataKey="Zdyskontowany FCFF" fill="#3b82f6" radius={[2, 2, 0, 0]} maxBarSize={28} />
                                    <Line
                                        type="monotone"
                                        dataKey="Skumulowane NPV"
                                        stroke="#10b981"
                                        strokeWidth={3}
                                        dot={{ fill: '#10b981', r: 3 }}
                                        activeDot={{ r: 5 }}
                                    />
                                </>
                            )}
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Base vs What-If Comparison Grid */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
                <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <UiTooltip content="Syntetyczne zestawienie analityczne wariantów">
                            <Layers className="w-4 h-4 text-emerald-400" />
                        </UiTooltip>
                        <h3 className="text-xs font-bold text-zinc-100 uppercase tracking-wide">
                            Macierz Porównawcza Wpływu Wrażliwości (Base Case vs What-If)
                        </h3>
                        <InfoTooltip
                            size="xs"
                            content="Zestawienie kluczowych parametrów finansowych i kowenantów bankowych scenariusza bazowego ze zmodyfikowanym wariantem What-If. Prezentuje odchylenie delta oraz ocenę wpływu na profil ryzyka."
                            ariaLabel="Informacje o macierzy porównawczej"
                        />
                    </div>
                    <UiTooltip content={deltas?.npvDiff && deltas.npvDiff >= 0 ? 'Modyfikacja założeń zwiększa wartość bieżącą netto projektu (NPV)' : 'Modyfikacja założeń obniża NPV lub wskazuje na scenariusz stresowy'}>
                        <Badge variant={deltas?.npvDiff && deltas.npvDiff >= 0 ? 'success' : 'warning'}>
                            {deltas?.npvDiff && deltas.npvDiff >= 0 ? 'WARTOŚĆ DODANA' : 'DECYZJA STRES-TEST'}
                        </Badge>
                    </UiTooltip>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                        <thead>
                            <tr className="border-b border-zinc-800 text-[10px] text-zinc-400 uppercase tracking-wider bg-zinc-950/60">
                                <th className="py-3 px-4">
                                    <UiTooltip content="Wskaźnik finansowy, wielkość przepływów lub kowenant bankowy podlegający symulacji">
                                        <span className="cursor-help">METRYKA MODELU</span>
                                    </UiTooltip>
                                </th>
                                <th className="py-3 px-4 text-right">
                                    <UiTooltip content="Wartość nominalna wynikająca z umowy i pierwotnych założeń modelu">
                                        <span className="cursor-help">SCENARIUSZ BAZOWY</span>
                                    </UiTooltip>
                                </th>
                                <th className="py-3 px-4 text-right">
                                    <UiTooltip content="Wartość wyliczona w czasie rzeczywistym z uwzględnieniem aktywnych suwaków i scenariuszy">
                                        <span className="cursor-help">SCENARIUSZ WHAT-IF</span>
                                    </UiTooltip>
                                </th>
                                <th className="py-3 px-4 text-right">
                                    <UiTooltip content="Różnica nominalna i procentowa pomiędzy wariantem What-If a scenariuszem bazowym">
                                        <span className="cursor-help">ODCHYLENIE DELTA</span>
                                    </UiTooltip>
                                </th>
                                <th className="py-3 px-4 text-center">
                                    <UiTooltip content="Kwalifikacja wpływu odchylenia na stabilność finansową, kowenanty bankowe i rentowność">
                                        <span className="cursor-help">WPŁYW / STATUS</span>
                                    </UiTooltip>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/60 font-mono text-[11px]">
                            {/* 1. Total CAPEX */}
                            <tr className="hover:bg-zinc-850/40 transition-colors">
                                <td className="py-3 px-4 font-semibold text-zinc-200">
                                    Łączne Nakłady CAPEX
                                </td>
                                <td className="py-3 px-4 text-right text-zinc-300">
                                    {formatMoney(baseResult?.summary?.totalCapex ?? 0)}
                                </td>
                                <td className="py-3 px-4 text-right font-bold text-zinc-100">
                                    {formatMoney(whatIfResult?.summary?.totalCapex ?? 0)}
                                </td>
                                <td className="py-3 px-4 text-right">
                                    <span className={capexDelta > 0 ? 'text-rose-400' : capexDelta < 0 ? 'text-emerald-400' : 'text-zinc-400'}>
                                        {capexDelta > 0 ? '+' : ''}{formatMoney(deltas?.capexDiff ?? 0)} ({capexDelta}%)
                                    </span>
                                </td>
                                <td className="py-3 px-4 text-center">
                                    <UiTooltip content={capexDelta <= 0 ? 'Nakłady mieszczą się w budżecie bazowym' : 'Budżet nakładów początkowych został przekroczony'}>
                                        <Badge variant={capexDelta <= 0 ? 'success' : 'danger'}>
                                            {capexDelta <= 0 ? 'W NORMIE' : 'PRZEKROCZENIE'}
                                        </Badge>
                                    </UiTooltip>
                                </td>
                            </tr>

                            {/* 1b. Cyclical Reinvestment CAPEX */}
                            <tr className="hover:bg-zinc-850/40 transition-colors">
                                <td className="py-3 px-4 font-semibold text-zinc-300 pl-6 flex items-center gap-1.5">
                                    <span className="text-zinc-600">↳</span>
                                    <span>Reinvestment CAPEX (A, B, C)</span>
                                </td>
                                <td className="py-3 px-4 text-right text-zinc-400">
                                    {formatMoney(baseResult?.summary?.totalReinvestmentCapex ?? 0)}
                                </td>
                                <td className="py-3 px-4 text-right font-mono font-bold text-zinc-200">
                                    {formatMoney(whatIfResult?.summary?.totalReinvestmentCapex ?? 0)}
                                </td>
                                <td className="py-3 px-4 text-right">
                                    {baseResult && whatIfResult && (
                                        <span className={(whatIfResult.summary?.totalReinvestmentCapex ?? 0) <= (baseResult.summary?.totalReinvestmentCapex ?? 0) ? 'text-emerald-400' : 'text-rose-400'}>
                                            {formatMoney((whatIfResult.summary?.totalReinvestmentCapex ?? 0) - (baseResult.summary?.totalReinvestmentCapex ?? 0))}
                                        </span>
                                    )}
                                </td>
                                <td className="py-3 px-4 text-center">
                                    <UiTooltip content={reinvestmentsEnabled ? 'Programy odtworzeniowe są aktywne w symulacji' : 'Programy odtworzeniowe zostały wyłączone'}>
                                        <Badge variant={reinvestmentsEnabled ? 'brand' : 'warning'}>
                                            {reinvestmentsEnabled ? 'AKTYWNY' : 'WYŁĄCZONY'}
                                        </Badge>
                                    </UiTooltip>
                                </td>
                            </tr>

                            {/* 2. Total 15Y Revenue */}
                            <tr className="hover:bg-zinc-850/40 transition-colors">
                                <td className="py-3 px-4 font-semibold text-zinc-200">
                                    Suma Przychodów (15 Lat)
                                </td>
                                <td className="py-3 px-4 text-right text-zinc-300">
                                    {formatMoney(baseResult?.summary?.totalRevenue15Y ?? 0)}
                                </td>
                                <td className="py-3 px-4 text-right font-bold text-zinc-100">
                                    {formatMoney(whatIfResult?.summary?.totalRevenue15Y ?? 0)}
                                </td>
                                <td className="py-3 px-4 text-right">
                                    <span className={revenueDelta > 0 ? 'text-emerald-400' : revenueDelta < 0 ? 'text-rose-400' : 'text-zinc-400'}>
                                        {revenueDelta > 0 ? `+${revenueDelta}%` : `${revenueDelta}%`}
                                    </span>
                                </td>
                                <td className="py-3 px-4 text-center">
                                    <UiTooltip content={revenueDelta >= 0 ? 'Przychody równe lub wyższe od wariantu bazowego' : 'Spadek wolumenu lub cen sprzedaży w modelu'}>
                                        <Badge variant={revenueDelta >= 0 ? 'success' : 'warning'}>
                                            {revenueDelta >= 0 ? 'POZYTYWNY' : 'SPADEK SPRZEDAŻY'}
                                        </Badge>
                                    </UiTooltip>
                                </td>
                            </tr>

                            {/* 3. Total 15Y EBITDA */}
                            <tr className="hover:bg-zinc-850/40 transition-colors">
                                <td className="py-3 px-4 font-semibold text-zinc-200">
                                    Suma Wyniku EBITDA (15 Lat)
                                </td>
                                <td className="py-3 px-4 text-right text-zinc-300">
                                    {formatMoney(baseResult?.summary?.totalEbitda15Y ?? 0)}
                                </td>
                                <td className="py-3 px-4 text-right font-bold text-zinc-100">
                                    {formatMoney(whatIfResult?.summary?.totalEbitda15Y ?? 0)}
                                </td>
                                <td className="py-3 px-4 text-right">
                                    {baseResult && whatIfResult && (
                                        <span className={(whatIfResult.summary?.totalEbitda15Y ?? 0) >= (baseResult.summary?.totalEbitda15Y ?? 0) ? 'text-emerald-400' : 'text-rose-400'}>
                                            {formatMoney((whatIfResult.summary?.totalEbitda15Y ?? 0) - (baseResult.summary?.totalEbitda15Y ?? 0))}
                                        </span>
                                    )}
                                </td>
                                <td className="py-3 px-4 text-center">
                                    <UiTooltip content={(whatIfResult?.summary?.totalEbitda15Y ?? 0) >= (baseResult?.summary?.totalEbitda15Y ?? 0) ? 'Łączny zysk operacyjny EBITDA powyżej bazy' : 'Redukcja skumulowanego zysku operacyjnego EBITDA'}>
                                        <Badge variant={(whatIfResult?.summary?.totalEbitda15Y ?? 0) >= (baseResult?.summary?.totalEbitda15Y ?? 0) ? 'success' : 'warning'}>
                                            {(whatIfResult?.summary?.totalEbitda15Y ?? 0) >= (baseResult?.summary?.totalEbitda15Y ?? 0) ? 'W NORMIE' : 'REDUKCJA'}
                                        </Badge>
                                    </UiTooltip>
                                </td>
                            </tr>

                            {/* 4. Project NPV */}
                            <tr className="hover:bg-zinc-850/40 transition-colors bg-zinc-950/20">
                                <td className="py-3 px-4 font-bold text-emerald-400">
                                    Wartość Bieżąca Netto (NPV Projektu)
                                </td>
                                <td className="py-3 px-4 text-right text-zinc-300">
                                    {formatMoney(baseResult?.summary?.projectNpv ?? 0)}
                                </td>
                                <td className="py-3 px-4 text-right font-bold text-emerald-300">
                                    {formatMoney(currentNpv)}
                                </td>
                                <td className="py-3 px-4 text-right font-bold">
                                    <span className={deltas && deltas.npvDiff >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                                        {deltas && deltas.npvDiff > 0 ? '+' : ''}{formatMoney(deltas?.npvDiff ?? 0)}
                                    </span>
                                </td>
                                <td className="py-3 px-4 text-center">
                                    <UiTooltip content={currentNpv > 0 ? 'Projekt generuje dodatnią wartość bieżącą netto (NPV > 0)' : 'Projekt generuje ujemną wartość bieżącą netto (destrukcja wartości)'}>
                                        <Badge variant={currentNpv > 0 ? 'brand' : 'danger'}>
                                            {currentNpv > 0 ? 'NPV > 0' : 'DESTRUKCJA'}
                                        </Badge>
                                    </UiTooltip>
                                </td>
                            </tr>

                            {/* 5. Project IRR */}
                            <tr className="hover:bg-zinc-850/40 transition-colors">
                                <td className="py-3 px-4 font-semibold text-zinc-200">
                                    Wewnętrzna Stopa Zwrotu (Project IRR)
                                </td>
                                <td className="py-3 px-4 text-right text-zinc-300">
                                    {formatPercent(baseResult?.summary?.projectIrrPercent)}
                                </td>
                                <td className="py-3 px-4 text-right font-bold text-zinc-100">
                                    {formatPercent(currentIrr)}
                                </td>
                                <td className="py-3 px-4 text-right">
                                    <span className={deltas && deltas.irrDiff >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                                        {deltas && deltas.irrDiff > 0 ? '+' : ''}{deltas?.irrDiff?.toFixed(2)} p.p.
                                    </span>
                                </td>
                                <td className="py-3 px-4 text-center">
                                    <UiTooltip content={currentIrr && currentIrr > currentWacc ? 'Stopa zwrotu projektu (IRR) przekracza koszt kapitału (WACC)' : 'Stopa zwrotu projektu (IRR) poniżej kosztu kapitału (WACC)'}>
                                        <Badge variant={currentIrr && currentIrr > currentWacc ? 'success' : 'danger'}>
                                            {currentIrr && currentIrr > currentWacc ? 'IRR > WACC' : 'IRR < WACC'}
                                        </Badge>
                                    </UiTooltip>
                                </td>
                            </tr>

                            {/* 6. Equity MoIC */}
                            <tr className="hover:bg-zinc-850/40 transition-colors">
                                <td className="py-3 px-4 font-semibold text-zinc-200">
                                    Mnożnik Kapitału Własnego (MoIC)
                                </td>
                                <td className="py-3 px-4 text-right text-zinc-300">
                                    {baseResult?.summary?.equityMoic?.toFixed(2)}x
                                </td>
                                <td className="py-3 px-4 text-right font-bold text-zinc-100">
                                    {currentMoic.toFixed(2)}x
                                </td>
                                <td className="py-3 px-4 text-right">
                                    <span className={deltas && deltas.moicDiff >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                                        {deltas && deltas.moicDiff > 0 ? '+' : ''}{deltas?.moicDiff?.toFixed(2)}x
                                    </span>
                                </td>
                                <td className="py-3 px-4 text-center">
                                    <UiTooltip content={currentMoic >= 2.0 ? 'Wysoki zwrot z kapitału własnego sponsorów (MoIC >= 2.0x)' : 'Standardowy poziom zwrotu z kapitału własnego'}>
                                        <Badge variant={currentMoic >= 2.0 ? 'brand' : 'default'}>
                                            {currentMoic >= 2.0 ? 'SUPER RETURN' : 'STANDARD'}
                                        </Badge>
                                    </UiTooltip>
                                </td>
                            </tr>

                            {/* 7. Minimum & Average DSCR */}
                            <tr className="hover:bg-zinc-850/40 transition-colors">
                                <td className="py-3 px-4 font-semibold text-zinc-200">
                                    Wskaźnik Pokrycia Obsługi Długu (DSCR)
                                </td>
                                <td className="py-3 px-4 text-right text-zinc-300">
                                    Min: {baseResult?.summary?.minDscr ? `${baseResult.summary.minDscr.toFixed(2)}x` : '—'} | Avg: {baseResult?.summary?.avgDscr ? `${baseResult.summary.avgDscr.toFixed(2)}x` : '—'}
                                </td>
                                <td className="py-3 px-4 text-right font-bold text-zinc-100">
                                    Min: {currentMinDscr ? `${currentMinDscr.toFixed(2)}x` : '—'} | Avg: {currentAvgDscr ? `${currentAvgDscr.toFixed(2)}x` : '—'}
                                </td>
                                <td className="py-3 px-4 text-right">
                                    <span className={isBankable ? 'text-emerald-400' : 'text-rose-400 font-bold'}>
                                        {isBankable ? 'Zgodny z bankiem' : 'Naruszenie kowenantu'}
                                    </span>
                                </td>
                                <td className="py-3 px-4 text-center">
                                    <UiTooltip content={isBankable ? 'Wskaźnik spełnia wymóg bankowalności (min. 1.20x)' : 'Naruszenie kowenantu bankowego – ryzyko kredytowe'}>
                                        <Badge variant={isBankable ? 'success' : 'danger'}>
                                            {isBankable ? 'BANKOWALNY' : 'RYZYKO KREDYTOWE'}
                                        </Badge>
                                    </UiTooltip>
                                </td>
                            </tr>

                            {/* 8. Debt Repayment Profile */}
                            <tr className="hover:bg-zinc-850/40 transition-colors">
                                <td className="py-3 px-4 font-semibold text-zinc-200">
                                    Profil Amortyzacji Długu (Formuła)
                                </td>
                                <td className="py-3 px-4 text-right text-zinc-300">
                                    {(selectedProject?.debt_facility?.repayment_type || 'annuity').toUpperCase()}
                                </td>
                                <td className="py-3 px-4 text-right font-bold text-zinc-100">
                                    {(repaymentTypeOverride || selectedProject?.debt_facility?.repayment_type || 'annuity').toUpperCase()}
                                </td>
                                <td className="py-3 px-4 text-right">
                                    <span className={repaymentTypeOverride ? 'text-amber-400 font-semibold' : 'text-zinc-400'}>
                                        {repaymentTypeOverride ? 'ZMODYFIKOWANY' : 'ZGODNY Z UMOWĄ'}
                                    </span>
                                </td>
                                <td className="py-3 px-4 text-center">
                                    <UiTooltip content={repaymentTypeOverride ? 'Testowana jest alternatywna formuła amortyzacji' : 'Formuła spłaty w pełni zgodna z umową kredytową'}>
                                        <Badge variant={repaymentTypeOverride ? 'warning' : 'default'}>
                                            {repaymentTypeOverride ? 'SYMULACJA' : 'BAZOWY'}
                                        </Badge>
                                    </UiTooltip>
                                </td>
                            </tr>

                            {/* 9. Total 15Y Interest Expense */}
                            <tr className="hover:bg-zinc-850/40 transition-colors">
                                <td className="py-3 px-4 font-semibold text-zinc-200">
                                    Łączny Koszt Odsetek (15 Lat)
                                </td>
                                <td className="py-3 px-4 text-right text-zinc-300">
                                    {formatMoney(baseResult?.summary?.totalInterest15Y ?? 0)}
                                </td>
                                <td className="py-3 px-4 text-right font-bold text-zinc-100">
                                    {formatMoney(whatIfResult?.summary?.totalInterest15Y ?? 0)}
                                </td>
                                <td className="py-3 px-4 text-right">
                                    {baseResult && whatIfResult && (
                                        <span className={(whatIfResult.summary?.totalInterest15Y ?? 0) <= (baseResult.summary?.totalInterest15Y ?? 0) ? 'text-emerald-400' : 'text-rose-400'}>
                                            {(whatIfResult.summary?.totalInterest15Y ?? 0) > (baseResult.summary?.totalInterest15Y ?? 0) ? '+' : ''}
                                            {formatMoney((whatIfResult.summary?.totalInterest15Y ?? 0) - (baseResult.summary?.totalInterest15Y ?? 0))}
                                        </span>
                                    )}
                                </td>
                                <td className="py-3 px-4 text-center">
                                    <UiTooltip content={(whatIfResult?.summary?.totalInterest15Y ?? 0) <= (baseResult?.summary?.totalInterest15Y ?? 0) ? 'Niższy łączny koszt odsetkowy w horyzoncie 15 lat' : 'Wyższy łączny koszt odsetkowy w horyzoncie 15 lat'}>
                                        <Badge variant={(whatIfResult?.summary?.totalInterest15Y ?? 0) <= (baseResult?.summary?.totalInterest15Y ?? 0) ? 'success' : 'danger'}>
                                            {(whatIfResult?.summary?.totalInterest15Y ?? 0) <= (baseResult?.summary?.totalInterest15Y ?? 0) ? 'OSZCZĘDNOŚĆ' : 'WYŻSZY KOSZT'}
                                        </Badge>
                                    </UiTooltip>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
