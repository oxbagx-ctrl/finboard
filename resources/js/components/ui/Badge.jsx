import React from 'react';

export const Badge = React.forwardRef(({ children, variant = 'default', size = 'md', className = '', ...props }, ref) => {
    const sizeClasses = {
        sm: 'px-1.5 py-0.5 text-[10px]',
        md: 'px-2 py-0.5 text-[11px]',
        lg: 'px-2.5 py-1 text-xs',
    };

    const variantClasses = {
        default: 'bg-zinc-850 text-zinc-300 border-zinc-700',
        brand: 'bg-blue-950/60 text-blue-300 border-blue-800/80',
        success: 'bg-emerald-950/60 text-emerald-300 border-emerald-800/80',
        warning: 'bg-amber-950/60 text-amber-300 border-amber-800/80',
        danger: 'bg-rose-950/60 text-rose-300 border-rose-800/80',
        purple: 'bg-purple-950/60 text-purple-300 border-purple-800/80',
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
