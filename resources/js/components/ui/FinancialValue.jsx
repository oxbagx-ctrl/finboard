import React from 'react';
import { formatCurrency } from '../../utils/formatters';

export const FinancialValue = ({
    amount,
    currency = 'PLN',
    compact = false,
    color = 'neutral', // 'neutral' | 'profit' | 'loss' | 'auto'
    size = 'md',       // 'sm' | 'md' | 'lg' | 'xl' | '2xl'
    align = 'right',   // 'left' | 'right' | 'center'
    isDeduction = false,
    bracketNegative = false,
    className = '',
}) => {
    const num = Number(amount || 0);

    const sizeClasses = {
        sm: 'text-xs',
        md: 'text-sm',
        lg: 'text-base font-semibold',
        xl: 'text-lg font-bold',
        '2xl': 'text-2xl font-bold',
    };

    const alignClasses = {
        left: 'text-left justify-start',
        right: 'text-right justify-end',
        center: 'text-center justify-center',
    };

    let textColor = 'text-zinc-100';
    if (color === 'profit' || (color === 'auto' && num > 0)) {
        textColor = 'text-emerald-400';
    } else if (color === 'loss' || (color === 'auto' && num < 0)) {
        textColor = 'text-rose-400';
    }

    const shouldUseBracket = bracketNegative || (isDeduction && num > 0);
    const displayNum = isDeduction && num > 0 ? num : (shouldUseBracket && num < 0 ? Math.abs(num) : num);

    const formatted = formatCurrency(displayNum, currency, compact);
    // Split formatted text into number and currency suffix
    const parts = formatted.split(/\s(?=[^\s]+$)/);
    let valuePart = parts[0] || formatted;
    const currencyPart = parts[1] || currency;

    if (shouldUseBracket) {
        valuePart = `(${valuePart})`;
    }

    return (
        <span
            className={`inline-flex items-baseline font-mono tabular-nums tracking-tight whitespace-nowrap ${sizeClasses[size]} ${textColor} ${alignClasses[align]} ${className}`}
        >
            <span className="font-mono tabular-nums">{valuePart}</span>
            <span className="ml-1 text-[0.8em] font-mono font-normal text-zinc-500 tracking-normal uppercase shrink-0">
                {currencyPart}
            </span>
        </span>
    );
};
