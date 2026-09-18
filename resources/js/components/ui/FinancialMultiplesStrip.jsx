import React from 'react';
import { formatPercent, formatRatio } from '../../utils/formatters';

export const FinancialMultiplesStrip = ({
    currentRatio = 1.85,
    quickRatio = 1.42,
    ebitdaMargin = 0.184,
    operatingMargin = 0.142,
    grossMargin = 0.326,
    netMargin = 0.118,
    debtRatio = 0.42,
    className = '',
}) => {
    const multiples = [
        {
            label: 'CURRENT RATIO',
            value: formatRatio(currentRatio, 2),
            target: '> 1.20x',
            status: currentRatio >= 1.2 ? 'opt' : 'warn',
            note: 'Płynność bieżąca',
        },
        {
            label: 'QUICK RATIO',
            value: formatRatio(quickRatio, 2),
            target: '> 1.00x',
            status: quickRatio >= 1.0 ? 'opt' : 'warn',
            note: 'Płynność szybka',
        },
        {
            label: 'MARŻA BRUTTO',
            value: formatPercent(grossMargin, 1, false),
            target: 'Cel: > 30%',
            status: grossMargin >= 0.3 ? 'opt' : 'neutral',
            note: 'Gross Margin',
        },
        {
            label: 'MARŻA EBITDA',
            value: formatPercent(ebitdaMargin, 1, false),
            target: 'Cel: > 15%',
            status: ebitdaMargin >= 0.15 ? 'opt' : 'neutral',
            note: 'Rentowność operacyjna',
        },
        {
            label: 'MARŻA OPERACYJNA',
            value: formatPercent(operatingMargin, 1, false),
            target: 'Cel: > 10%',
            status: operatingMargin >= 0.10 ? 'opt' : 'neutral',
            note: 'EBIT Margin',
        },
        {
            label: 'MARŻA NETTO',
            value: formatPercent(netMargin, 1, false),
            target: 'Cel: > 8%',
            status: netMargin >= 0.08 ? 'opt' : 'neutral',
            note: 'Zysk netto / Przychody',
        },
        {
            label: 'WSKAŹNIK ZADŁUŻENIA',
            value: formatRatio(debtRatio, 2),
            target: '< 0.60x',
            status: debtRatio <= 0.6 ? 'opt' : 'warn',
            note: 'Debt-to-Assets',
        },
    ];

    return (
        <div className={`bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden shadow-sm ${className}`}>
            <div className="px-3.5 py-2 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between text-[10px] font-mono text-zinc-400">
                <span className="font-semibold uppercase text-zinc-300">WSKAŹNIKI PŁYNNOŚCI I RENTOWNOŚCI (MULTIPLE STRIP)</span>
                <span className="text-zinc-500">BENCHMARK BRANŻOWY M&A</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 divide-x divide-y sm:divide-y-0 divide-zinc-800 font-mono">
                {multiples.map((item, idx) => {
                    const isOptimal = item.status === 'opt';
                    const isWarning = item.status === 'warn';

                    return (
                        <div key={idx} className="p-3 bg-zinc-900 hover:bg-zinc-850/60 transition-colors">
                            <div className="text-[9px] uppercase tracking-wider text-zinc-500 truncate">
                                {item.label}
                            </div>
                            <div className="mt-1 flex items-baseline justify-between gap-1">
                                <span className="text-base font-bold tracking-tight text-zinc-100 tabular-nums">
                                    {item.value}
                                </span>
                                <span
                                    className={`text-[9px] px-1 py-0.2 rounded uppercase ${
                                        isOptimal
                                            ? 'text-emerald-400 bg-emerald-950/60 border border-emerald-800/80'
                                            : isWarning
                                            ? 'text-rose-400 bg-rose-950/60 border border-rose-800/80'
                                            : 'text-zinc-400 bg-zinc-800'
                                    }`}
                                >
                                    {isOptimal ? 'OPT' : isWarning ? 'UWAGA' : 'STD'}
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
