import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    RefreshCw,
    Sliders,
    Calendar,
    Coins,
    Building2,
    ShieldCheck,
    CheckCircle2,
    RotateCcw,
    Save,
    AlertCircle,
    Info,
    ChevronDown,
    ChevronUp,
    Zap,
    Cpu,
    Wrench,
    Truck,
    LayoutGrid,
    BarChart2,
    TrendingUp
} from 'lucide-react';
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    ComposedChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
} from 'recharts';
import { useInvestmentProject } from '../../context/InvestmentProjectContext';
import { investmentProjectsApi } from '../../api/investmentProjects';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Card } from '../ui/Card';
import { Tooltip as UiTooltip, InfoTooltip } from '../ui/Tooltip';
import { useTheme } from '../../context/ThemeContext';
import { KST_CLASSIFICATIONS, getKstByCode } from '../../constants/kstClassifications';

export const DEFAULT_REINVESTMENT_PROGRAMS = [
    {
        id: 'prog-a',
        program_type: 'program_a',
        name: 'Program A: Elektronika, SCADA i Falowniki',
        description: 'Cykliczna wymiana elektroniki przemysłowej, falowników PV/BESS, sensorów SCADA i systemów IT',
        enabled: true,
        net_amount: 1500000,
        frequency_years: 5,
        first_occurrence_year: 5,
        kst_code: 'KST_IT',
        kst_annual_rate: 30.0,
        color: 'cyan'
    },
    {
        id: 'prog-b',
        program_type: 'program_b',
        name: 'Program B: Remont Kapitalny Maszyn i Ciągów',
        description: 'Remonty średnie i generalne głównych ciągów technologicznych, generatorów, pomp i armatury',
        enabled: true,
        net_amount: 4000000,
        frequency_years: 7,
        first_occurrence_year: 7,
        kst_code: 'KST_4',
        kst_annual_rate: 10.0,
        color: 'emerald'
    },
    {
        id: 'prog-c',
        program_type: 'program_c',
        name: 'Program C: Tabor i Osprzęt Pomocniczy',
        description: 'Wymiana wózków technologicznych, pojazdów serwisowych, osprzętu pomocniczego i urządzeń magazynowych',
        enabled: true,
        net_amount: 2000000,
        frequency_years: 5,
        first_occurrence_year: 5,
        kst_code: 'KST_7',
        kst_annual_rate: 20.0,
        color: 'purple'
    }
];

// Tooltip component for Recharts reinvestment charts
const ReinvestmentChartTooltip = ({ active, payload, label, currency = 'PLN', formatShortMoney }) => {
    if (!active || !payload || !payload.length) return null;
    const dataPoint = payload[0]?.payload;
    if (!dataPoint) return null;

    const yearTotal = dataPoint.totalCapex || 0;
    const cumulative = dataPoint.cumulativeCapex || 0;

    return (
        <div className="bg-white/95 dark:bg-zinc-950/95 border border-zinc-200 dark:border-zinc-750 rounded p-3 shadow-2xl font-mono text-xs max-w-xs z-50 backdrop-blur-md">
            <div className="text-[10px] uppercase text-zinc-500 dark:text-zinc-400 font-semibold border-b border-zinc-200 dark:border-zinc-800 pb-1.5 mb-2 flex items-center justify-between">
                <span className="text-zinc-800 dark:text-zinc-200">OKRES: {label} (Rok {dataPoint.yearNum})</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                    {formatShortMoney ? formatShortMoney(yearTotal) : `${yearTotal} ${currency}`}
                </span>
            </div>

            {dataPoint.hits && dataPoint.hits.length > 0 ? (
                <div className="space-y-1.5 mb-2.5">
                    {dataPoint.hits.map((h, idx) => {
                        const share = yearTotal > 0 ? Math.round((h.amount / yearTotal) * 100) : 0;
                        const dotClass = h.color === 'cyan' ? 'bg-cyan-400' : h.color === 'emerald' ? 'bg-emerald-400' : 'bg-purple-400';
                        return (
                            <div key={idx} className="flex items-center justify-between gap-3 text-[11px]">
                                <div className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300 truncate max-w-[150px]">
                                    <span className={`w-2 h-2 rounded-full shrink-0 ${dotClass}`} />
                                    <span className="truncate">{h.name}</span>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <span className="font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">
                                        {formatShortMoney ? formatShortMoney(h.amount) : `${h.amount} ${currency}`}
                                    </span>
                                    <span className="text-[9px] text-zinc-500 font-normal">({share}%)</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="text-[11px] text-zinc-500 italic py-1 mb-1">
                    Brak nakładów odtworzeniowych
                </div>
            )}

            <div className="border-t border-zinc-200 dark:border-zinc-800/80 pt-1.5 flex items-center justify-between text-[10px] text-zinc-500 dark:text-zinc-400">
                <span>Skumulowany CAPEX:</span>
                <span className="font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                    {formatShortMoney ? formatShortMoney(cumulative) : `${cumulative} ${currency}`}
                </span>
            </div>
        </div>
    );
};

export const ReinvestmentManager = ({
    onProgramsChange = null,
    initialMultiplier = 1.0,
    initialEnabled = true,
    compact = false
}) => {
    const { isDark } = useTheme();
    const gridStroke = isDark ? '#27272a' : '#e4e4e7';
    const axisLineStroke = isDark ? '#3f3f46' : '#d4d4d8';

    const { selectedProject, loadProjectDetails } = useInvestmentProject();

    const [programs, setPrograms] = useState(DEFAULT_REINVESTMENT_PROGRAMS);
    const [reinvestmentsEnabled, setReinvestmentsEnabled] = useState(initialEnabled);
    const [multiplier, setMultiplier] = useState(initialMultiplier);
    const [viewMode, setViewMode] = useState('matrix'); // 'matrix' | 'stacked_bars' | 'combo_curve'

    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [saveError, setSaveError] = useState(null);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    const currency = selectedProject?.currency || 'PLN';

    // Format money helper
    const formatMoney = useCallback((val) => {
        if (val === null || val === undefined || isNaN(val)) return '0,00 ' + currency;
        return new Intl.NumberFormat('pl-PL', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(val) + ' ' + currency;
    }, [currency]);

    // Format short money helper (e.g. 1.50M PLN)
    const formatShortMoney = useCallback((val) => {
        if (!val || isNaN(val)) return '0 ' + currency;
        if (Math.abs(val) >= 1000000) {
            return (val / 1000000).toFixed(2) + 'M ' + currency;
        }
        if (Math.abs(val) >= 1000) {
            return (val / 1000).toFixed(1) + 'k ' + currency;
        }
        return Number(val).toFixed(0) + ' ' + currency;
    }, [currency]);

    // Load from selectedProject operating_assumptions
    useEffect(() => {
        if (!selectedProject) return;

        const oa = selectedProject.operating_assumptions || {};
        if (Array.isArray(oa.reinvestment_programs) && oa.reinvestment_programs.length > 0) {
            // Merge loaded programs with defaults to ensure colors, icons, and IDs are preserved
            const loaded = DEFAULT_REINVESTMENT_PROGRAMS.map(def => {
                const found = oa.reinvestment_programs.find(p => p.program_type === def.program_type || p.id === def.id);
                if (found) {
                    return {
                        ...def,
                        ...found,
                        name: found.name || def.name,
                        description: found.description !== undefined ? found.description : def.description,
                        net_amount: Number(found.net_amount) || def.net_amount,
                        frequency_years: Number(found.frequency_years) || def.frequency_years,
                        first_occurrence_year: Number(found.first_occurrence_year) || def.first_occurrence_year,
                        kst_annual_rate: found.kst_annual_rate !== undefined ? Number(found.kst_annual_rate) : def.kst_annual_rate,
                        enabled: found.enabled !== undefined ? Boolean(found.enabled) : def.enabled
                    };
                }
                return def;
            });
            setPrograms(loaded);
        } else {
            setPrograms(DEFAULT_REINVESTMENT_PROGRAMS);
        }

        if (oa.reinvestments_enabled !== undefined) {
            setReinvestmentsEnabled(Boolean(oa.reinvestments_enabled));
        } else {
            setReinvestmentsEnabled(initialEnabled);
        }

        setHasUnsavedChanges(false);
        setSaveSuccess(false);
        setSaveError(null);
    }, [selectedProject]);

    // Notify parent on change
    useEffect(() => {
        if (onProgramsChange) {
            onProgramsChange({
                programs,
                reinvestmentsEnabled,
                multiplier
            });
        }
    }, [programs, reinvestmentsEnabled, multiplier, onProgramsChange]);

    // Calculate occurrences for a given program across 15 years
    const getProgramOccurrences = useCallback((prog) => {
        if (!prog.enabled) return [];
        const occurrences = [];
        const first = Math.max(1, Math.min(15, Number(prog.first_occurrence_year) || 1));
        const freq = Math.max(1, Math.min(15, Number(prog.frequency_years) || 1));
        for (let y = first; y <= 15; y += freq) {
            occurrences.push(y);
        }
        return occurrences;
    }, []);

    // 15-Year Timeline Breakdown
    const timelineData = useMemo(() => {
        const years = Array.from({ length: 15 }, (_, i) => i + 1);
        return years.map(year => {
            const hits = [];
            let totalCapexInYear = 0;

            if (reinvestmentsEnabled) {
                programs.forEach(prog => {
                    if (prog.enabled) {
                        const occurrences = getProgramOccurrences(prog);
                        if (occurrences.includes(year)) {
                            const effectiveAmount = (Number(prog.net_amount) || 0) * multiplier;
                            hits.push({
                                programId: prog.id,
                                programType: prog.program_type,
                                name: prog.name,
                                color: prog.color,
                                amount: effectiveAmount,
                                kstCode: prog.kst_code,
                                kstRate: prog.kst_annual_rate
                            });
                            totalCapexInYear += effectiveAmount;
                        }
                    }
                });
            }

            return {
                year,
                hits,
                totalCapex: totalCapexInYear
            };
        });
    }, [programs, reinvestmentsEnabled, multiplier, getProgramOccurrences]);

    // Chart-ready Data Transformation for Recharts
    const chartData = useMemo(() => {
        let runningCumulative = 0;
        return timelineData.map(item => {
            const hitA = item.hits.find(h => h.programType === 'program_a');
            const hitB = item.hits.find(h => h.programType === 'program_b');
            const hitC = item.hits.find(h => h.programType === 'program_c');
            const valA = hitA ? hitA.amount : 0;
            const valB = hitB ? hitB.amount : 0;
            const valC = hitC ? hitC.amount : 0;
            runningCumulative += item.totalCapex;

            return {
                year: `Y${item.year}`,
                yearNum: item.year,
                program_a: valA,
                program_b: valB,
                program_c: valC,
                totalCapex: item.totalCapex,
                cumulativeCapex: runningCumulative,
                hits: item.hits
            };
        });
    }, [timelineData]);

    // Summary KPIs
    const summaryKpis = useMemo(() => {
        let totalCapex15Y = 0;
        let totalEvents = 0;

        timelineData.forEach(period => {
            totalCapex15Y += period.totalCapex;
            totalEvents += period.hits.length;
        });

        const annualAverage = totalCapex15Y / 15.0;
        const citTaxShield19 = totalCapex15Y * 0.19; // 19% CIT standard depreciation shield

        return {
            totalCapex15Y,
            totalEvents,
            annualAverage,
            citTaxShield19
        };
    }, [timelineData]);

    // Handle field change in specific program
    const handleProgramChange = (index, field, value) => {
        setPrograms(prev => {
            const next = [...prev];
            next[index] = {
                ...next[index],
                [field]: value
            };
            // If kst_code changed, automatically update kst_annual_rate
            if (field === 'kst_code') {
                const kstObj = getKstByCode(value);
                next[index].kst_annual_rate = kstObj.rate;
            }
            return next;
        });
        setHasUnsavedChanges(true);
        setSaveSuccess(false);
    };

    // Toggle individual program
    const toggleProgramEnabled = (index) => {
        setPrograms(prev => {
            const next = [...prev];
            next[index] = {
                ...next[index],
                enabled: !next[index].enabled
            };
            return next;
        });
        setHasUnsavedChanges(true);
        setSaveSuccess(false);
    };

    // Reset to defaults
    const handleResetDefaults = () => {
        setPrograms(DEFAULT_REINVESTMENT_PROGRAMS);
        setReinvestmentsEnabled(true);
        setMultiplier(1.0);
        setHasUnsavedChanges(true);
        setSaveSuccess(false);
    };

    // Save to backend API
    const handleSave = async () => {
        if (!selectedProject?.id) {
            setSaveError('Brak wybranego projektu do zapisu założeń.');
            return;
        }

        setIsSaving(true);
        setSaveError(null);
        setSaveSuccess(false);

        try {
            const existingAssumptions = selectedProject.operating_assumptions || {};
            const payload = {
                operating_assumptions: {
                    ...existingAssumptions,
                    reinvestment_programs: programs.map(p => ({
                        id: p.id,
                        program_type: p.program_type,
                        name: p.name,
                        description: p.description,
                        enabled: p.enabled,
                        net_amount: Number(p.net_amount),
                        frequency_years: Number(p.frequency_years),
                        first_occurrence_year: Number(p.first_occurrence_year),
                        kst_code: p.kst_code,
                        kst_annual_rate: Number(p.kst_annual_rate)
                    })),
                    reinvestments_enabled: reinvestmentsEnabled
                }
            };

            await investmentProjectsApi.updateProject(selectedProject.id, payload);
            await loadProjectDetails(selectedProject.id);

            setSaveSuccess(true);
            setHasUnsavedChanges(false);
            setTimeout(() => setSaveSuccess(false), 4000);
        } catch (err) {
            console.error('[ReinvestmentManager] Save failed:', err);
            setSaveError(err.response?.data?.message || err.message || 'Wystąpił błąd podczas zapisu programów odtworzeniowych.');
        } finally {
            setIsSaving(false);
        }
    };

    const getProgramIcon = (type) => {
        switch (type) {
            case 'program_a':
                return <Cpu className="w-4 h-4 text-cyan-400" />;
            case 'program_b':
                return <Wrench className="w-4 h-4 text-emerald-400" />;
            case 'program_c':
                return <Truck className="w-4 h-4 text-purple-400" />;
            default:
                return <RefreshCw className="w-4 h-4 text-zinc-400" />;
        }
    };

    const getProgramBadgeColor = (color) => {
        switch (color) {
            case 'cyan':
                return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
            case 'emerald':
                return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
            case 'purple':
                return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
            default:
                return 'bg-zinc-800 text-zinc-300 border-zinc-700';
        }
    };

    return (
        <div className="space-y-6">
            {/* Header & Master Controls */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                        <UiTooltip content="Harmonogram cyklicznych nakładów odtworzeniowych">
                            <div
                                tabIndex={0}
                                className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0 cursor-help focus:outline-none"
                            >
                                <RefreshCw className="w-5 h-5" />
                            </div>
                        </UiTooltip>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-base font-bold text-zinc-100 uppercase tracking-wide">
                                    Harmonogram Nakładów Odtworzeniowych (Reinvestment CAPEX)
                                </h3>
                                <InfoTooltip
                                    content="Cykliczne nakłady odtworzeniowe technologii (np. inwertery, falowniki, SCADA, ogniwa) w horyzoncie 15 lat z uwzględnieniem odpisów amortyzacyjnych KŚT i tarczy podatkowej CIT."
                                    ariaLabel="Informacje o harmonogramie nakładów odtworzeniowych"
                                    size="xs"
                                />
                                <UiTooltip content="Horyzont projekcji 15-letniej z przypisanymi stawkami KŚT">
                                    <span>
                                        <Badge variant="neutral">KŚT / 15L</Badge>
                                    </span>
                                </UiTooltip>
                            </div>
                            <p className="text-xs text-zinc-400 mt-1">
                                Cykliczne odtworzenia środków trwałych (Nakłady A, B, C) z indywidualną amortyzacją KŚT w horyzoncie 15 lat.
                            </p>
                        </div>
                    </div>

                    {/* Master Switch & Multiplier */}
                    <div className="flex flex-wrap items-center gap-4 bg-zinc-950/60 p-3 rounded-lg border border-zinc-800/80">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={reinvestmentsEnabled}
                                onChange={(e) => {
                                    setReinvestmentsEnabled(e.target.checked);
                                    setHasUnsavedChanges(true);
                                }}
                                className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-emerald-500 focus:ring-emerald-500/30 focus:ring-offset-0"
                            />
                            <span className="text-xs font-semibold text-zinc-200">
                                Włącz Reinvestment w Modelu
                            </span>
                        </label>

                        <div className="h-4 w-[1px] bg-zinc-800 hidden sm:block" />

                        {/* Multiplier scale */}
                        <div className="flex items-center gap-2 text-xs">
                            <span className="text-zinc-400">Skala What-If:</span>
                            <span className="font-mono font-bold text-emerald-400">
                                {Math.round(multiplier * 100)}%
                            </span>
                            <UiTooltip content="Mnożnik nakładów odtworzeniowych w symulacji (50% - 150%)">
                                <input
                                    type="range"
                                    min="0.5"
                                    max="1.5"
                                    step="0.05"
                                    value={multiplier}
                                    onChange={(e) => setMultiplier(parseFloat(e.target.value))}
                                    className="w-24 accent-emerald-500 cursor-pointer h-1.5 bg-zinc-800 rounded-lg"
                                    title="Mnożnik nakładów odtworzeniowych w symulacji"
                                    aria-label="Mnożnik nakładów odtworzeniowych w symulacji"
                                />
                            </UiTooltip>
                        </div>
                    </div>
                </div>

                {/* KPI Metric Strip */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5 pt-5 border-t border-zinc-800/80">
                    <div className="bg-zinc-950/50 p-3 rounded border border-zinc-800">
                        <div className="flex items-center justify-between text-[11px] text-zinc-400 uppercase tracking-wider font-semibold">
                            <span>Suma Reinvestmentu (15L)</span>
                            <InfoTooltip
                                content="Łączna suma nakładów odtworzeniowych zaplanowanych dla wszystkich aktywnych programów w 15-letnim horyzoncie."
                                ariaLabel="Informacje o sumie reinvestmentu"
                                size="xs"
                            />
                        </div>
                        <div className="text-base font-mono font-bold text-zinc-100 mt-1">
                            {formatMoney(summaryKpis.totalCapex15Y)}
                        </div>
                        <div className="text-[10px] text-zinc-500 mt-0.5">
                            {reinvestmentsEnabled ? `${summaryKpis.totalEvents} cykli odtworzeniowych` : 'Wyłączone w kalkulacji'}
                        </div>
                    </div>

                    <div className="bg-zinc-950/50 p-3 rounded border border-zinc-800">
                        <div className="flex items-center justify-between text-[11px] text-zinc-400 uppercase tracking-wider font-semibold">
                            <span>Średnioroczny Reinvestment</span>
                            <InfoTooltip
                                content="Średnie roczne obciążenie przepływów pieniężnych (FCFF) wynikające z wymiany zużywających się aktywów."
                                ariaLabel="Informacje o średniorocznym reinvestmencie"
                                size="xs"
                            />
                        </div>
                        <div className="text-base font-mono font-bold text-emerald-400 mt-1">
                            {formatMoney(summaryKpis.annualAverage)}
                        </div>
                        <div className="text-[10px] text-zinc-500 mt-0.5">
                            Średnie roczne obciążenie FCFF
                        </div>
                    </div>

                    <div className="bg-zinc-950/50 p-3 rounded border border-zinc-800">
                        <div className="flex items-center justify-between text-[11px] text-zinc-400 uppercase tracking-wider font-semibold">
                            <span>Liczba Interwencji CAPEX</span>
                            <InfoTooltip
                                content="Liczba zdarzeń wymiany sprzętu technologicznego zaplanowanych w okresie 15 lat."
                                ariaLabel="Informacje o liczbie interwencji CAPEX"
                                size="xs"
                            />
                        </div>
                        <div className="text-base font-mono font-bold text-cyan-400 mt-1">
                            {summaryKpis.totalEvents} zdarzeń
                        </div>
                        <div className="text-[10px] text-zinc-500 mt-0.5">
                            W latach operacyjnych 1-15
                        </div>
                    </div>

                    <div className="bg-zinc-950/50 p-3 rounded border border-zinc-800">
                        <div className="flex items-center justify-between text-[11px] text-zinc-400 uppercase tracking-wider font-semibold">
                            <span>Tarcza Podatkowa (CIT 19%)</span>
                            <InfoTooltip
                                content="Oszczędność podatkowa wynikająca z odpisów amortyzacyjnych KŚT dla zrealizowanych odtworzeń (stawka 19%)."
                                ariaLabel="Informacje o tarczy podatkowej CIT"
                                size="xs"
                            />
                        </div>
                        <div className="text-base font-mono font-bold text-purple-400 mt-1">
                            +{formatMoney(summaryKpis.citTaxShield19)}
                        </div>
                        <div className="text-[10px] text-zinc-500 mt-0.5">
                            Z amortyzacji odtworzeń KŚT
                        </div>
                    </div>
                </div>
            </div>

            {/* Program Cards A, B, C */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {programs.map((prog, index) => {
                    const occurrences = getProgramOccurrences(prog);
                    const totalProgCost = occurrences.length * (Number(prog.net_amount) || 0) * multiplier;
                    const kstObj = getKstByCode(prog.kst_code);

                    return (
                        <div
                            key={prog.id}
                            className={`bg-zinc-900 border rounded-lg p-4 flex flex-col justify-between transition-all ${
                                prog.enabled
                                    ? 'border-zinc-700 shadow-sm'
                                    : 'border-zinc-800/60 opacity-60 bg-zinc-900/40'
                            }`}
                        >
                            <div className="space-y-4">
                                {/* Card Header */}
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                        <div className="p-2 rounded bg-zinc-800 border border-zinc-700/80">
                                            {getProgramIcon(prog.program_type)}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className={`text-xs px-2 py-0.5 rounded font-bold border ${getProgramBadgeColor(prog.color)}`}>
                                                    {prog.program_type === 'program_a' ? 'NAKŁAD A' : prog.program_type === 'program_b' ? 'NAKŁAD B' : 'NAKŁAD C'}
                                                </span>
                                            </div>
                                            <h4 className="text-xs font-bold text-zinc-200 mt-1 line-clamp-1" title={prog.name}>
                                                {prog.name}
                                            </h4>
                                        </div>
                                    </div>

                                    {/* Enable switch */}
                                    <UiTooltip content={prog.enabled ? "Wyłącz ten program odtworzeniowy" : "Włącz ten program odtworzeniowy w kalkulacji"}>
                                        <label className="flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={prog.enabled}
                                                onChange={() => toggleProgramEnabled(index)}
                                                aria-label={`Przełącz program ${prog.program_type === 'program_a' ? 'A' : prog.program_type === 'program_b' ? 'B' : 'C'}`}
                                                className="w-4 h-4 rounded border-zinc-700 bg-zinc-950 text-emerald-500 focus:ring-0"
                                            />
                                        </label>
                                    </UiTooltip>
                                </div>

                                {/* Program Name & Description Fields */}
                                <div className="space-y-2 pt-1">
                                    <div>
                                        <label className="block text-[10px] uppercase font-semibold text-zinc-400 mb-1">
                                            Nazwa Programu
                                        </label>
                                        <input
                                            type="text"
                                            aria-label={`Nazwa Programu ${prog.program_type === 'program_a' ? 'A' : prog.program_type === 'program_b' ? 'B' : 'C'}`}
                                            value={prog.name}
                                            disabled={!prog.enabled}
                                            onChange={(e) => handleProgramChange(index, 'name', e.target.value)}
                                            placeholder="Nazwa programu odtworzeniowego..."
                                            className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-xs font-semibold text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] uppercase font-semibold text-zinc-400 mb-1">
                                            Opis i Zakres Rzeczowy
                                        </label>
                                        <textarea
                                            rows={2}
                                            aria-label={`Opis i Zakres Rzeczowy ${prog.program_type === 'program_a' ? 'A' : prog.program_type === 'program_b' ? 'B' : 'C'}`}
                                            value={prog.description || ''}
                                            disabled={!prog.enabled}
                                            onChange={(e) => handleProgramChange(index, 'description', e.target.value)}
                                            placeholder="Zakres planowanych prac i odtworzeń..."
                                            className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-[11px] text-zinc-300 placeholder:text-zinc-600 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 disabled:opacity-50 resize-none leading-relaxed"
                                        />
                                    </div>
                                </div>

                                {/* Input fields */}
                                <div className="space-y-3 pt-2 border-t border-zinc-800">
                                    {/* Net Amount */}
                                    <div>
                                        <div className="flex items-center justify-between mb-1">
                                            <label className="block text-[10px] uppercase font-semibold text-zinc-400">
                                                Kwota jednostkowa netto ({currency})
                                            </label>
                                            <InfoTooltip
                                                content="Jednorazowy koszt odtworzenia lub modernizacji urządzeń w danym cyklu wymiany."
                                                ariaLabel="Informacje o kwocie jednostkowej"
                                                size="xs"
                                            />
                                        </div>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                min="0"
                                                step="10000"
                                                value={prog.net_amount}
                                                disabled={!prog.enabled}
                                                onChange={(e) => handleProgramChange(index, 'net_amount', parseFloat(e.target.value) || 0)}
                                                className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-1.5 text-xs font-mono text-zinc-100 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
                                            />
                                            <span className="absolute right-3 top-1.5 text-[10px] text-zinc-500">
                                                {formatShortMoney(prog.net_amount)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Frequency & First Year */}
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <div className="flex items-center justify-between mb-1">
                                                <label className="block text-[10px] uppercase font-semibold text-zinc-400">
                                                    Częstotliwość
                                                </label>
                                                <InfoTooltip
                                                    content="Odstęp czasu w latach pomiędzy kolejnymi wymianami i modernizacjami technologii."
                                                    ariaLabel="Informacje o częstotliwości wymiany"
                                                    size="xs"
                                                />
                                            </div>
                                            <select
                                                value={prog.frequency_years}
                                                disabled={!prog.enabled}
                                                onChange={(e) => handleProgramChange(index, 'frequency_years', parseInt(e.target.value, 10))}
                                                className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-xs font-mono text-zinc-100 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
                                            >
                                                <option value={2}>Co 2 lata</option>
                                                <option value={3}>Co 3 lata</option>
                                                <option value={4}>Co 4 lata</option>
                                                <option value={5}>Co 5 lat</option>
                                                <option value={6}>Co 6 lat</option>
                                                <option value={7}>Co 7 lat</option>
                                                <option value={8}>Co 8 lat</option>
                                                <option value={10}>Co 10 lat</option>
                                            </select>
                                        </div>

                                        <div>
                                            <div className="flex items-center justify-between mb-1">
                                                <label className="block text-[10px] uppercase font-semibold text-zinc-400">
                                                    Pierwszy rok
                                                </label>
                                                <InfoTooltip
                                                    content="Pierwszy rok fazy operacyjnej projektu, w którym wystąpi dany nakład odtworzeniowy."
                                                    ariaLabel="Informacje o pierwszym roku wystąpienia"
                                                    size="xs"
                                                />
                                            </div>
                                            <select
                                                value={prog.first_occurrence_year}
                                                disabled={!prog.enabled}
                                                onChange={(e) => handleProgramChange(index, 'first_occurrence_year', parseInt(e.target.value, 10))}
                                                className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-xs font-mono text-zinc-100 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
                                            >
                                                {Array.from({ length: 15 }, (_, i) => i + 1).map(yr => (
                                                    <option key={yr} value={yr}>Rok {yr}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    {/* KŚT Classification */}
                                    <div>
                                        <div className="flex items-center justify-between mb-1">
                                            <div className="flex items-center gap-1">
                                                <label className="text-[10px] uppercase font-semibold text-zinc-400">
                                                    Klasyfikacja KŚT i Stawka
                                                </label>
                                                <InfoTooltip
                                                    content="Kategoria Klasyfikacji Środków Trwałych i roczna stawka amortyzacji odpisów dla nakładu odtworzeniowego."
                                                    ariaLabel="Informacje o klasyfikacji KŚT nakładu"
                                                    size="xs"
                                                />
                                            </div>
                                            <span className="text-[10px] font-mono text-emerald-400 font-bold">
                                                {prog.kst_annual_rate}% rocznie
                                            </span>
                                        </div>
                                        <select
                                            value={prog.kst_code}
                                            disabled={!prog.enabled}
                                            onChange={(e) => handleProgramChange(index, 'kst_code', e.target.value)}
                                            className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-xs font-mono text-zinc-100 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
                                        >
                                            {KST_CLASSIFICATIONS.map(k => (
                                                <option key={k.code} value={k.code}>
                                                    {k.code} - {k.name} ({k.rate}%)
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Card Footer: Summary calculation for this program */}
                            <div className="mt-4 pt-3 border-t border-zinc-800/80 text-[11px] bg-zinc-950/40 -mx-4 -mb-4 p-4 rounded-b-lg space-y-1 font-mono">
                                <div className="flex justify-between text-zinc-400">
                                    <span>Wystąpienia (15L):</span>
                                    <span className="text-zinc-200 font-bold">
                                        {occurrences.length > 0
                                            ? occurrences.map(y => `Y${y}`).join(', ')
                                            : 'Brak'}
                                    </span>
                                </div>
                                <div className="flex justify-between text-zinc-400">
                                    <span>Łącznie w 15 latach:</span>
                                    <span className="text-emerald-400 font-bold">
                                        {formatMoney(totalProgCost)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Interactive 15-Year Timeline Gantt & Charts Section */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div>
                        <div className="flex items-center gap-2">
                            <h4 className="text-xs font-bold text-zinc-100 uppercase tracking-wider flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-emerald-400" />
                                Matryca Wdrożeń Reinvestmentu (15-Year Timeline)
                            </h4>
                            <InfoTooltip
                                content="Wizualizacja lat uderzenia nakładów odtworzeniowych A, B, C oraz rocznego zapotrzebowania CAPEX w trybie tabelarycznym i wykresowym."
                                ariaLabel="Informacje o matrycy wdrożeń reinvestmentu"
                                size="xs"
                            />
                        </div>
                        <p className="text-[11px] text-zinc-400 mt-0.5">
                            Wizualizacja lat uderzenia nakładów odtworzeniowych A, B, C oraz rocznego zapotrzebowania CAPEX.
                        </p>
                    </div>

                    {/* View Mode Switcher */}
                    <div className="flex items-center bg-zinc-950 p-1 rounded border border-zinc-800 self-start sm:self-auto" role="tablist" aria-label="Wybór trybu wizualizacji">
                        <UiTooltip content="Siatka kalendarzowa (15 lat) - macierz wdrożeń nakładów rok po roku">
                            <button
                                type="button"
                                role="tab"
                                aria-selected={viewMode === 'matrix'}
                                onClick={() => setViewMode('matrix')}
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                                    viewMode === 'matrix'
                                        ? 'bg-zinc-800 text-zinc-100 shadow-xs'
                                        : 'text-zinc-400 hover:text-zinc-200'
                                }`}
                                title="Siatka kalendarzowa (15 lat)"
                                aria-label="Siatka kalendarzowa 15 lat"
                            >
                                <LayoutGrid className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Siatka 15L</span>
                            </button>
                        </UiTooltip>
                        <UiTooltip content="Wykres słupkowy skumulowanych nakładów rocznych wg programów A, B, C">
                            <button
                                type="button"
                                role="tab"
                                aria-selected={viewMode === 'stacked_bars'}
                                onClick={() => setViewMode('stacked_bars')}
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                                    viewMode === 'stacked_bars'
                                        ? 'bg-zinc-800 text-zinc-100 shadow-xs'
                                        : 'text-zinc-400 hover:text-zinc-200'
                                }`}
                                title="Wykres słupkowy skumulowany nakładów rocznych"
                                aria-label="Wykres słupkowy nakładów rocznych"
                            >
                                <BarChart2 className="w-3.5 h-3.5 text-cyan-400" />
                                <span>Słupki CAPEX</span>
                            </button>
                        </UiTooltip>
                        <UiTooltip content="Wykres łączony: roczne nakłady CAPEX oraz skumulowana krzywa S (S-Curve)">
                            <button
                                type="button"
                                role="tab"
                                aria-selected={viewMode === 'combo_curve'}
                                onClick={() => setViewMode('combo_curve')}
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                                    viewMode === 'combo_curve'
                                        ? 'bg-zinc-800 text-zinc-100 shadow-xs'
                                        : 'text-zinc-400 hover:text-zinc-200'
                                }`}
                                title="Wykres łączony: roczne CAPEX + linia narastająca (S-Curve)"
                                aria-label="Wykres łączony S-Curve"
                            >
                                <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                                <span>S-Curve (Narastająco)</span>
                            </button>
                        </UiTooltip>
                    </div>
                </div>

                {/* Sub-bar with Legend */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-zinc-800/60 text-[10px]" data-testid="timeline-legend">
                    <div className="flex flex-wrap items-center gap-3">
                        {reinvestmentsEnabled ? (
                            programs.filter(p => p.enabled).length > 0 ? (
                                programs.filter(p => p.enabled).map(p => {
                                    const badgeLabel = p.program_type === 'program_a' ? 'Nakład A' : p.program_type === 'program_b' ? 'Nakład B' : 'Nakład C';
                                    const cleanName = p.name ? p.name.replace(/^Program\s+[A-C]:\s*/i, '').trim() : '';
                                    const displayLabel = cleanName ? `${badgeLabel} (${cleanName})` : badgeLabel;
                                    const textColor = p.color === 'cyan' ? 'text-cyan-400' : p.color === 'emerald' ? 'text-emerald-400' : 'text-purple-400';
                                    const dotColor = p.color === 'cyan' ? 'bg-cyan-400' : p.color === 'emerald' ? 'bg-emerald-400' : 'bg-purple-400';

                                    return (
                                        <UiTooltip key={p.id} content={`Aktywny program: ${p.name || displayLabel}`}>
                                            <span tabIndex={0} className={`flex items-center gap-1 ${textColor} cursor-help focus:outline-none`} title={p.name}>
                                                <span className={`w-2 h-2 rounded-full ${dotColor}`} /> {displayLabel}
                                            </span>
                                        </UiTooltip>
                                    );
                                })
                            ) : (
                                <span className="text-zinc-500 italic">Brak aktywnych nakładów</span>
                            )
                        ) : (
                            <span className="text-zinc-500 italic">Reinvestment wyłączony w modelu</span>
                        )}

                        {/* Extra legend entry for S-Curve line when combo_curve mode is active */}
                        {viewMode === 'combo_curve' && reinvestmentsEnabled && programs.some(p => p.enabled) && (
                            <UiTooltip content="Skumulowana suma nakładów odtworzeniowych od początku operacji">
                                <span tabIndex={0} className="flex items-center gap-1.5 text-amber-400 font-medium ml-1 cursor-help focus:outline-none">
                                    <span className="w-2.5 h-0.5 bg-amber-400 inline-block" /> Skumulowany CAPEX (Krzywa S)
                                </span>
                            </UiTooltip>
                        )}
                    </div>

                    <div className="text-zinc-500 font-mono text-[9px] uppercase">
                        Horyzont: 15 Lat • Waluta: {currency}
                    </div>
                </div>

                {/* VIEW 1: Grid of 15 Years */}
                {viewMode === 'matrix' && (
                    <div className="overflow-x-auto pb-2" data-testid="timeline-matrix-view">
                        <div
                            className="grid grid-cols-15 min-w-[750px] gap-1.5"
                            style={{ gridTemplateColumns: 'repeat(15, minmax(0, 1fr))' }}
                        >
                            {timelineData.map(({ year, hits, totalCapex }) => {
                                const hasHits = hits.length > 0;
                                return (
                                    <div
                                        key={year}
                                        className={`flex flex-col items-center justify-between p-2 rounded border text-center transition-all min-h-[110px] ${
                                            hasHits
                                                ? 'bg-zinc-950/80 border-zinc-700 hover:border-emerald-500/50'
                                                : 'bg-zinc-950/20 border-zinc-800/40 text-zinc-600'
                                        }`}
                                    >
                                        {/* Year Label */}
                                        <div className="text-[11px] font-mono font-bold text-zinc-300">
                                            Y{year}
                                        </div>

                                        {/* Program Badges */}
                                        <div className="flex flex-col gap-1 my-1 w-full items-center">
                                            {hasHits ? (
                                                hits.map((h, i) => (
                                                    <UiTooltip key={i} content={`${h.name}: ${formatMoney(h.amount)} (Rok Y${year})`}>
                                                        <span
                                                            tabIndex={0}
                                                            title={`${h.name}: ${formatShortMoney(h.amount)}`}
                                                            className={`w-full py-0.5 px-1 rounded text-[9px] font-mono font-bold truncate cursor-help focus:outline-none ${
                                                                h.color === 'cyan'
                                                                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                                                                    : h.color === 'emerald'
                                                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                                                    : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                                            }`}
                                                        >
                                                            {h.programType === 'program_a' ? 'A' : h.programType === 'program_b' ? 'B' : 'C'}
                                                        </span>
                                                    </UiTooltip>
                                                ))
                                            ) : (
                                                <span className="text-[11px] text-zinc-700">—</span>
                                            )}
                                        </div>

                                        {/* Total Capex in Year */}
                                        <div className="text-[9px] font-mono font-bold mt-auto truncate w-full">
                                            {hasHits ? (
                                                <span className="text-zinc-100">
                                                    {formatShortMoney(totalCapex)}
                                                </span>
                                            ) : (
                                                <span className="text-zinc-700">0</span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* VIEW 2: Stacked Bar Chart */}
                {viewMode === 'stacked_bars' && (
                    <div className="w-full h-72 pt-2" data-testid="timeline-stacked-bars-view">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={chartData}
                                margin={{ top: 15, right: 15, left: -5, bottom: 0 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                                <XAxis
                                    dataKey="year"
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
                                    tickFormatter={(v) => formatShortMoney(v)}
                                />
                                <RechartsTooltip
                                    content={<ReinvestmentChartTooltip currency={currency} formatShortMoney={formatShortMoney} />}
                                />
                                {programs.find(p => p.program_type === 'program_a')?.enabled && (
                                    <Bar
                                        dataKey="program_a"
                                        stackId="capex"
                                        fill="#22d3ee"
                                        name={programs.find(p => p.program_type === 'program_a')?.name || 'Nakład A'}
                                        radius={[0, 0, 0, 0]}
                                    />
                                )}
                                {programs.find(p => p.program_type === 'program_b')?.enabled && (
                                    <Bar
                                        dataKey="program_b"
                                        stackId="capex"
                                        fill="#34d399"
                                        name={programs.find(p => p.program_type === 'program_b')?.name || 'Nakład B'}
                                        radius={[0, 0, 0, 0]}
                                    />
                                )}
                                {programs.find(p => p.program_type === 'program_c')?.enabled && (
                                    <Bar
                                        dataKey="program_c"
                                        stackId="capex"
                                        fill="#c084fc"
                                        name={programs.find(p => p.program_type === 'program_c')?.name || 'Nakład C'}
                                        radius={[2, 2, 0, 0]}
                                    />
                                )}
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}

                {/* VIEW 3: Composed S-Curve Chart (Stacked Bars + Cumulative Line) */}
                {viewMode === 'combo_curve' && (
                    <div className="w-full h-72 pt-2" data-testid="timeline-combo-curve-view">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart
                                data={chartData}
                                margin={{ top: 15, right: 20, left: -5, bottom: 0 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                                <XAxis
                                    dataKey="year"
                                    stroke="#71717a"
                                    fontSize={10}
                                    fontFamily="JetBrains Mono, monospace"
                                    tickLine={false}
                                    axisLine={{ stroke: axisLineStroke }}
                                />
                                <YAxis
                                    yAxisId="left"
                                    stroke="#71717a"
                                    fontSize={10}
                                    fontFamily="JetBrains Mono, monospace"
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(v) => formatShortMoney(v)}
                                />
                                <YAxis
                                    yAxisId="right"
                                    orientation="right"
                                    stroke="#f59e0b"
                                    fontSize={10}
                                    fontFamily="JetBrains Mono, monospace"
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(v) => formatShortMoney(v)}
                                />
                                <RechartsTooltip
                                    content={<ReinvestmentChartTooltip currency={currency} formatShortMoney={formatShortMoney} />}
                                />
                                {programs.find(p => p.program_type === 'program_a')?.enabled && (
                                    <Bar
                                        yAxisId="left"
                                        dataKey="program_a"
                                        stackId="capex"
                                        fill="#22d3ee"
                                        name={programs.find(p => p.program_type === 'program_a')?.name || 'Nakład A'}
                                    />
                                )}
                                {programs.find(p => p.program_type === 'program_b')?.enabled && (
                                    <Bar
                                        yAxisId="left"
                                        dataKey="program_b"
                                        stackId="capex"
                                        fill="#34d399"
                                        name={programs.find(p => p.program_type === 'program_b')?.name || 'Nakład B'}
                                    />
                                )}
                                {programs.find(p => p.program_type === 'program_c')?.enabled && (
                                    <Bar
                                        yAxisId="left"
                                        dataKey="program_c"
                                        stackId="capex"
                                        fill="#c084fc"
                                        name={programs.find(p => p.program_type === 'program_c')?.name || 'Nakład C'}
                                        radius={[2, 2, 0, 0]}
                                    />
                                )}
                                <Line
                                    yAxisId="right"
                                    type="monotone"
                                    dataKey="cumulativeCapex"
                                    stroke="#f59e0b"
                                    strokeWidth={2.5}
                                    dot={{ r: 3, fill: '#f59e0b', stroke: '#09090b', strokeWidth: 1 }}
                                    activeDot={{ r: 5 }}
                                    name="Skumulowany CAPEX"
                                />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>

            {/* Bottom Actions & Notifications */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                <div className="flex items-center gap-3">
                    <UiTooltip content="Przywróć domyślne parametry i stawki programów odtworzeniowych A, B, C">
                        <span>
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={handleResetDefaults}
                                icon={RotateCcw}
                                aria-label="Przywróć domyślne A, B, C"
                            >
                                Przywróć Domyślne A, B, C
                            </Button>
                        </span>
                    </UiTooltip>

                    {hasUnsavedChanges && (
                        <UiTooltip content="Wprowadzono modyfikacje w programach, które nie zostały jeszcze zapisane w bazie">
                            <span tabIndex={0} className="text-xs text-amber-400 flex items-center gap-1.5 font-mono cursor-help focus:outline-none">
                                <AlertCircle className="w-3.5 h-3.5" />
                                Niezapisane zmiany założeń
                            </span>
                        </UiTooltip>
                    )}

                    {saveSuccess && (
                        <span className="text-xs text-emerald-400 flex items-center gap-1.5 font-mono">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Programy odtworzeniowe zostały pomyślnie zapisane
                        </span>
                    )}

                    {saveError && (
                        <span className="text-xs text-rose-400 flex items-center gap-1.5 font-mono">
                            <AlertCircle className="w-3.5 h-3.5" />
                            {saveError}
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <UiTooltip content="Zapisz zaktualizowaną konfigurację programów reinvestmentu w projekcie">
                        <span>
                            <Button
                                variant="primary"
                                size="sm"
                                onClick={handleSave}
                                disabled={isSaving || !hasUnsavedChanges}
                                loading={isSaving}
                                icon={Save}
                                aria-label="Zapisz założenia reinvestmentu"
                            >
                                Zapisz Założenia Reinvestmentu
                            </Button>
                        </span>
                    </UiTooltip>
                </div>
            </div>
        </div>
    );
};
