import React, { useState, useRef, cloneElement, isValidElement } from 'react';
import {
    useFloating,
    autoUpdate,
    offset as floatingOffset,
    flip,
    shift,
    arrow as floatingArrowMiddleware,
    useHover,
    useFocus,
    useDismiss,
    useRole,
    useClick,
    useInteractions,
    FloatingPortal,
    FloatingArrow,
    safePolygon,
} from '@floating-ui/react';
import clsx from 'clsx';
import { Info, HelpCircle } from 'lucide-react';

/**
 * Enterprise Accessible Tooltip Component using @floating-ui/react
 * Conforms to WCAG 2.1 / 2.2 AA (1.4.13 Content on Hover or Focus, 2.1.1 Keyboard Accessible)
 */
export function Tooltip({
    children,
    content,
    placement = 'top',
    delay = { open: 200, close: 150 },
    offset = undefined,
    interactive = true,
    arrow = true,
    touchable = true,
    disabled = false,
    className = '',
    arrowClassName = 'fill-white dark:fill-zinc-950 stroke-zinc-300 dark:stroke-zinc-750',
    asChild = true,
    portal = true,
    open: controlledOpen,
    onOpenChange,
    'data-testid': testId,
}) {
    const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
    const isOpen = controlledOpen !== undefined ? controlledOpen : uncontrolledOpen;
    const arrowRef = useRef(null);

    const handleOpenChange = (nextOpen) => {
        if (controlledOpen === undefined) {
            setUncontrolledOpen(nextOpen);
        }
        if (onOpenChange) {
            onOpenChange(nextOpen);
        }
    };

    const hasValidContent = content !== undefined && content !== null && content !== false && content !== '';
    const isEnabled = !disabled && Boolean(hasValidContent);

    const effectiveOffset = offset !== undefined ? offset : (arrow ? 8 : 6);

    const {
        refs,
        floatingStyles,
        context,
    } = useFloating({
        open: isOpen && isEnabled,
        onOpenChange: handleOpenChange,
        placement,
        whileElementsMounted: autoUpdate,
        middleware: [
            floatingOffset(effectiveOffset),
            flip({
                fallbackAxisSideDirection: 'start',
                padding: 8,
            }),
            shift({ padding: 8 }),
            arrow ? floatingArrowMiddleware({ element: arrowRef }) : null,
        ].filter(Boolean),
    });

    const hover = useHover(context, {
        enabled: isEnabled,
        delay: typeof delay === 'number' ? delay : { open: delay?.open ?? 200, close: delay?.close ?? 150 },
        move: false,
        handleClose: interactive ? safePolygon({ requireIntent: false }) : null,
    });

    const focus = useFocus(context, {
        enabled: isEnabled,
        visibleOnly: false,
    });

    const dismiss = useDismiss(context, {
        escapeKey: true,
        outsidePress: true,
    });

    const role = useRole(context, { role: 'tooltip' });

    const click = useClick(context, {
        enabled: touchable && isEnabled,
        ignoreMouse: false,
    });

    const { getReferenceProps, getFloatingProps } = useInteractions([
        hover,
        focus,
        dismiss,
        role,
        click,
    ]);

    if (!hasValidContent) {
        return children;
    }

    const PortalWrapper = portal ? FloatingPortal : React.Fragment;

    let triggerElement;
    if (asChild && isValidElement(children) && typeof children.type !== 'symbol') {
        const existingRef = children.props?.ref || children.ref;
        const mergedRef = (node) => {
            refs.setReference(node);
            if (typeof existingRef === 'function') {
                existingRef(node);
            } else if (existingRef && typeof existingRef === 'object') {
                existingRef.current = node;
            }
        };

        triggerElement = cloneElement(
            children,
            getReferenceProps({
                ...children.props,
                ref: mergedRef,
            })
        );
    } else {
        triggerElement = (
            <span
                ref={refs.setReference}
                {...getReferenceProps()}
                className="inline-flex items-center"
            >
                {children}
            </span>
        );
    }

    return (
        <>
            {triggerElement}
            {isOpen && isEnabled && (
                <PortalWrapper>
                    <div
                        ref={refs.setFloating}
                        style={floatingStyles}
                        {...getFloatingProps()}
                        data-testid={testId || 'floating-tooltip'}
                        className={clsx(
                            'z-50 max-w-xs sm:max-w-sm rounded-md px-2.5 py-1.5 text-xs font-mono tracking-tight',
                            'bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-750 shadow-xl',
                            'animate-in fade-in-0 zoom-in-95 duration-100 select-text',
                            className
                        )}
                    >
                        {content}
                        {arrow && (
                            <FloatingArrow
                                ref={arrowRef}
                                context={context}
                                className={arrowClassName}
                                strokeWidth={1}
                                width={10}
                                height={5}
                            />
                        )}
                    </div>
                </PortalWrapper>
            )}
        </>
    );
}

const SIZE_PRESETS = {
    xs: { px: 12, cls: 'w-3 h-3' },
    sm: { px: 13, cls: 'w-3.5 h-3.5' },
    md: { px: 16, cls: 'w-4 h-4' },
    lg: { px: 20, cls: 'w-5 h-5' },
};

/**
 * Dedicated ergonomic info/metric tooltip rendering an icon button trigger
 */
export function InfoTooltip({
    content,
    title,
    ariaLabel = 'Więcej informacji',
    size = 'sm',
    icon = 'info',
    className = '',
    iconClassName = '',
    placement = 'top',
    interactive = true,
    delay = { open: 150, close: 100 },
    ...tooltipProps
}) {
    const IconComponent = typeof icon === 'function' 
        ? icon 
        : (icon === 'help' ? HelpCircle : Info);

    const preset = typeof size === 'string' && SIZE_PRESETS[size]
        ? SIZE_PRESETS[size]
        : typeof size === 'number'
            ? {
                px: size,
                cls: size <= 12 ? 'w-3 h-3' : size <= 14 ? 'w-3.5 h-3.5' : size <= 16 ? 'w-4 h-4' : 'w-5 h-5'
            }
            : SIZE_PRESETS.sm;

    const numericSize = preset.px;
    const sizeClass = preset.cls;

    const tooltipBody = title ? (
        <div className="space-y-1">
            <div className="font-semibold text-zinc-900 dark:text-zinc-200 border-b border-zinc-200 dark:border-zinc-800/80 pb-0.5">
                {title}
            </div>
            <div className="text-zinc-600 dark:text-zinc-300 leading-relaxed font-sans text-xs">
                {content}
            </div>
        </div>
    ) : (
        content
    );

    return (
        <Tooltip
            content={tooltipBody}
            placement={placement}
            interactive={interactive}
            delay={delay}
            {...tooltipProps}
        >
            <button
                type="button"
                aria-label={ariaLabel}
                className={clsx(
                    'inline-flex items-center justify-center text-zinc-400 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-200',
                    'focus:outline-none focus-visible:ring-1 focus-visible:ring-brand-500 rounded p-0.5',
                    'transition-colors cursor-help shrink-0 align-middle leading-none',
                    className
                )}
                onClick={(e) => e.stopPropagation()}
            >
                <IconComponent
                    size={numericSize}
                    className={clsx('shrink-0', sizeClass, iconClassName)}
                    aria-hidden="true"
                />
            </button>
        </Tooltip>
    );
}

export default Tooltip;
