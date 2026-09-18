import React from 'react';

export const Card = ({ children, className = '', title, subtitle, action }) => {
    return (
        <div className={`bg-zinc-900 border border-zinc-800 rounded-lg p-5 shadow-sm ${className}`}>
            {(title || action) && (
                <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-zinc-800">
                    <div>
                        {title && <h3 className="text-sm font-semibold tracking-tight text-zinc-100">{title}</h3>}
                        {subtitle && <p className="text-[11px] text-zinc-400 mt-0.5">{subtitle}</p>}
                    </div>
                    {action && <div>{action}</div>}
                </div>
            )}
            {children}
        </div>
    );
};

export const MetricCard = ({ title, value, change, suffix = '', icon: Icon, trend = 'neutral', subtitle }) => {
    const isPositive = trend === 'up';
    const isNegative = trend === 'down';

    return (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 shadow-sm relative group hover:border-zinc-700 transition-colors">
            <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-mono font-medium uppercase tracking-wider text-zinc-400">{title}</span>
                {Icon && (
                    <div className="w-7 h-7 rounded bg-zinc-800 border border-zinc-750 flex items-center justify-center text-zinc-300">
                        <Icon className="w-3.5 h-3.5" />
                    </div>
                )}
            </div>
            <div className="text-xl font-bold font-mono tracking-tight text-zinc-100 tabular-nums">
                {value} {suffix && <span className="text-xs font-normal text-zinc-400 font-sans">{suffix}</span>}
            </div>
            {(change !== undefined || subtitle) && (
                <div className="flex items-center gap-2 mt-2 text-[11px]">
                    {change !== undefined && (
                        <span className={`font-mono font-medium ${isPositive ? 'text-emerald-400' : isNegative ? 'text-rose-400' : 'text-zinc-400'}`}>
                            {isPositive ? '+' : ''}{change}%
                        </span>
                    )}
                    {subtitle && <span className="text-zinc-500 font-mono">{subtitle}</span>}
                </div>
            )}
        </div>
    );
};
