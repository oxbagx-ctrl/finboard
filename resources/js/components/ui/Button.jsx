import React from 'react';

export const Button = ({
    children,
    variant = 'primary',
    size = 'md',
    className = '',
    disabled = false,
    loading = false,
    icon: Icon,
    onClick,
    type = 'button',
    ...props
}) => {
    const baseClasses = 'inline-flex items-center justify-center font-medium rounded-md transition-colors duration-150 focus:outline-none focus:ring-1 focus:ring-zinc-400 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer';

    const sizeClasses = {
        sm: 'px-2.5 py-1.5 text-xs gap-1.5',
        md: 'px-3.5 py-2 text-xs gap-2',
        lg: 'px-4.5 py-2.5 text-sm gap-2',
    };

    const variantClasses = {
        primary: 'bg-zinc-100 hover:bg-white text-zinc-950 font-semibold border border-zinc-200',
        secondary: 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700/80',
        outline: 'bg-transparent hover:bg-zinc-800 text-zinc-300 border border-zinc-750',
        danger: 'bg-rose-950 hover:bg-rose-900 text-rose-200 border border-rose-800/80',
        success: 'bg-emerald-950 hover:bg-emerald-900 text-emerald-200 border border-emerald-800/80',
        ghost: 'bg-transparent hover:bg-zinc-800/70 text-zinc-400 hover:text-zinc-200',
    };

    return (
        <button
            type={type}
            disabled={disabled || loading}
            onClick={onClick}
            className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
            {...props}
        >
            {loading ? (
                <svg className="animate-spin -ml-1 mr-2 h-3.5 w-3.5 text-current" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
            ) : Icon ? (
                <Icon className={size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
            ) : null}
            {children}
        </button>
    );
};
