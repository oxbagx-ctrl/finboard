import React from 'react';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { formatPercent } from '../../utils/formatters';

/**
 * Institutional Deal Advisory percentage badge.
 * Cleanly distinguishes between:
 * - Missing/null/unavailable comparative data -> renders muted fallback ("—") without trend icons
 * - Legitimate 0.0% growth (flat/unchanged) -> renders neutral badge with Minus icon and "0.0%"
 * - Positive growth -> green badge with ArrowUpRight (or red if reverse)
 * - Negative growth -> red badge with ArrowDownRight (or green if reverse)
 */
export const PercentageBadge = ({
    value,
    decimals = 1,
    reverse = false, // if true, positive is bad (e.g. costs increase)
    showIcon = true,
    className = '',
    fallback = '—',
    title,
}) => {
    const isMissing =
        value === null ||
        value === undefined ||
        value === '' ||
        value === '—' ||
        value === '-' ||
        value === 'N/A' ||
        (typeof value === 'number' && Number.isNaN(value)) ||
        (typeof value === 'string' && Number.isNaN(Number(value)));

    if (isMissing) {
        return (
            <span
                data-testid="percentage-badge-fallback"
                className={`inline-flex items-center justify-center font-mono text-[11px] font-medium px-1.5 py-0.5 rounded border tabular-nums bg-zinc-850/60 text-zinc-500 border-zinc-800 ${className}`}
                title={title || "Brak danych porównawczych"}
            >
                <span>{fallback}</span>
            </span>
        );
    }

    const num = Number(value);
    const percentValue = Math.abs(num) <= 1.0 && num !== 0 ? num * 100 : num;
    const isZero = Number(percentValue.toFixed(decimals)) === 0;
    const isPositive = !isZero && num > 0;
    const isNegative = !isZero && num < 0;

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
            data-testid="percentage-badge"
            title={title}
            className={`inline-flex items-center gap-1 font-mono text-[11px] font-medium px-1.5 py-0.5 rounded border tabular-nums ${colorClasses} ${className}`}
        >
            {showIcon && (
                <>
                    {isPositive && <ArrowUpRight className="w-3 h-3 shrink-0" data-testid="badge-arrow-up" />}
                    {isNegative && <ArrowDownRight className="w-3 h-3 shrink-0" data-testid="badge-arrow-down" />}
                    {isZero && <Minus className="w-3 h-3 shrink-0 text-zinc-500" data-testid="badge-minus" />}
                </>
            )}
            <span>{formatPercent(num, decimals, !isZero)}</span>
        </span>
    );
};
