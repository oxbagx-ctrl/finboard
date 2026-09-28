import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Sun, Moon, Monitor, Check } from 'lucide-react';
import { useTheme, THEMES } from '../../context/ThemeContext';
import { Tooltip } from './Tooltip';

export const THEME_OPTIONS = [
    {
        id: THEMES.LIGHT,
        label: 'Jasny',
        description: 'Motyw dzienny (wysoki kontrast)',
        icon: Sun,
    },
    {
        id: THEMES.DARK,
        label: 'Ciemny',
        description: 'Domyślny motyw nocny (dark-mode)',
        icon: Moon,
    },
    {
        id: THEMES.SYSTEM,
        label: 'Systemowy',
        description: 'Zgodny z preferencjami systemu',
        icon: Monitor,
    },
];

/**
 * Accessible ThemeToggle Component
 * Supports light, dark, and system themes with keyboard navigation, ARIA attributes, and tooltip integration.
 */
export const ThemeToggle = ({ className = '', align = 'right' }) => {
    const { theme, resolvedTheme, setTheme, isDark } = useTheme();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);
    const triggerRef = useRef(null);
    const menuRef = useRef(null);

    // Pick icon based on active preference
    const CurrentIcon = theme === THEMES.LIGHT
        ? Sun
        : theme === THEMES.DARK
        ? Moon
        : Monitor;

    const currentOption = THEME_OPTIONS.find((opt) => opt.id === theme) || THEME_OPTIONS[2];

    // Close on outside click
    useEffect(() => {
        if (!isOpen) return;

        const handleOutsideClick = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleOutsideClick);
        return () => {
            document.removeEventListener('mousedown', handleOutsideClick);
        };
    }, [isOpen]);

    // Handle keyboard navigation inside menu
    const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            setIsOpen(false);
            triggerRef.current?.focus();
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (!isOpen) {
                setIsOpen(true);
            } else {
                const items = menuRef.current?.querySelectorAll('[role="menuitemradio"]');
                if (items && items.length > 0) {
                    const currentIndex = Array.from(items).indexOf(document.activeElement);
                    const nextIndex = (currentIndex + 1) % items.length;
                    items[nextIndex]?.focus();
                }
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (isOpen) {
                const items = menuRef.current?.querySelectorAll('[role="menuitemradio"]');
                if (items && items.length > 0) {
                    const currentIndex = Array.from(items).indexOf(document.activeElement);
                    const prevIndex = (currentIndex - 1 + items.length) % items.length;
                    items[prevIndex]?.focus();
                }
            }
        }
    };

    const handleSelect = (selectedTheme) => {
        setTheme(selectedTheme);
        setIsOpen(false);
        triggerRef.current?.focus();
    };

    return (
        <div ref={dropdownRef} className={`relative inline-block text-left ${className}`} onKeyDown={handleKeyDown}>
            <Tooltip content={`Motyw: ${currentOption.label}`} disabled={isOpen}>
                <button
                    ref={triggerRef}
                    type="button"
                    onClick={() => setIsOpen((prev) => !prev)}
                    aria-haspopup="true"
                    aria-expanded={isOpen}
                    aria-label={`Przełącz motyw (aktualny: ${currentOption.label})`}
                    data-testid="theme-toggle-trigger"
                    className="p-1.5 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80 dark:hover:bg-zinc-900 transition-colors focus:outline-none focus:ring-1 focus:ring-zinc-500"
                >
                    <CurrentIcon className="w-3.5 h-3.5 text-zinc-300 dark:text-zinc-400" />
                </button>
            </Tooltip>

            {isOpen && (
                <div
                    ref={menuRef}
                    role="menu"
                    aria-label="Wybierz motyw aplikacji"
                    data-testid="theme-toggle-dropdown"
                    className={`absolute z-50 mt-2 w-44 rounded-md shadow-xl py-1 text-xs font-mono ${
                        align === 'right' ? 'right-0' : 'left-0'
                    } bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:outline-none`}
                >
                    <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 border-b border-zinc-100 dark:border-zinc-800">
                        Motyw interfejsu
                    </div>
                    {THEME_OPTIONS.map((opt) => {
                        const Icon = opt.icon;
                        const isSelected = theme === opt.id;
                        return (
                            <button
                                key={opt.id}
                                type="button"
                                role="menuitemradio"
                                aria-checked={isSelected}
                                data-testid={`theme-option-${opt.id}`}
                                onClick={() => handleSelect(opt.id)}
                                className={`w-full text-left px-3 py-2 flex items-center justify-between transition-colors ${
                                    isSelected
                                        ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold'
                                        : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/60'
                                }`}
                            >
                                <span className="flex items-center gap-2">
                                    <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-brand-500 dark:text-brand-400' : 'text-zinc-400'}`} />
                                    <span>{opt.label}</span>
                                </span>
                                {isSelected && (
                                    <Check className="w-3.5 h-3.5 text-brand-500 dark:text-brand-400" />
                                )}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default ThemeToggle;
