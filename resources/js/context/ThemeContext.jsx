import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

export const THEME_STORAGE_KEY = 'finboard_theme';

export const THEMES = Object.freeze({
    LIGHT: 'light',
    DARK: 'dark',
    SYSTEM: 'system',
});

export const ThemeContext = createContext(null);

/**
 * Safely reads the system dark mode preference via matchMedia.
 */
const getSystemPrefersDark = () => {
    if (typeof window !== 'undefined' && window.matchMedia) {
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return true; // Default fallback for Finboard
};

/**
 * Safely reads initial theme from localStorage.
 */
const getInitialTheme = (fallback = THEMES.SYSTEM) => {
    if (typeof window === 'undefined') return fallback;
    try {
        const stored = localStorage.getItem(THEME_STORAGE_KEY);
        if (stored === THEMES.LIGHT || stored === THEMES.DARK || stored === THEMES.SYSTEM) {
            return stored;
        }
    } catch (e) {
        // Fallback silently if localStorage is restricted
    }
    return fallback;
};

/**
 * Applies or removes the .dark class on documentElement.
 */
const applyThemeClass = (resolved) => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (resolved === THEMES.DARK) {
        root.classList.add('dark');
    } else {
        root.classList.remove('dark');
    }
};

/**
 * ThemeProvider Component
 * Manages theme state ('light' | 'dark' | 'system'), synchronizes with localStorage,
 * reacts to system prefers-color-scheme changes, and toggles the .dark class on <html>.
 */
export const ThemeProvider = ({ children, defaultTheme = THEMES.SYSTEM }) => {
    const [theme, setThemeState] = useState(() => getInitialTheme(defaultTheme));
    const [systemPrefersDark, setSystemPrefersDark] = useState(getSystemPrefersDark);

    // Calculate resolvedTheme: always either 'light' or 'dark'
    const resolvedTheme = useMemo(() => {
        if (theme === THEMES.SYSTEM) {
            return systemPrefersDark ? THEMES.DARK : THEMES.LIGHT;
        }
        return theme === THEMES.LIGHT ? THEMES.LIGHT : THEMES.DARK;
    }, [theme, systemPrefersDark]);

    // Apply class to document element whenever resolvedTheme changes
    useEffect(() => {
        applyThemeClass(resolvedTheme);
    }, [resolvedTheme]);

    // Listen to OS prefers-color-scheme media query events
    useEffect(() => {
        if (typeof window === 'undefined' || !window.matchMedia) return;

        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleChange = (e) => {
            setSystemPrefersDark(Boolean(e.matches));
        };

        if (mediaQuery.addEventListener) {
            mediaQuery.addEventListener('change', handleChange);
        } else if (mediaQuery.addListener) {
            mediaQuery.addListener(handleChange);
        }

        return () => {
            if (mediaQuery.removeEventListener) {
                mediaQuery.removeEventListener('change', handleChange);
            } else if (mediaQuery.removeListener) {
                mediaQuery.removeListener(handleChange);
            }
        };
    }, []);

    // Set theme with persistence
    const setTheme = useCallback((newTheme) => {
        if (newTheme !== THEMES.LIGHT && newTheme !== THEMES.DARK && newTheme !== THEMES.SYSTEM) {
            console.warn(`[ThemeContext] Nieobsługiwany motyw: "${newTheme}". Dopuszczalne: 'light', 'dark', 'system'.`);
            return;
        }

        try {
            localStorage.setItem(THEME_STORAGE_KEY, newTheme);
        } catch (e) {
            console.warn('[ThemeContext] Nie można zapisać preferencji motywu w localStorage:', e);
        }

        setThemeState(newTheme);
    }, []);

    const isDark = resolvedTheme === THEMES.DARK;

    const value = useMemo(() => ({
        theme,
        resolvedTheme,
        setTheme,
        isDark,
    }), [theme, resolvedTheme, setTheme, isDark]);

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
};

/**
 * Custom hook to consume the ThemeContext.
 * @returns {{ theme: 'light'|'dark'|'system', resolvedTheme: 'light'|'dark', setTheme: (theme: string) => void, isDark: boolean }}
 */
export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        return {
            theme: THEMES.DARK,
            resolvedTheme: THEMES.DARK,
            setTheme: () => {},
            isDark: true,
        };
    }
    return context;
};

export default ThemeContext;
