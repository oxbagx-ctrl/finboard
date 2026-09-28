import React from 'react';
import { FinancialValue } from './FinancialValue';
import { PercentageBadge } from './PercentageBadge';
import { InfoTooltip } from './Tooltip';

export const Card = ({ children, className = '', title, subtitle, action }) => {
    return (
        <div className={`bg-zinc-900 !bg-white dark:!bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-5 shadow-sm text-zinc-900 dark:text-zinc-100 transition-colors duration-150 ${className}`}>
            {(title || action) && (
                <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-zinc-100 dark:border-zinc-800">
                    <div>
                        {title && <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">{title}</h3>}
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
    tooltipContent = null,
}) => {
    const isFallback = value === null || value === undefined || value === '—' || value === '-' || value === 'N/A';
    const displayValue = isFallback ? '—' : value;

    return (
        <div className={`bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 shadow-sm relative group hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors duration-150 ${className}`}>
            <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 truncate">{title}</span>
                    {tooltipContent && (
                        <InfoTooltip
                            content={tooltipContent}
                            title={typeof title === 'string' ? title : undefined}
                            ariaLabel={`Informacje o: ${title}`}
                            size="xs"
                        />
                    )}
                </div>
                {Icon && (
                    <div className="w-6 h-6 rounded bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-500 dark:text-zinc-400 shrink-0 shadow-xs">
                        <Icon className="w-3.5 h-3.5" />
                    </div>
                )}
            </div>

            <div className="my-1">
                {isFallback ? (
                    <div className="text-2xl font-bold font-mono tracking-tight text-zinc-400 dark:text-zinc-500 tabular-nums">
                        —
                    </div>
                ) : isRatio ? (
                    <div className="text-2xl font-bold font-mono tracking-tight text-zinc-900 dark:text-zinc-100 tabular-nums">
                        {displayValue}
                        <span className="text-xs font-mono font-normal text-zinc-500 ml-1">{ratioSuffix}</span>
                    </div>
                ) : typeof displayValue === 'number' ? (
                    <FinancialValue amount={displayValue} currency={currency} size="2xl" align="left" />
                ) : (
                    <div className="text-2xl font-bold font-mono tracking-tight text-zinc-900 dark:text-zinc-100 tabular-nums">
                        {displayValue}
                    </div>
                )}
            </div>

            {(change !== undefined || subtitle) && (
                <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-850 text-[11px] font-mono">
                    {change !== undefined ? (
                        <PercentageBadge value={change} reverse={reverseChange} />
                    ) : (
                        <span className="text-zinc-400 dark:text-zinc-600">—</span>
                    )}
                    {subtitle && <span className="text-zinc-500 truncate text-[10px] uppercase">{subtitle}</span>}
                </div>
            )}
        </div>
    );
};
