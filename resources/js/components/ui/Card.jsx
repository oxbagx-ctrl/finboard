import React from 'react';
import { FinancialValue } from './FinancialValue';
import { PercentageBadge } from './PercentageBadge';

export const Card = ({ children, className = '', title, subtitle, action }) => {
    return (
        <div className={`bg-zinc-900 border border-zinc-800 rounded-lg p-5 shadow-sm ${className}`}>
            {(title || action) && (
                <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-zinc-800">
                    <div>
                        {title && <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-100">{title}</h3>}
                        {subtitle && <p className="text-[11px] font-mono text-zinc-500 mt-0.5">{subtitle}</p>}
                    </div>
                    {action && <div>{action}</div>}
                </div>
            )}
            {children}
        </div>
    );
};

export const MetricCard = ({
    title,
    value,
    currency = 'PLN',
    change,
    reverseChange = false,
    icon: Icon,
    subtitle,
    isRatio = false,
    ratioSuffix = 'x',
    className = '',
}) => {
    return (
        <div className={`bg-zinc-900 border border-zinc-800 rounded-lg p-4 shadow-sm relative group hover:border-zinc-700 transition-colors ${className}`}>
            <div className="flex items-center justify-between mb-2.5">
                <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-zinc-400">{title}</span>
                {Icon && (
                    <div className="w-6 h-6 rounded bg-zinc-950 border border-zinc-800 flex items-center justify-center text-zinc-400">
                        <Icon className="w-3.5 h-3.5" />
                    </div>
                )}
            </div>

            <div className="my-1">
                {isRatio ? (
                    <div className="text-2xl font-bold font-mono tracking-tight text-zinc-100 tabular-nums">
                        {value}
                        <span className="text-xs font-mono font-normal text-zinc-500 ml-1">{ratioSuffix}</span>
                    </div>
                ) : typeof value === 'number' ? (
                    <FinancialValue amount={value} currency={currency} size="2xl" align="left" />
                ) : (
                    <div className="text-2xl font-bold font-mono tracking-tight text-zinc-100 tabular-nums">
                        {value}
                    </div>
                )}
            </div>

            {(change !== undefined || subtitle) && (
                <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-zinc-850 text-[11px] font-mono">
                    {change !== undefined ? (
                        <PercentageBadge value={change} reverse={reverseChange} />
                    ) : (
                        <span className="text-zinc-600">—</span>
                    )}
                    {subtitle && <span className="text-zinc-500 truncate text-[10px] uppercase">{subtitle}</span>}
                </div>
            )}
        </div>
    );
};
