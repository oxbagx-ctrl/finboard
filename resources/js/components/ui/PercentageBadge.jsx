import React from 'react';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { formatPercent } from '../../utils/formatters';

export const PercentageBadge = ({
    value,
    decimals = 1,
    reverse = false, // if true, positive is bad (e.g. costs increase)
    showIcon = true,
    className = '',
}) => {
    const num = Number(value || 0);
    const isPositive = num > 0;
    const isNegative = num < 0;
    const isZero = num === 0;

    let isGood = isPositive;
    if (reverse) {
        isGood = isNegative;
    }

    let colorClasses = 'bg-zinc-850 text-zinc-400 border-zinc-750';
    if (!isZero) {
        if (isGood) {
            colorClasses = 'bg-emerald-950/60 text-emerald-300 border-emerald-800/80';
        } else {
            colorClasses = 'bg-rose-950/60 text-rose-300 border-rose-800/80';
        }
    }

    return (
        <span
            className={`inline-flex items-center gap-1 font-mono text-[11px] font-medium px-1.5 py-0.5 rounded border tabular-nums ${colorClasses} ${className}`}
        >
            {showIcon && (
                <>
                    {isPositive && <ArrowUpRight className="w-3 h-3 shrink-0" />}
                    {isNegative && <ArrowDownRight className="w-3 h-3 shrink-0" />}
                    {isZero && <Minus className="w-3 h-3 shrink-0 text-zinc-500" />}
                </>
            )}
            <span>{formatPercent(num, decimals, !isZero)}</span>
        </span>
    );
};
