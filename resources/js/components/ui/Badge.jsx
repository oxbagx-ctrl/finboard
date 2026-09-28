import React from 'react';

export const Badge = React.forwardRef(({ children, variant = 'default', size = 'md', className = '', ...props }, ref) => {
    const sizeClasses = {
        sm: 'px-1.5 py-0.5 text-[10px]',
        md: 'px-2 py-0.5 text-[11px]',
        lg: 'px-2.5 py-1 text-xs',
    };

    const variantClasses = {
        default: 'bg-zinc-100 text-zinc-700 border-zinc-300 dark:bg-zinc-850 dark:text-zinc-300 dark:border-zinc-700',
        brand: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800/80',
        success: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/80',
        warning: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/80',
        danger: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800/80',
        purple: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800/80',
    };

    return (
        <span
            ref={ref}
            className={`inline-flex items-center font-mono font-medium rounded border ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
            {...props}
        >
            {children}
        </span>
    );
});

Badge.displayName = 'Badge';
