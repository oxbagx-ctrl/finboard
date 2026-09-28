import React, { useState } from 'react';
import {
    Activity,
    TrendingUp,
    TrendingDown,
    AlertTriangle,
    Flame,
    Users,
    RotateCcw,
    Sliders,
    Info,
    Check,
    ChevronDown,
    ShieldAlert
} from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Tooltip, InfoTooltip } from '../ui/Tooltip';

export const SCENARIO_PRESETS = [
    {
        id: 'base',
        label: 'Bazowy (Base Case)',
        shortName: 'Bazowy',
        badge: 'STANDARD',
        badgeVariant: 'default',
        icon: Activity,
        accentColor: 'zinc',
        description: 'Nominalne parametry z modelu inwestycyjnego. Zerowe delty, standardowy WACC i spłata z umowy.',
        deltas: {
            capexDelta: 0,
            revenueDelta: 0,
            varCostDelta: 0,
            fixedCostDelta: 0,
            payrollDelta: 0,
            reinvestmentDelta: 0,
            waccOverride: null,
            repaymentTypeOverride: null,
        }
    },
    {
        id: 'optimistic',
        label: 'Optymistyczny (Bull Case)',
        shortName: 'Optymistyczny',
        badge: 'EXPANSION',
        badgeVariant: 'success',
        icon: TrendingUp,
        accentColor: 'emerald',
        description: 'Wzrost wolumenu (+15%), oszczędności CAPEX (-5%), synergie operacyjne (-5% koszty zm.), niska inflacja.',
        deltas: {
            capexDelta: -5,
            revenueDelta: 15,
            varCostDelta: -5,
            fixedCostDelta: 0,
            payrollDelta: 2,
            reinvestmentDelta: -10,
            waccOverride: null,
            repaymentTypeOverride: null,
        }
    },
    {
        id: 'pessimistic',
        label: 'Stres-Test Bankowy (Bear Case)',
        shortName: 'Stres-Test Bankowy',
        badge: 'STRESS TEST',
        badgeVariant: 'danger',
        icon: TrendingDown,
        accentColor: 'rose',
        description: 'Spadek przychodów (-15%), przekroczenie budżetu budowy (+20%), wzrost cen surowców i mediów (+10%).',
        deltas: {
            capexDelta: 20,
            revenueDelta: -15,
            varCostDelta: 10,
            fixedCostDelta: 10,
            payrollDelta: 8,
            reinvestmentDelta: 25,
            waccOverride: null,
            repaymentTypeOverride: null,
        }
    },
    {
        id: 'stagflation',
        label: 'Stagflacja & Szok Makro',
        shortName: 'Stagflacja',
        badge: 'MACRO RISK',
        badgeVariant: 'warning',
        icon: Flame,
        accentColor: 'amber',
        description: 'Spadek popytu (-10%), skok kosztów zmiennych (+20%), inflacja stała (+15%), wyższy WACC (+2.0 p.p.).',
        deltas: {
            capexDelta: 5,
            revenueDelta: -10,
            varCostDelta: 20,
            fixedCostDelta: 15,
            payrollDelta: 12,
            reinvestmentDelta: 15,
            waccDelta: 2.0, // Added to base WACC
            repaymentTypeOverride: null,
        }
    },
    {
        id: 'wage_shock',
        label: 'Szok Płacowy & Kadrowy',
        shortName: 'Presja Płacowa',
        badge: 'LABOR PUSH',
        badgeVariant: 'purple',
        icon: Users,
        accentColor: 'purple',
        description: 'Skok kosztów wynagrodzeń (+20%), presja na stawki serwisu i firm zewnętrznych (+5%).',
        deltas: {
            capexDelta: 0,
            revenueDelta: 0,
            varCostDelta: 5,
            fixedCostDelta: 5,
            payrollDelta: 20,
            reinvestmentDelta: 5,
            waccOverride: null,
            repaymentTypeOverride: null,
        }
    },
];

export const ScenarioPresetSelector = ({
    activeScenario = 'base',
    onSelectScenario,
    onReset,
    baseWacc = 8.50,
    className = ''
}) => {
    const [hoveredScenario, setHoveredScenario] = useState(null);

    const handleSelect = (preset) => {
        const deltas = { ...preset.deltas };
        if (deltas.waccDelta !== undefined && deltas.waccDelta !== null) {
            deltas.waccOverride = Math.round((baseWacc + deltas.waccDelta) * 100) / 100;
        }
        if (onSelectScenario) {
            onSelectScenario(preset.id, deltas);
        }
    };

    const activePresetObj = SCENARIO_PRESETS.find(p => p.id === activeScenario) || {
        id: 'custom',
        label: 'Scenariusz Własny (Custom What-If)',
        shortName: 'Własny',
        badge: 'CUSTOM',
        badgeVariant: 'brand',
        icon: Sliders,
        description: 'Indywidualna konfiguracja suwaków wrażliwości ustalona ręcznie przez użytkownika.'
    };

    const displayInfoScenario = hoveredScenario || activePresetObj;

    return (
        <div className={`space-y-3 font-mono ${className}`}>
            {/* Top Toolbar: Scenario Buttons & Reset */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-zinc-950 p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-xs">
                <div className="flex items-center gap-1.5 flex-wrap">
                    <div className="flex items-center gap-1 px-2">
                        <span className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase font-semibold">
                            SCENARIUSZ:
                        </span>
                        <InfoTooltip
                            size="xs"
                            content="Predefiniowane scenariusze makroekonomiczne i stres-testy bankowe służące do szybkiej weryfikacji odporności modelu na szoki popytowe, kosztowe i stóp procentowych."
                            ariaLabel="Informacje o scenariuszach What-If"
                        />
                    </div>

                    {SCENARIO_PRESETS.map((preset) => {
                        const Icon = preset.icon;
                        const isActive = activeScenario === preset.id;

                        let activeClasses = 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900 border border-transparent';
                        if (isActive) {
                            if (preset.id === 'base') activeClasses = 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border-zinc-300 dark:border-zinc-700 shadow-xs font-bold';
                            else if (preset.id === 'optimistic') activeClasses = 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800/80 shadow-xs font-bold';
                            else if (preset.id === 'pessimistic') activeClasses = 'bg-rose-50 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800/80 shadow-xs font-bold';
                            else if (preset.id === 'stagflation') activeClasses = 'bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800/80 shadow-xs font-bold';
                            else if (preset.id === 'wage_shock') activeClasses = 'bg-purple-50 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-800/80 shadow-xs font-bold';
                        }

                        return (
                            <Tooltip
                                key={preset.id}
                                content={`${preset.label}: ${preset.description}`}
                                placement="bottom"
                            >
                                <button
                                    type="button"
                                    onClick={() => handleSelect(preset)}
                                    onMouseEnter={() => setHoveredScenario(preset)}
                                    onMouseLeave={() => setHoveredScenario(null)}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded transition-all cursor-pointer ${activeClasses}`}
                                    aria-label={`${preset.shortName} (${preset.label}): ${preset.description}`}
                                >
                                    <Icon className="w-3.5 h-3.5" />
                                    <span>{preset.shortName}</span>
                                    {isActive && (
                                        <span className="w-1.5 h-1.5 rounded-full bg-current ml-0.5" />
                                    )}
                                </button>
                            </Tooltip>
                        );
                    })}

                    {/* Custom Badge if active scenario is custom */}
                    {activeScenario === 'custom' && (
                        <Tooltip content="Własna, niestandardowa parametryzacja suwaków wrażliwości ustalona ręcznie przez użytkownika">
                            <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded bg-cyan-50 dark:bg-cyan-950/60 border border-cyan-300 dark:border-cyan-800/70 text-cyan-700 dark:text-cyan-300 font-bold">
                                <Sliders className="w-3.5 h-3.5" />
                                <span>Własny (Manualny)</span>
                                <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 dark:bg-cyan-400 ml-0.5 animate-pulse" />
                            </div>
                        </Tooltip>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <Tooltip content="Przywróć domyślny scenariusz bazowy oraz zerowe odchylenia suwaków">
                        <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={onReset || (() => handleSelect(SCENARIO_PRESETS[0]))}
                            className="gap-1.5 text-xs"
                            aria-label="Przywróć Bazę - zresetuj odchylenia suwaków"
                        >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Przywróć Bazę</span>
                        </Button>
                    </Tooltip>
                </div>
            </div>

            {/* Contextual Scenario Description & Impact Strip */}
            <div className="bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/80 rounded-lg p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-start sm:items-center gap-2.5">
                    <Tooltip content={`Aktywny profil scenariusza: ${displayInfoScenario.label}`}>
                        <div className="p-1.5 rounded bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 shrink-0">
                            {React.createElement(displayInfoScenario.icon || Activity, { className: 'w-4 h-4' })}
                        </div>
                    </Tooltip>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-zinc-900 dark:text-zinc-200">
                                {displayInfoScenario.label}
                            </span>
                            <Tooltip content={`Kategoria profilu ryzyka: ${displayInfoScenario.badge}`}>
                                <Badge variant={displayInfoScenario.badgeVariant || 'default'}>
                                    {displayInfoScenario.badge}
                                </Badge>
                            </Tooltip>
                        </div>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                            {displayInfoScenario.description}
                        </p>
                    </div>
                </div>

                {/* Scenario Parameter Chips (if pre-defined) */}
                {displayInfoScenario.deltas && (
                    <div className="flex flex-wrap items-center gap-1.5 text-[10px] shrink-0 font-mono">
                        {displayInfoScenario.deltas.capexDelta !== 0 && (
                            <Tooltip content={`Modyfikator nakładów CAPEX: ${displayInfoScenario.deltas.capexDelta > 0 ? `+${displayInfoScenario.deltas.capexDelta}%` : `${displayInfoScenario.deltas.capexDelta}%`}`}>
                                <span className={`px-2 py-0.5 rounded border ${displayInfoScenario.deltas.capexDelta > 0 ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/30' : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30'}`}>
                                    CAPEX {displayInfoScenario.deltas.capexDelta > 0 ? `+${displayInfoScenario.deltas.capexDelta}%` : `${displayInfoScenario.deltas.capexDelta}%`}
                                </span>
                            </Tooltip>
                        )}
                        {displayInfoScenario.deltas.revenueDelta !== 0 && (
                            <Tooltip content={`Modyfikator przychodów ze sprzedaży: ${displayInfoScenario.deltas.revenueDelta > 0 ? `+${displayInfoScenario.deltas.revenueDelta}%` : `${displayInfoScenario.deltas.revenueDelta}%`}`}>
                                <span className={`px-2 py-0.5 rounded border ${displayInfoScenario.deltas.revenueDelta > 0 ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30' : 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/30'}`}>
                                    Przychody {displayInfoScenario.deltas.revenueDelta > 0 ? `+${displayInfoScenario.deltas.revenueDelta}%` : `${displayInfoScenario.deltas.revenueDelta}%`}
                                </span>
                            </Tooltip>
                        )}
                        {displayInfoScenario.deltas.varCostDelta !== 0 && (
                            <Tooltip content={`Modyfikator kosztów zmiennych: ${displayInfoScenario.deltas.varCostDelta > 0 ? `+${displayInfoScenario.deltas.varCostDelta}%` : `${displayInfoScenario.deltas.varCostDelta}%`}`}>
                                <span className={`px-2 py-0.5 rounded border ${displayInfoScenario.deltas.varCostDelta > 0 ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/30' : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30'}`}>
                                    Koszty zm. {displayInfoScenario.deltas.varCostDelta > 0 ? `+${displayInfoScenario.deltas.varCostDelta}%` : `${displayInfoScenario.deltas.varCostDelta}%`}
                                </span>
                            </Tooltip>
                        )}
                        {displayInfoScenario.deltas.payrollDelta !== 0 && (
                            <Tooltip content={`Modyfikator funduszu płac i stawek wynagrodzeń: ${displayInfoScenario.deltas.payrollDelta > 0 ? `+${displayInfoScenario.deltas.payrollDelta}%` : `${displayInfoScenario.deltas.payrollDelta}%`}`}>
                                <span className={`px-2 py-0.5 rounded border ${displayInfoScenario.deltas.payrollDelta > 0 ? 'bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-500/30' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'}`}>
                                    Płace {displayInfoScenario.deltas.payrollDelta > 0 ? `+${displayInfoScenario.deltas.payrollDelta}%` : `${displayInfoScenario.deltas.payrollDelta}%`}
                                </span>
                            </Tooltip>
                        )}
                        {displayInfoScenario.deltas.waccDelta && (
                            <Tooltip content={`Szok stopy dyskontowej WACC: +${displayInfoScenario.deltas.waccDelta} punktów procentowych`}>
                                <span className="px-2 py-0.5 rounded border bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30">
                                    WACC +{displayInfoScenario.deltas.waccDelta} p.p.
                                </span>
                            </Tooltip>
                        )}
                        {displayInfoScenario.id === 'base' && (
                            <Tooltip content="W scenariuszu bazowym wszystkie mnożniki wrażliwości wynoszą 0%">
                                <span className="px-2 py-0.5 rounded border bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700">
                                    Wszystkie odchylenia = 0%
                                </span>
                            </Tooltip>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
