import React from 'react';
import {
    Landmark,
    TrendingDown,
    CircleDot,
    Clock,
    ShieldCheck,
    AlertTriangle,
    Coins,
    RotateCcw,
    Layers,
    DollarSign,
    Info
} from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Tooltip, InfoTooltip } from '../ui/Tooltip';

export const REPAYMENT_MODES = [
    {
        id: 'annuity',
        title: 'Raty Równe (Annuity)',
        shortTitle: 'Annuity',
        badge: 'PROJECT FINANCE',
        badgeVariant: 'brand',
        icon: Layers,
        summary: 'Stała miesięczna rata kapitałowo-odsetkowa.',
        description: 'Optymalizuje wskaźnik pokrycia długu (DSCR) w pierwszych latach po uruchomieniu komercyjnym. Chroni płynność operacyjną.',
        bestFor: 'Kredyty Project Finance, instalacje OZE, magazyny energii BESS'
    },
    {
        id: 'linear',
        title: 'Raty Malejące (Linear)',
        shortTitle: 'Liniowy',
        badge: 'LOWEST COST',
        badgeVariant: 'success',
        icon: TrendingDown,
        summary: 'Równa rata kapitałowa, malejące odsetki.',
        description: 'Najszybsze tempo oddłużenia i najniższy łączny koszt odsetek w 15 latach. Wymaga wyższego bufora EBITDA w początkowym okresie.',
        bestFor: 'Kredyty komercyjne, leasing maszyn i urządzeń technologicznych'
    },
    {
        id: 'bullet',
        title: 'Spłata Balonowa (Bullet)',
        shortTitle: 'Bullet (Balon)',
        badge: 'REFINANCING RISK',
        badgeVariant: 'warning',
        icon: CircleDot,
        summary: 'Bieżące odsetki, kapitał na koniec tenoru.',
        description: 'Maksymalizuje bieżące wolne przepływy dla akcjonariuszy (FCFE). Wymaga refinansowania lub wyjścia kapitałowego w roku zapadalności.',
        bestFor: 'Obligacje korporacyjne, pożyczki mezzanine, dług pomostowy'
    }
];

export const DebtRepaymentModeSwitcher = ({
    facility,
    activeMode = 'annuity', // 'annuity' | 'linear' | 'bullet'
    contractMode = 'annuity',
    onChangeMode,
    onResetToContract,
    minDscr = null,
    avgDscr = null,
    totalInterest = null,
    baseInterest = null,
    currency = 'PLN',
    className = ''
}) => {
    const isOverrideActive = activeMode !== contractMode;

    const formatMoney = (val) => {
        if (val === null || val === undefined || isNaN(val)) return '—';
        return new Intl.NumberFormat('pl-PL', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(val) + ' ' + currency;
    };

    const isBankable = minDscr !== null && minDscr >= 1.20;

    return (
        <div className={`bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-5 font-mono space-y-4 shadow-sm ${className}`}>
            {/* Header & Contract Info */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800 pb-3">
                <div className="flex items-center gap-3">
                    <Tooltip content="Inżynieria dłużna i optymalizacja profilu obsługi długu Project Finance">
                        <div className="w-8 h-8 rounded bg-blue-50 dark:bg-blue-950/80 border border-blue-200 dark:border-blue-800/80 flex items-center justify-center text-blue-600 dark:text-blue-400">
                            <Landmark className="w-4 h-4" />
                        </div>
                    </Tooltip>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wide">
                                Profil Amortyzacji Długu Bankowego (Debt Repayment Structure)
                            </h3>
                            <InfoTooltip
                                size="xs"
                                content="Wybór formuły spłaty kapitału i odsetek kredytu senior debt (raty równe, malejące lub spłata balonowa). Wpływa bezpośrednio na wskaźnik pokrycia długu DSCR oraz całkowity 15-letni koszt odsetek."
                                ariaLabel="Informacje o profilach amortyzacji długu"
                            />
                            {isOverrideActive ? (
                                <Tooltip content="Testowany profil spłaty różni się od formuły zdefiniowanej w umowie kredytowej">
                                    <Badge variant="warning">SYMULACJA ALTERNATYWNA</Badge>
                                </Tooltip>
                            ) : (
                                <Tooltip content="Profil spłat jest w pełni zgodny z warunkami umowy kredytowej">
                                    <Badge variant="default">ZGODNY Z UMOWĄ</Badge>
                                </Tooltip>
                            )}
                        </div>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                            Porównaj wpływ formuły spłaty kapitału na kowenanty bankowe (DSCR) i łączny koszt odsetkowy w horyzoncie 15 lat.
                        </p>
                    </div>
                </div>

                {isOverrideActive && (
                    <Tooltip content={`Przywróć profil spłat zgodny z umową (${contractMode})`}>
                        <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={onResetToContract}
                            className="gap-1.5 text-xs shrink-0"
                            aria-label={`Przywróć umowę (${contractMode})`}
                        >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Przywróć umowę ({contractMode})</span>
                        </Button>
                    </Tooltip>
                )}
            </div>

            {/* 3-Way Mode Selector Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {REPAYMENT_MODES.map((mode) => {
                    const Icon = mode.icon;
                    const isSelected = activeMode === mode.id;
                    const isContract = contractMode === mode.id;

                    return (
                        <div
                            key={mode.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => onChangeMode && onChangeMode(mode.id)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    onChangeMode && onChangeMode(mode.id);
                                }
                            }}
                            aria-pressed={isSelected}
                            aria-label={`Wybierz tryb spłaty: ${mode.title}`}
                            className={`p-3.5 rounded-lg border cursor-pointer transition-all flex flex-col justify-between focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${
                                isSelected
                                    ? 'bg-blue-50/50 dark:bg-zinc-950 border-blue-500 shadow-sm ring-1 ring-blue-500/30'
                                    : 'bg-zinc-50 dark:bg-zinc-950/40 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-zinc-100/70 dark:hover:bg-zinc-950/70'
                            }`}
                        >
                            <div>
                                <div className="flex items-center justify-between gap-2 mb-2">
                                    <div className="flex items-center gap-2">
                                        <Tooltip content={mode.summary}>
                                            <div className={`p-1.5 rounded ${isSelected ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'}`}>
                                                <Icon className="w-4 h-4" />
                                            </div>
                                        </Tooltip>
                                        <div>
                                            <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                                                {mode.title}
                                            </div>
                                            {isContract && (
                                                <Tooltip content="Formuła amortyzacji pierwotnie zdefiniowana w parametrach kredytu">
                                                    <span className="text-[9px] text-zinc-500 uppercase tracking-wider block">
                                                        [PROFIL Z UMOWY]
                                                    </span>
                                                </Tooltip>
                                            )}
                                        </div>
                                    </div>
                                    <Tooltip content={`Charakterystyka: ${mode.badge}`}>
                                        <Badge variant={mode.badgeVariant || 'default'}>
                                            {mode.badge}
                                        </Badge>
                                    </Tooltip>
                                </div>

                                <p className="text-[11px] text-zinc-600 dark:text-zinc-300 font-sans leading-relaxed mb-2">
                                    {mode.summary}
                                </p>
                                <p className="text-[10px] text-zinc-500 font-sans leading-relaxed">
                                    {mode.description}
                                </p>
                            </div>

                            <div className="mt-3 pt-2.5 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-[10px]">
                                <span className="text-zinc-500">Zastosowanie:</span>
                                <Tooltip content={`Rekomendowane zastosowanie: ${mode.bestFor}`}>
                                    <span className="text-zinc-700 dark:text-zinc-300 font-medium truncate max-w-[160px]">
                                        {mode.bestFor}
                                    </span>
                                </Tooltip>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Live Covenant & Cost Impact Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-zinc-50 dark:bg-zinc-950/60 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800/80">
                <div>
                    <div className="flex items-center gap-1">
                        <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-semibold">
                            KOWENANT MIN DSCR
                        </span>
                        <InfoTooltip
                            size="xs"
                            content="Minimalny wskaźnik pokrycia obsługi długu (Debt Service Coverage Ratio = CFADS / Debt Service) w 15 latach. Wartość poniżej 1.20x oznacza naruszenie kowenantów bankowych."
                            ariaLabel="Informacje o kowenancie minimalnego DSCR"
                        />
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                        <span className={`text-base font-bold ${minDscr && minDscr >= 1.20 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                            {minDscr !== null && !isNaN(minDscr) ? `${minDscr.toFixed(2)}x` : '—'}
                        </span>
                        <Tooltip content={isBankable ? 'Projekt spełnia minimalny próg bankowalności (DSCR >= 1.20x)' : 'Projekt generuje ryzyko kredytowe (DSCR < 1.20x)'}>
                            <Badge variant={isBankable ? 'success' : 'danger'}>
                                {isBankable ? 'BANKOWALNY (≥ 1.2x)' : 'NARUSZENIE (< 1.2x)'}
                            </Badge>
                        </Tooltip>
                    </div>
                </div>

                <div>
                    <div className="flex items-center gap-1">
                        <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-semibold">
                            ŚREDNI DSCR (15 LAT)
                        </span>
                        <InfoTooltip
                            size="xs"
                            content="Średnia arytmetyczna wskaźnika DSCR w całym 15-letnim okresie po rozpoczęciu eksploatacji komercyjnej (COD), obrazująca ogólny margines bezpieczeństwa obsługi kredytu."
                            ariaLabel="Informacje o średnim wskaźniku DSCR"
                        />
                    </div>
                    <div className="text-base font-bold text-zinc-900 dark:text-zinc-200 mt-1">
                        {avgDscr !== null && !isNaN(avgDscr) ? `${avgDscr.toFixed(2)}x` : '—'}
                    </div>
                </div>

                <div>
                    <div className="flex items-center gap-1">
                        <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-semibold">
                            ŁĄCZNY KOSZT ODSETEK
                        </span>
                        <InfoTooltip
                            size="xs"
                            content="Całkowity skumulowany koszt odsetek bankowych zapłaconych w 15-letnim horyzoncie obsługi zadłużenia dla wybranego profilu amortyzacji."
                            ariaLabel="Informacje o łącznym koszcie odsetek"
                        />
                    </div>
                    <div className="text-base font-bold text-amber-600 dark:text-amber-400 mt-1">
                        {totalInterest !== null ? formatMoney(totalInterest) : '—'}
                    </div>
                </div>

                <div>
                    <div className="flex items-center gap-1">
                        <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-semibold">
                            OSZCZĘDNOŚĆ / KOSZT WOBEC BAZY
                        </span>
                        <InfoTooltip
                            size="xs"
                            content="Oszczędność (zielony) lub dodatkowy koszt (czerwony) odsetek w porównaniu z bazowym profilem spłaty zapisanym w umowie kredytowej."
                            ariaLabel="Informacje o odchyleniu kosztu odsetek"
                        />
                    </div>
                    <div className="text-base font-bold mt-1">
                        {totalInterest !== null && baseInterest !== null && totalInterest !== baseInterest ? (
                            <span className={totalInterest < baseInterest ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                                {totalInterest < baseInterest ? '-' : '+'}{formatMoney(Math.abs(totalInterest - baseInterest))}
                            </span>
                        ) : (
                            <span className="text-zinc-500">Wzorzec bazowy</span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
