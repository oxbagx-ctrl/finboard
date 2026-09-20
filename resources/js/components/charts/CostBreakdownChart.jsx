import React, { useMemo } from "react";
import {
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Tooltip
} from "recharts";
import { CustomChartTooltip } from "./CustomChartTooltip";
import { PercentageBadge } from "../ui/PercentageBadge";
import { formatCurrency, formatDelta } from "../../utils/formatters";

const EXTENDED_PALETTE = [
    "#38bdf8", // sky-400
    "#818cf8", // indigo-400
    "#fb7185", // rose-400
    "#fbbf24", // amber-400
    "#34d399", // emerald-400
    "#a78bfa", // violet-400
    "#f472b6", // pink-400
    "#2dd4bf", // teal-400
    "#fb923c", // orange-400
    "#a3e635", // lime-400
    "#94a3b8", // slate-400
    "#cbd5e1", // slate-300
];

export const CostBreakdownChart = ({
    data = [],
    currency = "PLN",
    title = "SUMA KOSZTÓW",
    className = "",
    reverseChange = true,
}) => {
    if (!data || data.length === 0) {
        return (
            <div className="h-72 flex items-center justify-center text-xs font-mono text-zinc-500">
                Brak danych struktury kosztów operacyjnych (OPEX) dla wybranego okresu.
            </div>
        );
    }

    const total = useMemo(
        () => data.reduce((sum, item) => sum + Number(item.amount || 0), 0),
        [data]
    );

    // Sort items descending by amount to provide a clean institutional financial breakdown
    const sortedData = useMemo(() => {
        return [...data]
            .sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0))
            .map((item, idx) => {
                const amountVal = Number(item.amount || 0);
                const prevVal = item.previous_amount != null ? Number(item.previous_amount) : null;
                const changeVal = item.amount_change != null ? Number(item.amount_change) : null;
                const yoyGrowth = item.yoy_growth_pct != null ? Number(item.yoy_growth_pct) : null;

                const tooltipTitle = prevVal != null
                    ? `Poprzednio: ${formatCurrency(prevVal, currency)} | Zmiana: ${formatDelta(changeVal ?? (amountVal - prevVal), currency)}`
                    : (yoyGrowth != null ? `Dynamika R/R: ${yoyGrowth > 0 ? "+" : ""}${yoyGrowth.toFixed(1)}%` : undefined);

                return {
                    ...item,
                    name: item.category_name,
                    value: amountVal,
                    previousAmount: prevVal,
                    amountChange: changeVal,
                    yoyGrowth,
                    tooltipTitle,
                    color: EXTENDED_PALETTE[idx % EXTENDED_PALETTE.length],
                };
            });
    }, [data, currency]);

    return (
        <div className={`flex flex-col h-80 ${className}`}>
            {/* Donut Chart Container */}
            <div className="relative h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={sortedData}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={76}
                            paddingAngle={2}
                            dataKey="value"
                            stroke="#09090b"
                            strokeWidth={2}
                        >
                            {sortedData.map((entry, index) => (
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
                        {title}
                    </span>
                    <span className="text-xs font-bold font-mono text-zinc-100 tabular-nums mt-0.5">
                        {formatCurrency(total, currency)}
                    </span>
                </div>
            </div>

            {/* Monospace Micro-Legend with Auto-Sorting & YoY Dynamics Badges */}
            <div className="mt-2 flex-1 overflow-y-auto space-y-1 pr-1 font-mono text-[10px]">
                {sortedData.map((item, idx) => (
                    <div
                        key={item.category_id || idx}
                        className="flex items-center justify-between p-1 rounded hover:bg-zinc-850/50 transition-colors gap-2"
                    >
                        <div className="flex items-center gap-2 truncate pr-1">
                            <span
                                className="w-2 h-2 rounded-xs shrink-0"
                                style={{ backgroundColor: item.color }}
                            />
                            <span className="text-zinc-300 truncate" title={item.name}>
                                {item.name}
                            </span>
                            {item.category_code && (
                                <span className="text-[9px] text-zinc-600 shrink-0">
                                    [{item.category_code}]
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <span className="text-zinc-100 font-bold tabular-nums">
                                {formatCurrency(item.value, currency)}
                            </span>
                            <span className="text-zinc-500 tabular-nums w-10 text-right">
                                {Number(item.percentage || 0).toFixed(1)}%
                            </span>
                            <PercentageBadge
                                value={item.yoyGrowth}
                                reverse={reverseChange}
                                title={item.tooltipTitle}
                                className="scale-90 origin-right"
                            />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
