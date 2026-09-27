import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { Tooltip, InfoTooltip } from '../../components/ui/Tooltip';

describe('Tooltip Component', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.runOnlyPendingTimers();
        vi.useRealTimers();
    });

    describe('WAI-ARIA Accessibility and Basic Rendering', () => {
        it('renders child element and keeps tooltip hidden initially', () => {
            render(
                <Tooltip content="Treść podpowiedzi">
                    <button type="button">Trigger Button</button>
                </Tooltip>
            );

            const trigger = screen.getByRole('button', { name: 'Trigger Button' });
            expect(trigger).toBeInTheDocument();
            expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
        });

        it('displays tooltip on hover with role="tooltip" and associates aria-describedby', async () => {
            render(
                <Tooltip content="Wskaźnik płynności bieżącej" delay={0}>
                    <button type="button">Opcja A</button>
                </Tooltip>
            );

            const trigger = screen.getByRole('button', { name: 'Opcja A' });

            fireEvent.mouseEnter(trigger);
            act(() => {
                vi.advanceTimersByTime(50);
            });

            const tooltip = screen.getByRole('tooltip');
            expect(tooltip).toBeInTheDocument();
            expect(tooltip).toHaveTextContent('Wskaźnik płynności bieżącej');

            const describedBy = trigger.getAttribute('aria-describedby');
            expect(describedBy).toBeTruthy();
            expect(tooltip).toHaveAttribute('id', describedBy);
        });

        it('displays tooltip on keyboard focus and removes it on blur', async () => {
            render(
                <Tooltip content="Informacja finansowa" delay={0}>
                    <button type="button">Akcja</button>
                </Tooltip>
            );

            const trigger = screen.getByRole('button', { name: 'Akcja' });

            fireEvent.focus(trigger);
            act(() => {
                vi.advanceTimersByTime(50);
            });

            expect(screen.getByRole('tooltip')).toBeInTheDocument();

            fireEvent.blur(trigger);
            act(() => {
                vi.advanceTimersByTime(200);
            });

            expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
        });

        it('dismisses tooltip when Escape key is pressed (WCAG 1.4.13 Dismissible)', async () => {
            render(
                <Tooltip content="Zamknij klawiszem Escape" delay={0}>
                    <button type="button">Element aktywacyjny</button>
                </Tooltip>
            );

            const trigger = screen.getByRole('button', { name: 'Element aktywacyjny' });

            fireEvent.focus(trigger);
            act(() => {
                vi.advanceTimersByTime(50);
            });

            expect(screen.getByRole('tooltip')).toBeInTheDocument();

            fireEvent.keyDown(document, { key: 'Escape' });
            act(() => {
                vi.advanceTimersByTime(50);
            });

            expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
        });
    });

    describe('Touch ergonomics, Delays, and Controlled Mode', () => {
        it('supports click / tap toggle for mobile and touch devices', async () => {
            render(
                <Tooltip content="Podpowiedź dotykowa" touchable={true} delay={0}>
                    <button type="button">Dotknij mnie</button>
                </Tooltip>
            );

            const trigger = screen.getByRole('button', { name: 'Dotknij mnie' });

            // First click opens
            fireEvent.click(trigger);
            act(() => {
                vi.advanceTimersByTime(50);
            });
            expect(screen.getByRole('tooltip')).toBeInTheDocument();

            // Second click closes
            fireEvent.click(trigger);
            act(() => {
                vi.advanceTimersByTime(50);
            });
            expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
        });

        it('respects custom delay configurations', async () => {
            render(
                <Tooltip content="Opóźniony dymek" delay={{ open: 300, close: 100 }}>
                    <button type="button">Hover</button>
                </Tooltip>
            );

            const trigger = screen.getByRole('button', { name: 'Hover' });

            fireEvent.mouseEnter(trigger);
            act(() => {
                vi.advanceTimersByTime(200);
            });
            // Not yet open at 200ms
            expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

            act(() => {
                vi.advanceTimersByTime(150);
            });
            // Opened after 350ms
            expect(screen.getByRole('tooltip')).toBeInTheDocument();

            fireEvent.mouseLeave(trigger);
            act(() => {
                vi.advanceTimersByTime(120);
            });
            // Closed after 120ms
            expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
        });

        it('does not open tooltip when disabled is true', async () => {
            render(
                <Tooltip content="Nieaktywny dymek" disabled={true} delay={0}>
                    <button type="button">Zablokowany</button>
                </Tooltip>
            );

            const trigger = screen.getByRole('button', { name: 'Zablokowany' });
            fireEvent.mouseEnter(trigger);
            fireEvent.focus(trigger);
            fireEvent.click(trigger);

            act(() => {
                vi.advanceTimersByTime(100);
            });

            expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
        });

        it('renders purely children without wrapper when content is empty or null', () => {
            const { container } = render(
                <Tooltip content="" delay={0}>
                    <button type="button">Brak treści</button>
                </Tooltip>
            );

            expect(screen.getByRole('button', { name: 'Brak treści' })).toBeInTheDocument();
            expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
        });

        it('supports controlled open state and onOpenChange callback', () => {
            const onOpenChange = vi.fn();
            const { rerender } = render(
                <Tooltip content="Kontrolowany" open={false} onOpenChange={onOpenChange}>
                    <button type="button">Stan zewnętrzny</button>
                </Tooltip>
            );

            expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

            rerender(
                <Tooltip content="Kontrolowany" open={true} onOpenChange={onOpenChange}>
                    <button type="button">Stan zewnętrzny</button>
                </Tooltip>
            );

            expect(screen.getByRole('tooltip')).toBeInTheDocument();
        });

        it('renders tooltip with custom placement and arrow indicator', () => {
            render(
                <Tooltip content="Pozycja dolna" placement="bottom" arrow={true} open={true}>
                    <button type="button">Element</button>
                </Tooltip>
            );

            const tooltip = screen.getByRole('tooltip');
            expect(tooltip).toBeInTheDocument();
            expect(tooltip).toHaveTextContent('Pozycja dolna');
            // FloatingArrow renders an svg inside the tooltip
            const arrowSvg = tooltip.querySelector('svg');
            expect(arrowSvg).toBeInTheDocument();
        });

        it('renders without arrow indicator when arrow is false', () => {
            render(
                <Tooltip content="Bez strzałki" arrow={false} open={true}>
                    <button type="button">Element</button>
                </Tooltip>
            );

            const tooltip = screen.getByRole('tooltip');
            expect(tooltip).toBeInTheDocument();
            const arrowSvg = tooltip.querySelector('svg');
            expect(arrowSvg).not.toBeInTheDocument();
        });
    });

    describe('InfoTooltip Component', () => {
        it('renders accessible info icon button with custom aria-label', async () => {
            render(
                <InfoTooltip
                    content="Kowenant LMA określający relację obsługi długu do CF"
                    title="DSCR (Debt Service Coverage Ratio)"
                    ariaLabel="Objaśnienie wskaźnika DSCR"
                    delay={0}
                />
            );

            const infoButton = screen.getByRole('button', { name: 'Objaśnienie wskaźnika DSCR' });
            expect(infoButton).toBeInTheDocument();
            expect(infoButton).toHaveAttribute('type', 'button');

            fireEvent.focus(infoButton);
            act(() => {
                vi.advanceTimersByTime(50);
            });

            const tooltip = screen.getByRole('tooltip');
            expect(tooltip).toBeInTheDocument();
            expect(tooltip).toHaveTextContent('DSCR (Debt Service Coverage Ratio)');
            expect(tooltip).toHaveTextContent('Kowenant LMA określający relację obsługi długu do CF');
        });

        it('stops click propagation to avoid triggering parent table row or card handlers', () => {
            const parentClick = vi.fn();

            render(
                <div onClick={parentClick}>
                    <InfoTooltip
                        content="Szczegóły kalkulacji"
                        ariaLabel="Informacje"
                        delay={0}
                    />
                </div>
            );

            const infoButton = screen.getByRole('button', { name: 'Informacje' });
            fireEvent.click(infoButton);

            expect(parentClick).not.toHaveBeenCalled();
        });

        it('supports help icon variant', () => {
            render(
                <InfoTooltip
                    content="Pytanie pomocnicze"
                    icon="help"
                    ariaLabel="Pomoc"
                />
            );

            expect(screen.getByRole('button', { name: 'Pomoc' })).toBeInTheDocument();
        });
    });
});
