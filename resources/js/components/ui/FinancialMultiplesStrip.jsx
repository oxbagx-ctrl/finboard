import React from 'react';
import { formatPercent, formatRatio } from '../../utils/formatters';

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
    const crVal = ratios?.current_ratio ?? currentRatio ?? 0;
    const qrVal = ratios?.quick_ratio ?? quickRatio ?? 0;
    const gmVal = ratios?.gross_margin ?? grossMargin ?? 0;
    const emVal = ratios?.ebitda_margin ?? ebitdaMargin ?? 0;
    const omVal = ratios?.operating_margin ?? operatingMargin ?? 0;
    const nmVal = ratios?.net_margin ?? netMargin ?? 0;
    const dtaVal = ratios?.debt_to_assets ?? debtRatio ?? 0;

    const getStatusStyle = (status, hasData = true) => {
        if (!hasData || status === 'UNKNOWN' || status === 'unknown' || status === 'NA' || status === 'N/A') {
            return {
                label: 'N/A',
                className: 'text-zinc-500 bg-zinc-800/80 border-zinc-700/60',
            };
        }

        switch (status) {
            case 'OPT':
            case 'opt':
                return {
                    label: 'OPT',
                    className: 'text-emerald-400 bg-emerald-950/60 border-emerald-800/80',
                };
            case 'WARN':
            case 'warn':
                return {
                    label: 'WARN',
                    className: 'text-amber-400 bg-amber-950/60 border-amber-800/80',
                };
            case 'CRIT':
            case 'crit':
                return {
                    label: 'CRIT',
                    className: 'text-rose-400 bg-rose-950/60 border-rose-800/80',
                };
            default:
                return {
                    label: 'STD',
                    className: 'text-zinc-400 bg-zinc-800 border-zinc-700',
                };
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
        if (bench?.status) {
            return { status: bench.status, hasData: true };
        }
        if (value == null || (value === 0 && !bench)) {
            return { status: 'STD', hasData: true };
        }
        return { status: defaultRule(value), hasData: true };
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
            value: formatRatio(crVal, 2),
            target: formatTarget(crBench, '> 1.20x'),
            status: crStatus.status,
            hasData: crStatus.hasData,
            note: 'Płynność bieżąca',
        },
        {
            label: 'QUICK RATIO',
            value: formatRatio(qrVal, 2),
            target: formatTarget(qrBench, '> 1.00x'),
            status: qrStatus.status,
            hasData: qrStatus.hasData,
            note: 'Płynność szybka',
        },
        {
            label: 'MARŻA BRUTTO',
            value: formatPercent(gmVal, 1, false),
            target: formatTarget(gmBench, 'Cel: > 30%', true),
            status: gmStatus.status,
            hasData: gmStatus.hasData,
            note: 'Gross Margin',
        },
        {
            label: 'MARŻA EBITDA',
            value: formatPercent(emVal, 1, false),
            target: formatTarget(emBench, 'Cel: > 15%', true),
            status: emStatus.status,
            hasData: emStatus.hasData,
            note: 'Rentowność operacyjna',
        },
        {
            label: 'MARŻA OPERACYJNA',
            value: formatPercent(omVal, 1, false),
            target: formatTarget(omBench, 'Cel: > 10%', true),
            status: omStatus.status,
            hasData: omStatus.hasData,
            note: 'EBIT Margin',
        },
        {
            label: 'MARŻA NETTO',
            value: formatPercent(nmVal, 1, false),
            target: formatTarget(nmBench, 'Cel: > 8%', true),
            status: nmStatus.status,
            hasData: nmStatus.hasData,
            note: 'Zysk netto / Przychody',
        },
        {
            label: 'WSKAŹNIK ZADŁUŻENIA',
            value: formatRatio(dtaVal, 2),
            target: formatTarget(dtaBench, '< 0.60x', false, true),
            status: dtaStatus.status,
            hasData: dtaStatus.hasData,
            note: 'Debt-to-Assets',
        },
    ];

    return (
        <div className={`bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden shadow-sm ${className}`}>
            <div className="px-3.5 py-2 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between text-[10px] font-mono text-zinc-400">
                <span className="font-semibold uppercase text-zinc-300">WSKAŹNIKI PŁYNNOŚCI I RENTOWNOŚCI (MULTIPLE STRIP)</span>
                <div className="flex items-center gap-3">
                    <span className="text-zinc-500">
                        {benchmarks ? 'BENCHMARKI DORADCY & STATUSY KPI' : 'BENCHMARK BRANŻOWY M&A'}
                    </span>
                    {onConfigure && (
                        <button
                            type="button"
                            onClick={onConfigure}
                            className="text-emerald-400 hover:text-emerald-300 hover:underline font-semibold uppercase text-[10px] flex items-center gap-1 transition-colors"
                        >
                            Konfiguruj cele
                        </button>
                    )}
                </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 divide-x divide-y sm:divide-y-0 divide-zinc-800 font-mono">
                {multiples.map((item, idx) => {
                    const statusConfig = getStatusStyle(item.status, item.hasData);

                    return (
                        <div key={idx} className="p-3 bg-zinc-900 hover:bg-zinc-850/60 transition-colors">
                            <div className="text-[9px] uppercase tracking-wider text-zinc-500 truncate">
                                {item.label}
                            </div>
                            <div className="mt-1 flex items-baseline justify-between gap-1">
                                <span className="text-base font-bold tracking-tight text-zinc-100 tabular-nums">
                                    {item.value}
                                </span>
                                <span className={`text-[9px] px-1 py-0.2 rounded uppercase border ${statusConfig.className}`}>
                                    {statusConfig.label}
                                </span>
                            </div>
                            <div className="mt-1 text-[9px] text-zinc-500 flex items-center justify-between">
                                <span className="truncate">{item.note}</span>
                                <span className="text-zinc-600 font-mono text-[8px]">{item.target}</span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
