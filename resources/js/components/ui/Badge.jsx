import React from 'react';

export const Badge = ({ children, variant = 'default', size = 'md', className = '' }) => {
    const sizeClasses = {
        sm: 'px-2 py-0.5 text-[11px]',
        md: 'px-2.5 py-1 text-xs',
        lg: 'px-3 py-1.5 text-sm',
    };

    const variantClasses = {
        default: 'bg-slate-700/60 text-slate-300 border-slate-600',
        brand: 'bg-brand-500/15 text-brand-300 border-brand-500/30',
        success: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
        warning: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
        danger: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
        purple: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
    };

    return (
        <span
            className={`inline-flex items-center font-medium rounded-lg border ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
        >
            {children}
        </span>
    );
};
