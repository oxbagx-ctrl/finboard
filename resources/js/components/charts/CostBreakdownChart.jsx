import React from 'react';
import {
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Tooltip
} from 'recharts';
import { CustomChartTooltip } from './CustomChartTooltip';
import { formatCurrency } from '../../utils/formatters';

const PALETTE = [
    '#38bdf8', // sky-400
    '#818cf8', // indigo-400
    '#fb7185', // rose-400
    '#fbbf24', // amber-400
    '#34d399', // emerald-400
    '#a78bfa', // violet-400
    '#94a3b8', // slate-400
    '#cbd5e1', // slate-300
];

export const CostBreakdownChart = ({ data = [], currency = 'PLN', className = '' }) => {
    if (!data || data.length === 0) {
        return (
            <div className="h-72 flex items-center justify-center text-xs font-mono text-zinc-500">
                Brak danych struktury kosztów dla wybranego okresu.
            </div>
        );
    }

    const total = data.reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const formattedData = data.map((item, idx) => ({
        ...item,
        name: item.category_name,
        value: Number(item.amount),
        color: PALETTE[idx % PALETTE.length],
    }));

    return (
        <div className={`flex flex-col h-80 ${className}`}>
            {/* Donut Chart Container */}
            <div className="relative h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={formattedData}
                            cx="50%"
                            cy="50%"
                            innerRadius={52}
                            outerRadius={78}
                            paddingAngle={2}
                            dataKey="value"
                            stroke="#09090b"
                            strokeWidth={2}
                        >
                            {formattedData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                        </Pie>
                        <Tooltip
                            content={<CustomChartTooltip currency={currency} />}
                        />
                    </PieChart>
                </ResponsiveContainer>

                {/* Center Value Badge */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-[9px] font-mono uppercase text-zinc-500 tracking-wider">
                        SUMA KOSZTÓW
                    </span>
                    <span className="text-xs font-bold font-mono text-zinc-100 tabular-nums mt-0.5">
                        {formatCurrency(total, currency)}
                    </span>
                </div>
            </div>

            {/* Monospace Micro-Legend */}
            <div className="mt-2 flex-1 overflow-y-auto space-y-1 pr-1 font-mono text-[10px]">
                {formattedData.slice(0, 5).map((item, idx) => (
                    <div
                        key={idx}
                        className="flex items-center justify-between p-1 rounded hover:bg-zinc-850/50 transition-colors"
                    >
                        <div className="flex items-center gap-2 truncate pr-2">
                            <span
                                className="w-2 h-2 rounded-xs shrink-0"
                                style={{ backgroundColor: item.color }}
                            />
                            <span className="text-zinc-300 truncate">{item.name}</span>
                            {item.category_code && (
                                <span className="text-[9px] text-zinc-600">[{item.category_code}]</span>
                            )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <span className="text-zinc-100 font-bold tabular-nums">
                                {formatCurrency(item.value, currency)}
                            </span>
                            <span className="text-zinc-500 tabular-nums w-9 text-right">
                                {Number(item.percentage || 0).toFixed(1)}%
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
