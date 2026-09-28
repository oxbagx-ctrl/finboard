import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
    ThemeProvider,
    useTheme,
    THEMES,
    THEME_STORAGE_KEY,
} from '../../context/ThemeContext';

describe('ThemeContext & useTheme Hook', () => {
    let mediaQueryListeners = [];
    let matchMediaMatches = true;

    beforeEach(() => {
        mediaQueryListeners = [];
        matchMediaMatches = true;
        localStorage.clear();
        document.documentElement.classList.remove('dark');

        // Mock window.matchMedia
        window.matchMedia = vi.fn().mockImplementation((query) => ({
            matches: matchMediaMatches,
            media: query,
            onchange: null,
            addListener: vi.fn((fn) => mediaQueryListeners.push(fn)),
            removeListener: vi.fn((fn) => {
                mediaQueryListeners = mediaQueryListeners.filter((l) => l !== fn);
            }),
            addEventListener: vi.fn((event, fn) => {
                if (event === 'change') mediaQueryListeners.push(fn);
            }),
            removeEventListener: vi.fn((event, fn) => {
                if (event === 'change') {
                    mediaQueryListeners = mediaQueryListeners.filter((l) => l !== fn);
                }
            }),
            dispatchEvent: vi.fn(),
        }));
    });

    afterEach(() => {
        vi.restoreAllMocks();
        localStorage.clear();
        document.documentElement.classList.remove('dark');
    });

    const wrapper = ({ children }) => <ThemeProvider>{children}</ThemeProvider>;

    it('initializes with default system theme and resolves to dark when OS prefers dark', () => {
        matchMediaMatches = true;
        const { result } = renderHook(() => useTheme(), { wrapper });

        expect(result.current.theme).toBe(THEMES.SYSTEM);
        expect(result.current.resolvedTheme).toBe(THEMES.DARK);
        expect(result.current.isDark).toBe(true);
        expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('initializes with default system theme and resolves to light when OS prefers light', () => {
        matchMediaMatches = false;
        const { result } = renderHook(() => useTheme(), { wrapper });

        expect(result.current.theme).toBe(THEMES.SYSTEM);
        expect(result.current.resolvedTheme).toBe(THEMES.LIGHT);
        expect(result.current.isDark).toBe(false);
        expect(document.documentElement.classList.contains('dark')).toBe(false);
    });

    it('reads and respects stored theme from localStorage on initial load', () => {
        localStorage.setItem(THEME_STORAGE_KEY, THEMES.LIGHT);

        const { result } = renderHook(() => useTheme(), { wrapper });

        expect(result.current.theme).toBe(THEMES.LIGHT);
        expect(result.current.resolvedTheme).toBe(THEMES.LIGHT);
        expect(result.current.isDark).toBe(false);
        expect(document.documentElement.classList.contains('dark')).toBe(false);
    });

    it('falls back to default system theme when localStorage contains an invalid value', () => {
        localStorage.setItem(THEME_STORAGE_KEY, 'corrupted_theme_value');

        const { result } = renderHook(() => useTheme(), { wrapper });

        expect(result.current.theme).toBe(THEMES.SYSTEM);
    });

    it('explicitly switches theme to light, persists in localStorage, and updates document classes', () => {
        const { result } = renderHook(() => useTheme(), { wrapper });

        act(() => {
            result.current.setTheme(THEMES.LIGHT);
        });

        expect(result.current.theme).toBe(THEMES.LIGHT);
        expect(result.current.resolvedTheme).toBe(THEMES.LIGHT);
        expect(result.current.isDark).toBe(false);
        expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe(THEMES.LIGHT);
        expect(document.documentElement.classList.contains('dark')).toBe(false);
    });

    it('explicitly switches theme to dark, persists in localStorage, and adds .dark class', () => {
        localStorage.setItem(THEME_STORAGE_KEY, THEMES.LIGHT);
        const { result } = renderHook(() => useTheme(), { wrapper });

        act(() => {
            result.current.setTheme(THEMES.DARK);
        });

        expect(result.current.theme).toBe(THEMES.DARK);
        expect(result.current.resolvedTheme).toBe(THEMES.DARK);
        expect(result.current.isDark).toBe(true);
        expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe(THEMES.DARK);
        expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('reacts dynamically to OS system color scheme changes when in system mode', () => {
        matchMediaMatches = true;
        const { result } = renderHook(() => useTheme(), { wrapper });

        expect(result.current.resolvedTheme).toBe(THEMES.DARK);
        expect(document.documentElement.classList.contains('dark')).toBe(true);

        // Simulate OS switching to light mode
        act(() => {
            mediaQueryListeners.forEach((listener) => listener({ matches: false }));
        });

        expect(result.current.resolvedTheme).toBe(THEMES.LIGHT);
        expect(result.current.isDark).toBe(false);
        expect(document.documentElement.classList.contains('dark')).toBe(false);

        // Simulate OS switching back to dark mode
        act(() => {
            mediaQueryListeners.forEach((listener) => listener({ matches: true }));
        });

        expect(result.current.resolvedTheme).toBe(THEMES.DARK);
        expect(result.current.isDark).toBe(true);
        expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('ignores OS color scheme changes when user has set an explicit theme', () => {
        const { result } = renderHook(() => useTheme(), { wrapper });

        act(() => {
            result.current.setTheme(THEMES.DARK);
        });

        // Simulate OS switching to light
        act(() => {
            mediaQueryListeners.forEach((listener) => listener({ matches: false }));
        });

        // Theme remains dark because of explicit user preference
        expect(result.current.theme).toBe(THEMES.DARK);
        expect(result.current.resolvedTheme).toBe(THEMES.DARK);
        expect(result.current.isDark).toBe(true);
        expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('provides safe fallback object when useTheme is called outside ThemeProvider', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const { result } = renderHook(() => useTheme());

        expect(result.current).toBeDefined();
        expect(result.current.theme).toBe(THEMES.DARK);
        expect(result.current.resolvedTheme).toBe(THEMES.DARK);
        expect(result.current.isDark).toBe(true);
        expect(typeof result.current.setTheme).toBe('function');

        // Calling setTheme on fallback should not throw
        expect(() => {
            result.current.setTheme(THEMES.LIGHT);
        }).not.toThrow();

        warnSpy.mockRestore();
    });

    it('warns and rejects invalid theme values passed to setTheme', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { result } = renderHook(() => useTheme(), { wrapper });

        act(() => {
            result.current.setTheme('cyberpunk');
        });

        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining('[ThemeContext] Nieobsługiwany motyw: "cyberpunk"')
        );
        expect(result.current.theme).toBe(THEMES.SYSTEM);

        warnSpy.mockRestore();
    });
});
