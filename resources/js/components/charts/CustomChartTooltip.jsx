import React from 'react';
import { formatCurrency, formatRatio } from '../../utils/formatters';

export const CustomChartTooltip = ({ active, payload, label, currency = 'PLN', isRatio = false }) => {
    if (!active || !payload || !payload.length) {
        return null;
    }

    return (
        <div className="bg-zinc-950/95 border border-zinc-750 rounded p-2.5 shadow-2xl font-mono text-xs max-w-xs z-50 backdrop-blur-xs">
            <div className="text-[10px] uppercase text-zinc-500 font-semibold border-b border-zinc-800 pb-1 mb-1.5 flex items-center justify-between">
                <span>OKRES: {label}</span>
                <span className="text-zinc-600 font-mono">AUDYT: PSR</span>
            </div>

            <div className="space-y-1">
                {payload.map((entry, index) => {
                    const isPercent = entry.dataKey?.includes('percent') || entry.name?.includes('%') || entry.name?.includes('Marża');
                    const isRatioValue = isRatio || entry.dataKey?.includes('ratio');

                    let formattedValue;
                    if (isPercent) {
                        formattedValue = `${Number(entry.value).toFixed(1)}%`;
                    } else if (isRatioValue) {
                        formattedValue = formatRatio(entry.value, 2);
                    } else {
                        formattedValue = formatCurrency(entry.value, currency);
                    }

                    return (
                        <div key={`item-${index}`} className="flex items-center justify-between gap-3 text-[11px]">
                            <div className="flex items-center gap-1.5 text-zinc-400">
                                <span
                                    className="w-2 h-2 rounded-xs shrink-0"
                                    style={{ backgroundColor: entry.color || entry.fill }}
                                />
                                <span className="truncate max-w-[130px]">{entry.name}</span>
                            </div>
                            <span className="font-bold text-zinc-100 tabular-nums">
                                {formattedValue}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
