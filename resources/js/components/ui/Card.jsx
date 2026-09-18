import React from 'react';

export const Card = ({ children, className = '', title, subtitle, action }) => {
    return (
        <div className={`bg-slate-800/80 border border-slate-700/70 rounded-2xl p-6 shadow-xl backdrop-blur-sm ${className}`}>
            {(title || action) && (
                <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-700/60">
                    <div>
                        {title && <h3 className="text-lg font-semibold text-slate-100">{title}</h3>}
                        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
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
        <div className="bg-slate-800/90 border border-slate-700/70 rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-slate-600 transition-all">
            <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium uppercase tracking-wider text-slate-400">{title}</span>
                {Icon && (
                    <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400 group-hover:bg-brand-500/20 transition-colors">
                        <Icon className="w-5 h-5" />
                    </div>
                )}
            </div>
            <div className="text-2xl font-bold text-slate-100 tracking-tight">
                {value} {suffix && <span className="text-sm font-normal text-slate-400">{suffix}</span>}
            </div>
            {(change !== undefined || subtitle) && (
                <div className="flex items-center gap-2 mt-2 text-xs">
                    {change !== undefined && (
                        <span className={`font-semibold ${isPositive ? 'text-emerald-400' : isNegative ? 'text-rose-400' : 'text-slate-400'}`}>
                            {isPositive ? '+' : ''}{change}%
                        </span>
                    )}
                    {subtitle && <span className="text-slate-400">{subtitle}</span>}
                </div>
            )}
        </div>
    );
};
