import React from 'react';
import { formatPercent, formatRatio } from '../../utils/formatters';
import { Tooltip, InfoTooltip } from './Tooltip';

export const FinancialMultiplesStrip = ({
    ratios = null,
    currentRatio = null,
    quickRatio = null,
    ebitdaMargin = null,
    operatingMargin = null,
    grossMargin = null,
    netMargin = null,
    debtRatio = null,
    benchmarks = null,
    onConfigure = null,
    className = '',
}) => {
    // Resolve values preferring unified ratios dictionary if available, falling back to direct props
    const crVal = ratios?.current_ratio !== undefined ? ratios.current_ratio : currentRatio;
    const qrVal = ratios?.quick_ratio !== undefined ? ratios.quick_ratio : quickRatio;
    const gmVal = ratios?.gross_margin !== undefined ? ratios.gross_margin : (grossMargin ?? 0);
    const emVal = ratios?.ebitda_margin !== undefined ? ratios.ebitda_margin : (ebitdaMargin ?? 0);
    const omVal = ratios?.operating_margin !== undefined ? ratios.operating_margin : (operatingMargin ?? 0);
    const nmVal = ratios?.net_margin !== undefined ? ratios.net_margin : (netMargin ?? 0);
    const dtaVal = ratios?.debt_to_assets !== undefined ? ratios.debt_to_assets : debtRatio;

    const getStatusStyle = (status, hasData = true) => {
        if (!hasData || status === 'UNKNOWN' || status === 'unknown' || status === 'NA' || status === 'N/A') {
            return {
                label: 'N/A',
                className: 'text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800/80 border-zinc-200 dark:border-zinc-700/60',
            };
        }

        switch (status) {
            case 'OPT':
            case 'opt':
                return {
                    label: 'OPT',
                    className: 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800/80',
                };
            case 'WARN':
            case 'warn':
                return {
                    label: 'WARN',
                    className: 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800/80',
                };
            case 'CRIT':
            case 'crit':
                return {
                    label: 'CRIT',
                    className: 'text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800/80',
                };
            default:
                return {
                    label: 'STD',
                    className: 'text-zinc-700 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700',
                };
        }
    };

    const getStatusExplanation = (status, hasData = true, targetStr = '') => {
        if (!hasData) {
            return 'Brak danych bilansowych dla wybranego okresu sprawozdawczego.';
        }
        switch (status?.toUpperCase()) {
            case 'OPT':
                return `Status OPT (Optymalny): Wskaźnik spełnia lub przewyższa benchmark doradcy (${targetStr}).`;
            case 'WARN':
                return `Status WARN (Ostrzeżenie): Wskaźnik poniżej progu docelowego (${targetStr}). Wymaga monitoringu.`;
            case 'CRIT':
                return `Status CRIT (Krytyczny): Istotne odchylenie od benchmarku (${targetStr}). Zagrożenie płynnościowe.`;
            default:
                return `Status neutralny / standardowy (${targetStr}).`;
        }
    };

    const crBench = benchmarks?.current_ratio ?? benchmarks?.CURRENT_RATIO;
    const qrBench = benchmarks?.quick_ratio ?? benchmarks?.QUICK_RATIO;
    const gmBench = benchmarks?.gross_margin ?? benchmarks?.GROSS_MARGIN;
    const emBench = benchmarks?.ebitda_margin ?? benchmarks?.EBITDA_MARGIN;
    const omBench = benchmarks?.operating_margin ?? benchmarks?.OPERATING_MARGIN;
    const nmBench = benchmarks?.net_margin ?? benchmarks?.NET_MARGIN;
    const dtaBench = benchmarks?.debt_to_assets ?? benchmarks?.DEBT_TO_ASSETS;

    const resolveBenchmarkStatus = (bench, value, defaultRule) => {
        if (bench?.has_data === false || bench?.is_unknown === true || bench?.status === 'UNKNOWN') {
            return { status: 'UNKNOWN', hasData: false };
        }
        if (value === null || value === undefined) {
            return { status: 'UNKNOWN', hasData: false };
        }
        if (bench?.status) {
            return { status: bench.status, hasData: true };
        }
        if (value === 0 && !bench) {
            return { status: 'STD', hasData: true };
        }
        return { status: defaultRule(Number(value)), hasData: true };
    };

    const crStatus = resolveBenchmarkStatus(crBench, crVal, (v) => (v >= 1.2 ? 'OPT' : v > 0 ? 'WARN' : 'STD'));
    const qrStatus = resolveBenchmarkStatus(qrBench, qrVal, (v) => (v >= 1.0 ? 'OPT' : v > 0 ? 'WARN' : 'STD'));
    const gmStatus = resolveBenchmarkStatus(gmBench, gmVal, (v) => (v >= 0.3 ? 'OPT' : v > 0 ? 'WARN' : 'STD'));
    const emStatus = resolveBenchmarkStatus(emBench, emVal, (v) => (v >= 0.15 ? 'OPT' : v > 0 ? 'WARN' : 'STD'));
    const omStatus = resolveBenchmarkStatus(omBench, omVal, (v) => (v >= 0.10 ? 'OPT' : v > 0 ? 'WARN' : 'STD'));
    const nmStatus = resolveBenchmarkStatus(nmBench, nmVal, (v) => (v >= 0.08 ? 'OPT' : v > 0 ? 'WARN' : 'STD'));
    const dtaStatus = resolveBenchmarkStatus(dtaBench, dtaVal, (v) => (v > 0 ? (v <= 0.6 ? 'OPT' : 'WARN') : 'STD'));

    const formatTarget = (bench, defaultStr, isPercent = false, isLowerBetter = false) => {
        const targetVal = bench?.target ?? bench?.target_value;
        if (targetVal == null) return defaultStr;
        const prefix = isLowerBetter ? '<' : '>';
        if (isPercent) {
            return `Cel: ${prefix}${Number(targetVal).toFixed(0)}%`;
        }
        return `Cel: ${prefix}${targetVal}x`;
    };

    const multiples = [
        {
            label: 'CURRENT RATIO',
            title: 'Wskaźnik Płynności Bieżącej (Current Ratio)',
            formula: 'Aktywa obrotowe / Zobowiązania krótkoterminowe',
            description: 'Mierzy zdolność przedsiębiorstwa do terminowej spłaty bieżących zobowiązań za pomocą aktywów obrotowych. Benchmark doradcy: > 1.20x.',
            value: crStatus.hasData && crVal != null && Number(crVal) > 0 ? formatRatio(crVal, 2) : '—',
            target: formatTarget(crBench, '> 1.20x'),
            status: crStatus.status,
            hasData: crStatus.hasData,
            note: crStatus.hasData ? 'Płynność bieżąca' : 'Brak bilansu',
        },
        {
            label: 'QUICK RATIO',
            title: 'Wskaźnik Płynności Szybkiej (Quick Ratio)',
            formula: '(Aktywa obrotowe - Zapasy) / Zobowiązania krótkoterminowe',
            description: 'Weryfikuje natychmiastowe pokrycie zobowiązań płynnymi środkami, z wyłączeniem trudniej zbywalnych zapasów. Benchmark: > 1.00x.',
            value: qrStatus.hasData && qrVal != null && Number(qrVal) > 0 ? formatRatio(qrVal, 2) : '—',
            target: formatTarget(qrBench, '> 1.00x'),
            status: qrStatus.status,
            hasData: qrStatus.hasData,
            note: qrStatus.hasData ? 'Płynność szybka' : 'Brak bilansu',
        },
        {
            label: 'MARŻA BRUTTO',
            title: 'Marża Zysku Brutto ze Sprzedaży (Gross Margin)',
            formula: 'Zysk brutto ze sprzedaży / Przychody ze sprzedaży',
            description: 'Odzwierciedla rentowność sprzedaży po odliczeniu bezpośrednich kosztów wytworzenia sprzedanych towarów i produktów (COGS). Benchmark: > 30%.',
            value: gmStatus.hasData && gmVal != null ? formatPercent(gmVal, 1, false) : '—',
            target: formatTarget(gmBench, 'Cel: > 30%', true),
            status: gmStatus.status,
            hasData: gmStatus.hasData,
            note: 'Gross Margin',
        },
        {
            label: 'MARŻA EBITDA',
            title: 'Marża Rentowności EBITDA',
            formula: 'EBITDA / Przychody ze sprzedaży',
            description: 'Kluczowy mnożnik wyceny transakcyjnej M&A. Odzwierciedla gotówkową rentowność operacyjną przed amortyzacją i podatkami. Benchmark: > 15%.',
            value: emStatus.hasData && emVal != null ? formatPercent(emVal, 1, false) : '—',
            target: formatTarget(emBench, 'Cel: > 15%', true),
            status: emStatus.status,
            hasData: emStatus.hasData,
            note: 'Rentowność operacyjna',
        },
        {
            label: 'MARŻA OPERACYJNA',
            title: 'Marża Zysku Operacyjnego (EBIT Margin)',
            formula: 'Zysk operacyjny (EBIT) / Przychody ze sprzedaży',
            description: 'Pokazuje rentowność podstawowej działalności operacyjnej po uwzględnieniu kosztów zarządu i amortyzacji majątku trwałego. Benchmark: > 10%.',
            value: omStatus.hasData && omVal != null ? formatPercent(omVal, 1, false) : '—',
            target: formatTarget(omBench, 'Cel: > 10%', true),
            status: omStatus.status,
            hasData: omStatus.hasData,
            note: 'EBIT Margin',
        },
        {
            label: 'MARŻA NETTO',
            title: 'Marża Zysku Netto (Net Margin)',
            formula: 'Zysk netto / Przychody ze sprzedaży',
            description: 'Końcowa rentowność kapitału po odliczeniu wszystkich kosztów operacyjnych, finansowych i podatku dochodowego CIT. Benchmark: > 8%.',
            value: nmStatus.hasData && nmVal != null ? formatPercent(nmVal, 1, false) : '—',
            target: formatTarget(nmBench, 'Cel: > 8%', true),
            status: nmStatus.status,
            hasData: nmStatus.hasData,
            note: 'Zysk netto / Przychody',
        },
        {
            label: 'WSKAŹNIK ZADŁUŻENIA',
            title: 'Wskaźnik Ogólnego Zadłużenia (Debt-to-Assets)',
            formula: 'Zobowiązania ogółem / Aktywa ogółem',
            description: 'Określa stopień finansowania majątku spółki kapitałem obcym. Wskaźnik < 0.60x świadczy o bezpiecznym profilu lewarowania.',
            value: dtaStatus.hasData && dtaVal != null && Number(dtaVal) >= 0 ? formatRatio(dtaVal, 2) : '—',
            target: formatTarget(dtaBench, '< 0.60x', false, true),
            status: dtaStatus.status,
            hasData: dtaStatus.hasData,
            note: dtaStatus.hasData ? 'Debt-to-Assets' : 'Brak bilansu',
        },
    ];

    return (
        <div className={`bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden shadow-sm ${className}`}>
            <div className="px-3.5 py-2 bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-[10px] font-mono text-zinc-500 dark:text-zinc-400">
                <span className="font-semibold uppercase text-zinc-700 dark:text-zinc-300">WSKAŹNIKI PŁYNNOŚCI I RENTOWNOŚCI (MULTIPLE STRIP)</span>
                <div className="flex items-center gap-3">
                    <span className="text-zinc-500 dark:text-zinc-400">
                        {benchmarks ? 'BENCHMARKI DORADCY & STATUSY KPI' : 'BENCHMARK BRANŻOWY M&A'}
                    </span>
                    {onConfigure && (
                        <button
                            type="button"
                            onClick={onConfigure}
                            className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:underline font-semibold uppercase text-[10px] flex items-center gap-1 transition-colors"
                        >
                            Konfiguruj cele
                        </button>
                    )}
                </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 divide-x divide-y sm:divide-y-0 divide-zinc-200 dark:divide-zinc-800 font-mono">
                {multiples.map((item, idx) => {
                    const statusConfig = getStatusStyle(item.status, item.hasData);
                    const statusTooltip = getStatusExplanation(item.status, item.hasData, item.target);

                    return (
                        <div key={idx} className="p-3 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-850/60 transition-colors">
                            <div className="flex items-center justify-between gap-1 text-[9px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                                <span className="truncate">{item.label}</span>
                                <InfoTooltip
                                    title={item.title}
                                    content={
                                        <div className="space-y-1">
                                            <div className="text-emerald-600 dark:text-emerald-400 font-mono text-[10px] bg-zinc-100 dark:bg-zinc-900 px-1 py-0.5 rounded border border-zinc-200 dark:border-zinc-800">
                                                {item.formula}
                                            </div>
                                            <div className="text-zinc-700 dark:text-zinc-300 text-xs">
                                                {item.description}
                                            </div>
                                        </div>
                                    }
                                    ariaLabel={`Objaśnienie wskaźnika ${item.label}`}
                                    size={11}
                                />
                            </div>
                            <div className="mt-1 flex items-baseline justify-between gap-1">
                                <span className={`text-base font-bold tracking-tight tabular-nums ${item.hasData ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-400 dark:text-zinc-500'}`}>
                                    {item.value}
                                </span>
                                <Tooltip content={statusTooltip}>
                                    <span className={`text-[9px] px-1 py-0.2 rounded uppercase border cursor-help ${statusConfig.className}`}>
                                        {statusConfig.label}
                                    </span>
                                </Tooltip>
                            </div>
                            <div className="mt-1 text-[9px] text-zinc-500 dark:text-zinc-400 flex items-center justify-between">
                                <span className="truncate">{item.note}</span>
                                <span className="text-zinc-400 dark:text-zinc-500 font-mono text-[8px]">{item.target}</span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

