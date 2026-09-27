import React, { useState } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { Tooltip, InfoTooltip } from '../../components/ui/Tooltip';
import { CustomChartTooltip } from '../../components/charts/CustomChartTooltip';

describe('Tooltip Accessibility & WCAG 2.1/2.2 AA Integration Regression Suite (Commit 272)', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.runOnlyPendingTimers();
        vi.useRealTimers();
    });

    describe('WCAG Criterion 1.4.13: Content on Hover or Focus (Dismissible, Hoverable, Persistent)', () => {
        it('ensures tooltip is Dismissible via Escape key without moving keyboard focus away from trigger', async () => {
            render(
                <div>
                    <Tooltip content="Wskaźnik zadłużenia netto do EBITDA" delay={0}>
                        <button type="button" data-testid="covenant-btn">
                            Net Debt / EBITDA
                        </button>
                    </Tooltip>
                    <button type="button" data-testid="next-btn">Następny</button>
                </div>
            );

            const trigger = screen.getByTestId('covenant-btn');
            trigger.focus();
            fireEvent.focus(trigger);

            act(() => {
                vi.advanceTimersByTime(50);
            });

            const tooltip = screen.getByRole('tooltip');
            expect(tooltip).toBeInTheDocument();

            // Press Escape to dismiss
            fireEvent.keyDown(document, { key: 'Escape' });

            act(() => {
                vi.advanceTimersByTime(50);
            });

            // Tooltip must be dismissed
            expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
            // Focus MUST remain on trigger (keyboard accessible)
            expect(document.activeElement).toBe(trigger);
        });

        it('ensures tooltip is Persistent while hover remains on trigger or floating content', async () => {
            render(
                <Tooltip
                    content="Szczegółowa metodologia kalkulacji zdyskontowanych przepływów DCF"
                    delay={0}
                >
                    <button type="button" data-testid="dcf-trigger">
                        Metodologia DCF
                    </button>
                </Tooltip>
            );

            const trigger = screen.getByTestId('dcf-trigger');
            fireEvent.mouseEnter(trigger);

            act(() => {
                vi.advanceTimersByTime(50);
            });

            expect(screen.getByRole('tooltip')).toBeInTheDocument();

            // Advance timers by several seconds (native title would auto-disappear, Floating UI tooltip MUST persist)
            act(() => {
                vi.advanceTimersByTime(10000);
            });

            expect(screen.getByRole('tooltip')).toBeInTheDocument();
            expect(screen.getByRole('tooltip')).toHaveTextContent(/Szczegółowa metodologia kalkulacji/i);
        });

        it('ensures tooltip is Hoverable allowing cursor to enter tooltip surface without disappearing', async () => {
            render(
                <Tooltip
                    content={
                        <div>
                            <span>Klauzula LMA: </span>
                            <a href="#details" data-testid="tooltip-link">Więcej informacji</a>
                        </div>
                    }
                    interactive={true}
                    delay={0}
                >
                    <button type="button" data-testid="lma-btn">Klauzula LMA</button>
                </Tooltip>
            );

            const trigger = screen.getByTestId('lma-btn');
            fireEvent.mouseEnter(trigger);

            act(() => {
                vi.advanceTimersByTime(50);
            });

            const tooltip = screen.getByRole('tooltip');
            expect(tooltip).toBeInTheDocument();

            // Move mouse onto the tooltip itself
            fireEvent.mouseEnter(tooltip);

            act(() => {
                vi.advanceTimersByTime(100);
            });

            expect(screen.getByRole('tooltip')).toBeInTheDocument();
            expect(screen.getByTestId('tooltip-link')).toBeInTheDocument();
        });
    });

    describe('WAI-ARIA Attributes and Screen Reader Verification', () => {
        it('correctly associates aria-describedby with dynamic tooltip id and role="tooltip"', async () => {
            render(
                <Tooltip content="Wskaźnik pokrycia odsetek ICR" delay={0}>
                    <button type="button" id="icr-covenant">ICR Ratio</button>
                </Tooltip>
            );

            const trigger = screen.getByRole('button', { name: 'ICR Ratio' });
            expect(trigger).not.toHaveAttribute('aria-describedby');

            fireEvent.mouseEnter(trigger);
            act(() => {
                vi.advanceTimersByTime(50);
            });

            const tooltip = screen.getByRole('tooltip');
            const tooltipId = tooltip.getAttribute('id');
            expect(tooltipId).toBeTruthy();
            expect(trigger).toHaveAttribute('aria-describedby', tooltipId);

            fireEvent.mouseLeave(trigger);
            act(() => {
                vi.advanceTimersByTime(200);
            });

            expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
            expect(trigger).not.toHaveAttribute('aria-describedby');
        });

        it('provides screen-reader accessible label via InfoTooltip button', async () => {
            render(
                <InfoTooltip
                    title="Bufor Rezerwy Obsługi Długu (DSRF)"
                    content="Kowenant wymagający zabezpieczenia równowartości 6-miesięcznych rat kapitałowo-odsetkowych."
                    ariaLabel="Szczegóły kowenantu DSRF"
                    delay={0}
                />
            );

            const infoBtn = screen.getByRole('button', { name: 'Szczegóły kowenantu DSRF' });
            expect(infoBtn).toHaveAttribute('aria-label', 'Szczegóły kowenantu DSRF');

            fireEvent.focus(infoBtn);
            act(() => {
                vi.advanceTimersByTime(50);
            });

            const tooltip = screen.getByRole('tooltip');
            expect(tooltip).toHaveTextContent(/Bufor Rezerwy Obsługi Długu/i);
            expect(tooltip).toHaveTextContent(/Kowenant wymagający zabezpieczenia/i);
        });
    });

    describe('Touch & Small Screen Ergonomics', () => {
        it('toggles tooltip visibility on click/tap for touch interactions without triggering native navigation', async () => {
            render(
                <Tooltip content="Informacja mobilna" touchable={true} delay={0}>
                    <button type="button" data-testid="touch-trigger">Mobile Metric</button>
                </Tooltip>
            );

            const trigger = screen.getByTestId('touch-trigger');

            // Tap 1: Open
            fireEvent.click(trigger);
            act(() => {
                vi.advanceTimersByTime(50);
            });
            expect(screen.getByRole('tooltip')).toBeInTheDocument();

            // Tap 2: Close
            fireEvent.click(trigger);
            act(() => {
                vi.advanceTimersByTime(50);
            });
            expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
        });
    });

    describe('Coexistence with Recharts CustomChartTooltip (No Collision)', () => {
        it('renders UI Tooltip and CustomChartTooltip concurrently without collision or DOM conflicts', async () => {
            const chartPayload = [
                {
                    name: 'Przychody',
                    value: 1250000,
                    color: '#10b981',
                },
                {
                    name: 'EBITDA',
                    value: 450000,
                    color: '#3b82f6',
                },
            ];

            const MockDashboardScreen = () => {
                const [chartActive, setChartActive] = useState(true);

                return (
                    <div>
                        {/* 1. Header with accessible UI Tooltip */}
                        <header>
                            <Tooltip content="Wskaźnik EBITDA LTM: 450 000 PLN" delay={0}>
                                <button type="button" data-testid="kpi-ebitda">
                                    EBITDA LTM
                                </button>
                            </Tooltip>
                        </header>

                        {/* 2. Chart container with Recharts CustomChartTooltip */}
                        <div data-testid="chart-wrapper">
                            <CustomChartTooltip
                                active={chartActive}
                                label="Q3 2026"
                                payload={chartPayload}
                            />
                        </div>
                    </div>
                );
            };

            render(<MockDashboardScreen />);

            // Recharts CustomChartTooltip should be rendered in chart wrapper
            expect(screen.getByText(/Q3 2026/)).toBeInTheDocument();
            expect(screen.getByText('Przychody')).toBeInTheDocument();
            expect(screen.getByText(/1\s*250\s*000/)).toBeInTheDocument();

            // Trigger UI Tooltip
            const kpiBtn = screen.getByTestId('kpi-ebitda');
            fireEvent.mouseEnter(kpiBtn);

            act(() => {
                vi.advanceTimersByTime(50);
            });

            // Both tooltips coexist cleanly
            const uiTooltip = screen.getByRole('tooltip');
            expect(uiTooltip).toBeInTheDocument();
            expect(uiTooltip).toHaveTextContent('Wskaźnik EBITDA LTM: 450 000 PLN');

            // Chart tooltip continues to function undisturbed
            expect(screen.getByText(/Q3 2026/)).toBeInTheDocument();

            // Close UI Tooltip via Escape
            fireEvent.keyDown(document, { key: 'Escape' });
            act(() => {
                vi.advanceTimersByTime(50);
            });

            expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
            expect(screen.getByText(/Q3 2026/)).toBeInTheDocument();
        });
    });
});
