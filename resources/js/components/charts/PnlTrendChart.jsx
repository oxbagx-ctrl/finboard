import React from 'react';
import {
    ResponsiveContainer,
    ComposedChart,
    Bar,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend
} from 'recharts';
import { CustomChartTooltip } from './CustomChartTooltip';
import { useTheme } from '../../context/ThemeContext';

export const PnlTrendChart = ({ data = [], currency = 'PLN', className = '' }) => {
    const { isDark } = useTheme();
    const gridStroke = isDark ? '#27272a' : '#e4e4e7';
    const axisStroke = '#71717a';
    const axisLineStroke = isDark ? '#3f3f46' : '#d4d4d8';
    const dotStroke = isDark ? '#09090b' : '#ffffff';
    const cursorFill = isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)';

    if (!data || data.length === 0) {
        return (
            <div className="h-72 flex items-center justify-center text-xs font-mono text-zinc-400 dark:text-zinc-500">
                Brak danych trendu dla wybranego zakresu.
            </div>
        );
    }

    const formatYAxis = (val) => {
        if (Math.abs(val) >= 1000000) {
            return `${(val / 1000000).toFixed(1)}M`;
        }
        if (Math.abs(val) >= 1000) {
            return `${(val / 1000).toFixed(0)}k`;
        }
        return val;
    };

    return (
        <div className={`w-full h-80 ${className}`}>
            <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                    data={data}
                    margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                >
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                    <XAxis
                        dataKey="label"
                        stroke={axisStroke}
                        fontSize={10}
                        fontFamily="JetBrains Mono, monospace"
                        tickLine={false}
                        axisLine={{ stroke: axisLineStroke }}
                    />
                    <YAxis
                        stroke={axisStroke}
                        fontSize={10}
                        fontFamily="JetBrains Mono, monospace"
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={formatYAxis}
                    />
                    <Tooltip
                        content={<CustomChartTooltip currency={currency} />}
                        cursor={{ fill: cursorFill }}
                    />
                    <Legend
                        verticalAlign="top"
                        align="right"
                        wrapperStyle={{
                            paddingBottom: '12px',
                            fontSize: '10px',
                            fontFamily: 'JetBrains Mono, monospace',
                        }}
                        iconType="rect"
                        iconSize={8}
                        formatter={(value) => <span className="text-zinc-600 dark:text-zinc-400">{value}</span>}
                    />
                    <Bar
                        dataKey="revenue"
                        name="Przychody ze sprzedaży"
                        fill="#10b981"
                        radius={[2, 2, 0, 0]}
                        maxBarSize={32}
                    />
                    <Bar
                        dataKey="opex"
                        name="Koszty operacyjne (OPEX)"
                        fill="#f43f5e"
                        radius={[2, 2, 0, 0]}
                        maxBarSize={32}
                    />
                    <Line
                        type="monotone"
                        dataKey="ebitda"
                        name="Wynik EBITDA"
                        stroke="#38bdf8"
                        strokeWidth={2}
                        dot={{ r: 3, fill: '#38bdf8', strokeWidth: 1, stroke: dotStroke }}
                        activeDot={{ r: 5 }}
                    />
                    <Line
                        type="monotone"
                        dataKey="net_profit"
                        name="Zysk netto"
                        stroke="#a855f7"
                        strokeWidth={1.5}
                        strokeDasharray="4 2"
                        dot={{ r: 2.5, fill: '#a855f7', strokeWidth: 1, stroke: dotStroke }}
                    />
                </ComposedChart>
            </ResponsiveContainer>
        </div>
    );
};
