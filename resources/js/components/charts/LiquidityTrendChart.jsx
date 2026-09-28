import React from 'react';
import {
    ResponsiveContainer,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ReferenceLine
} from 'recharts';
import { CustomChartTooltip } from './CustomChartTooltip';
import { useTheme } from '../../context/ThemeContext';

export const LiquidityTrendChart = ({ data = [], className = '' }) => {
    const { isDark } = useTheme();
    const gridStroke = isDark ? '#27272a' : '#e4e4e7';
    const axisStroke = '#71717a';
    const axisLineStroke = isDark ? '#3f3f46' : '#d4d4d8';
    const dotStroke = isDark ? '#09090b' : '#ffffff';

    if (!data || data.length === 0) {
        return (
            <div className="h-72 flex items-center justify-center text-xs font-mono text-zinc-400 dark:text-zinc-500">
                Brak danych płynności dla wybranego okresu.
            </div>
        );
    }

    return (
        <div className={`w-full h-80 ${className}`}>
            <ResponsiveContainer width="100%" height="100%">
                <LineChart
                    data={data}
                    margin={{ top: 10, right: 15, left: -15, bottom: 0 }}
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
                        domain={[0, 'auto']}
                        tickFormatter={(v) => `${v.toFixed(1)}x`}
                    />
                    <Tooltip
                        content={<CustomChartTooltip isRatio={true} />}
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

                    {/* Industry Standard Reference Lines */}
                    <ReferenceLine
                        y={1.2}
                        stroke="#10b981"
                        strokeDasharray="3 3"
                        strokeOpacity={0.6}
                        label={{
                            value: 'BENCHMARK CR (1.20x)',
                            fill: '#10b981',
                            fontSize: 9,
                            fontFamily: 'JetBrains Mono, monospace',
                            position: 'insideBottomRight'
                        }}
                    />
                    <ReferenceLine
                        y={1.0}
                        stroke="#71717a"
                        strokeDasharray="3 3"
                        strokeOpacity={0.5}
                        label={{
                            value: 'BENCHMARK QR (1.00x)',
                            fill: '#71717a',
                            fontSize: 9,
                            fontFamily: 'JetBrains Mono, monospace',
                            position: 'insideBottomRight'
                        }}
                    />

                    <Line
                        type="monotone"
                        dataKey="current_ratio"
                        name="Wskaźnik bieżący (Current Ratio)"
                        stroke="#38bdf8"
                        strokeWidth={2}
                        dot={{ r: 3, fill: '#38bdf8', strokeWidth: 1, stroke: dotStroke }}
                        activeDot={{ r: 5 }}
                    />
                    <Line
                        type="monotone"
                        dataKey="quick_ratio"
                        name="Wskaźnik szybki (Quick Ratio)"
                        stroke="#fbbf24"
                        strokeWidth={1.75}
                        dot={{ r: 2.5, fill: '#fbbf24', strokeWidth: 1, stroke: dotStroke }}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
};
