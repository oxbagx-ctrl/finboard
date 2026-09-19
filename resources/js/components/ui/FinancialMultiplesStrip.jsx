import React from 'react';
import { formatPercent, formatRatio } from '../../utils/formatters';

export const FinancialMultiplesStrip = ({
    currentRatio = 0,
    quickRatio = 0,
    ebitdaMargin = 0,
    operatingMargin = 0,
    grossMargin = 0,
    netMargin = 0,
    debtRatio = 0,
    benchmarks = null,
    className = '',
}) => {
    const getStatusStyle = (status) => {
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

    const crBench = benchmarks?.current_ratio;
    const qrBench = benchmarks?.quick_ratio;
    const gmBench = benchmarks?.gross_margin;
    const emBench = benchmarks?.ebitda_margin;
    const omBench = benchmarks?.operating_margin;
    const nmBench = benchmarks?.net_margin;
    const dtaBench = benchmarks?.debt_to_assets;

    const multiples = [
        {
            label: 'CURRENT RATIO',
            value: formatRatio(currentRatio, 2),
            target: crBench?.target ? `Cel: >${crBench.target}x` : '> 1.20x',
            status: crBench?.status || (currentRatio >= 1.2 ? 'OPT' : currentRatio > 0 ? 'WARN' : 'STD'),
            note: 'Płynność bieżąca',
        },
        {
            label: 'QUICK RATIO',
            value: formatRatio(quickRatio, 2),
            target: qrBench?.target ? `Cel: >${qrBench.target}x` : '> 1.00x',
            status: qrBench?.status || (quickRatio >= 1.0 ? 'OPT' : quickRatio > 0 ? 'WARN' : 'STD'),
            note: 'Płynność szybka',
        },
        {
            label: 'MARŻA BRUTTO',
            value: formatPercent(grossMargin, 1, false),
            target: gmBench?.target ? `Cel: >${Number(gmBench.target).toFixed(0)}%` : 'Cel: > 30%',
            status: gmBench?.status || (grossMargin >= 0.3 ? 'OPT' : grossMargin > 0 ? 'WARN' : 'STD'),
            note: 'Gross Margin',
        },
        {
            label: 'MARŻA EBITDA',
            value: formatPercent(ebitdaMargin, 1, false),
            target: emBench?.target ? `Cel: >${Number(emBench.target).toFixed(0)}%` : 'Cel: > 15%',
            status: emBench?.status || (ebitdaMargin >= 0.15 ? 'OPT' : ebitdaMargin > 0 ? 'WARN' : 'STD'),
            note: 'Rentowność operacyjna',
        },
        {
            label: 'MARŻA OPERACYJNA',
            value: formatPercent(operatingMargin, 1, false),
            target: omBench?.target ? `Cel: >${Number(omBench.target).toFixed(0)}%` : 'Cel: > 10%',
            status: omBench?.status || (operatingMargin >= 0.10 ? 'OPT' : operatingMargin > 0 ? 'WARN' : 'STD'),
            note: 'EBIT Margin',
        },
        {
            label: 'MARŻA NETTO',
            value: formatPercent(netMargin, 1, false),
            target: nmBench?.target ? `Cel: >${Number(nmBench.target).toFixed(0)}%` : 'Cel: > 8%',
            status: nmBench?.status || (netMargin >= 0.08 ? 'OPT' : netMargin > 0 ? 'WARN' : 'STD'),
            note: 'Zysk netto / Przychody',
        },
        {
            label: 'WSKAŹNIK ZADŁUŻENIA',
            value: formatRatio(debtRatio, 2),
            target: dtaBench?.target ? `Cel: <${dtaBench.target}x` : '< 0.60x',
            status: dtaBench?.status || (debtRatio > 0 ? (debtRatio <= 0.6 ? 'OPT' : 'WARN') : 'STD'),
            note: 'Debt-to-Assets',
        },
    ];

    return (
        <div className={`bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden shadow-sm ${className}`}>
            <div className="px-3.5 py-2 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between text-[10px] font-mono text-zinc-400">
                <span className="font-semibold uppercase text-zinc-300">WSKAŹNIKI PŁYNNOŚCI I RENTOWNOŚCI (MULTIPLE STRIP)</span>
                <span className="text-zinc-500">
                    {benchmarks ? 'BENCHMARKI DORADCY & STATUSY KPI' : 'BENCHMARK BRANŻOWY M&A'}
                </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 divide-x divide-y sm:divide-y-0 divide-zinc-800 font-mono">
                {multiples.map((item, idx) => {
                    const statusConfig = getStatusStyle(item.status);

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
