import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeToggle } from '../../components/ui/ThemeToggle';
import { ThemeProvider, THEMES } from '../../context/ThemeContext';

const renderThemeToggle = (defaultTheme = THEMES.SYSTEM) => {
    return render(
        <ThemeProvider defaultTheme={defaultTheme}>
            <ThemeToggle />
        </ThemeProvider>
    );
};

describe('ThemeToggle Component', () => {
    beforeEach(() => {
        localStorage.clear();
        document.documentElement.classList.remove('dark');
        window.matchMedia = vi.fn().mockImplementation((query) => ({
            matches: true,
            media: query,
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
        }));
    });

    it('renders theme toggle trigger button with accessible attributes', () => {
        renderThemeToggle(THEMES.SYSTEM);

        const trigger = screen.getByTestId('theme-toggle-trigger');
        expect(trigger).toBeInTheDocument();
        expect(trigger).toHaveAttribute('aria-haspopup', 'true');
        expect(trigger).toHaveAttribute('aria-expanded', 'false');
        expect(trigger).toHaveAttribute('aria-label', expect.stringContaining('Przełącz motyw'));
    });

    it('opens dropdown menu on trigger click and displays all theme options', () => {
        renderThemeToggle(THEMES.SYSTEM);

        const trigger = screen.getByTestId('theme-toggle-trigger');
        fireEvent.click(trigger);

        expect(trigger).toHaveAttribute('aria-expanded', 'true');
        const menu = screen.getByTestId('theme-toggle-dropdown');
        expect(menu).toBeInTheDocument();
        expect(menu).toHaveAttribute('role', 'menu');

        expect(screen.getByText(/Motyw interfejsu/i)).toBeInTheDocument();
        expect(screen.getByTestId('theme-option-light')).toHaveTextContent('Jasny');
        expect(screen.getByTestId('theme-option-dark')).toHaveTextContent('Ciemny');
        expect(screen.getByTestId('theme-option-system')).toHaveTextContent('Systemowy');
    });

    it('highlights currently active theme with aria-checked="true"', () => {
        renderThemeToggle(THEMES.DARK);

        const trigger = screen.getByTestId('theme-toggle-trigger');
        fireEvent.click(trigger);

        const darkOption = screen.getByTestId('theme-option-dark');
        const lightOption = screen.getByTestId('theme-option-light');
        const systemOption = screen.getByTestId('theme-option-system');

        expect(darkOption).toHaveAttribute('aria-checked', 'true');
        expect(lightOption).toHaveAttribute('aria-checked', 'false');
        expect(systemOption).toHaveAttribute('aria-checked', 'false');
    });

    it('switches theme to light when option is selected and closes dropdown', async () => {
        renderThemeToggle(THEMES.DARK);

        const trigger = screen.getByTestId('theme-toggle-trigger');
        fireEvent.click(trigger);

        const lightOption = screen.getByTestId('theme-option-light');
        fireEvent.click(lightOption);

        // Menu should close
        expect(screen.queryByTestId('theme-toggle-dropdown')).not.toBeInTheDocument();
        expect(trigger).toHaveAttribute('aria-expanded', 'false');

        // Document should no longer have .dark class
        expect(document.documentElement.classList.contains('dark')).toBe(false);

        // Trigger should receive focus
        expect(document.activeElement).toBe(trigger);
    });

    it('closes menu when clicking outside of the dropdown', () => {
        renderThemeToggle();

        const trigger = screen.getByTestId('theme-toggle-trigger');
        fireEvent.click(trigger);

        expect(screen.getByTestId('theme-toggle-dropdown')).toBeInTheDocument();

        // Simulate mousedown outside dropdown
        fireEvent.mouseDown(document.body);

        expect(screen.queryByTestId('theme-toggle-dropdown')).not.toBeInTheDocument();
        expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });

    it('handles keyboard navigation: Escape closes dropdown and restores focus to trigger', () => {
        renderThemeToggle();

        const trigger = screen.getByTestId('theme-toggle-trigger');
        fireEvent.click(trigger);

        expect(screen.getByTestId('theme-toggle-dropdown')).toBeInTheDocument();

        fireEvent.keyDown(trigger, { key: 'Escape' });

        expect(screen.queryByTestId('theme-toggle-dropdown')).not.toBeInTheDocument();
        expect(document.activeElement).toBe(trigger);
    });

    it('handles keyboard navigation: ArrowDown and ArrowUp navigate between options', () => {
        renderThemeToggle();

        const trigger = screen.getByTestId('theme-toggle-trigger');

        // ArrowDown on trigger opens menu
        fireEvent.keyDown(trigger, { key: 'ArrowDown' });
        expect(screen.getByTestId('theme-toggle-dropdown')).toBeInTheDocument();

        const lightOption = screen.getByTestId('theme-option-light');
        const darkOption = screen.getByTestId('theme-option-dark');
        const systemOption = screen.getByTestId('theme-option-system');

        // Focus first option
        lightOption.focus();
        expect(document.activeElement).toBe(lightOption);

        // ArrowDown navigates to next option (dark)
        fireEvent.keyDown(lightOption, { key: 'ArrowDown' });
        expect(document.activeElement).toBe(darkOption);

        // ArrowDown navigates to next option (system)
        fireEvent.keyDown(darkOption, { key: 'ArrowDown' });
        expect(document.activeElement).toBe(systemOption);

        // ArrowDown wraps around to first option (light)
        fireEvent.keyDown(systemOption, { key: 'ArrowDown' });
        expect(document.activeElement).toBe(lightOption);

        // ArrowUp navigates backwards to system option
        fireEvent.keyDown(lightOption, { key: 'ArrowUp' });
        expect(document.activeElement).toBe(systemOption);
    });
});
