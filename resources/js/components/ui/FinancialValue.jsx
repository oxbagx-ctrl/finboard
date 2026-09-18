import React from 'react';
import { formatCurrency } from '../../utils/formatters';

export const FinancialValue = ({
    amount,
    currency = 'PLN',
    compact = false,
    color = 'neutral', // 'neutral' | 'profit' | 'loss' | 'auto'
    size = 'md',       // 'sm' | 'md' | 'lg' | 'xl' | '2xl'
    align = 'right',   // 'left' | 'right' | 'center'
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

    const formatted = formatCurrency(num, currency, compact);
    // Split formatted text into number and currency suffix
    const parts = formatted.split(/\s(?=[^\s]+$)/);
    const valuePart = parts[0] || formatted;
    const currencyPart = parts[1] || currency;

    return (
        <span
            className={`inline-flex items-baseline font-mono tabular-nums tracking-tight ${sizeClasses[size]} ${textColor} ${alignClasses[align]} ${className}`}
        >
            <span>{valuePart}</span>
            <span className="ml-1 text-[0.8em] font-sans font-normal text-zinc-500 tracking-normal uppercase">
                {currencyPart}
            </span>
        </span>
    );
};
