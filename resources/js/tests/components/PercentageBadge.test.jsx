import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PercentageBadge } from '../../components/ui/PercentageBadge';

describe('PercentageBadge Component', () => {
    describe('Missing and Null Data (Fallback States)', () => {
        it('renders clean fallback "—" when value is null without trend icons', () => {
            render(<PercentageBadge value={null} />);

            const fallback = screen.getByTestId('percentage-badge-fallback');
            expect(fallback).toBeInTheDocument();
            expect(fallback).toHaveTextContent('—');
            expect(screen.queryByTestId('badge-minus')).not.toBeInTheDocument();
            expect(screen.queryByTestId('badge-arrow-up')).not.toBeInTheDocument();
            expect(screen.queryByTestId('badge-arrow-down')).not.toBeInTheDocument();
            expect(screen.queryByText('0.0%')).not.toBeInTheDocument();
        });

        it('renders clean fallback "—" when value is undefined', () => {
            render(<PercentageBadge value={undefined} />);

            const fallback = screen.getByTestId('percentage-badge-fallback');
            expect(fallback).toBeInTheDocument();
            expect(fallback).toHaveTextContent('—');
            expect(screen.queryByText('0.0%')).not.toBeInTheDocument();
        });

        it('renders custom fallback text when specified', () => {
            render(<PercentageBadge value={null} fallback="N/D" />);

            const fallback = screen.getByTestId('percentage-badge-fallback');
            expect(fallback).toHaveTextContent('N/D');
        });

        it('treats empty strings, dashes and NaN strings as missing data', () => {
            const { rerender } = render(<PercentageBadge value="" />);
            expect(screen.getByTestId('percentage-badge-fallback')).toHaveTextContent('—');

            rerender(<PercentageBadge value="—" />);
            expect(screen.getByTestId('percentage-badge-fallback')).toHaveTextContent('—');

            rerender(<PercentageBadge value="N/A" />);
            expect(screen.getByTestId('percentage-badge-fallback')).toHaveTextContent('—');

            rerender(<PercentageBadge value="invalid-number" />);
            expect(screen.getByTestId('percentage-badge-fallback')).toHaveTextContent('—');
        });
    });

    describe('Legitimate Zero Growth (0.0%)', () => {
        it('renders 0.0% with Minus icon and neutral styling when value is number 0', () => {
            render(<PercentageBadge value={0} />);

            const badge = screen.getByTestId('percentage-badge');
            expect(badge).toBeInTheDocument();
            expect(badge).toHaveTextContent('0.0%');
            expect(screen.getByTestId('badge-minus')).toBeInTheDocument();
            expect(screen.queryByTestId('badge-arrow-up')).not.toBeInTheDocument();
            expect(screen.queryByTestId('badge-arrow-down')).not.toBeInTheDocument();
            expect(badge.className).toContain('text-zinc-400');
        });

        it('renders 0.0% when value is string "0" or "0.0"', () => {
            const { rerender } = render(<PercentageBadge value="0" />);
            expect(screen.getByTestId('percentage-badge')).toHaveTextContent('0.0%');
            expect(screen.getByTestId('badge-minus')).toBeInTheDocument();

            rerender(<PercentageBadge value="0.0" />);
            expect(screen.getByTestId('percentage-badge')).toHaveTextContent('0.0%');
        });
    });

    describe('Positive and Negative Variances', () => {
        it('renders positive growth with ArrowUpRight and emerald styling', () => {
            render(<PercentageBadge value={14.5} />);

            const badge = screen.getByTestId('percentage-badge');
            expect(badge).toHaveTextContent('+14.5%');
            expect(screen.getByTestId('badge-arrow-up')).toBeInTheDocument();
            expect(screen.queryByTestId('badge-minus')).not.toBeInTheDocument();
            expect(badge.className).toContain('text-emerald-300');
        });

        it('renders negative growth with ArrowDownRight and rose styling', () => {
            render(<PercentageBadge value={-8.2} />);

            const badge = screen.getByTestId('percentage-badge');
            expect(badge).toHaveTextContent('-8.2%');
            expect(screen.getByTestId('badge-arrow-down')).toBeInTheDocument();
            expect(screen.queryByTestId('badge-minus')).not.toBeInTheDocument();
            expect(badge.className).toContain('text-rose-300');
        });

        it('inverts color semantics when reverse={true} (e.g. cost increase is bad, decrease is good)', () => {
            const { rerender } = render(<PercentageBadge value={12.0} reverse={true} />);
            let badge = screen.getByTestId('percentage-badge');
            expect(badge).toHaveTextContent('+12.0%');
            // Increase with reverse should be rose
            expect(badge.className).toContain('text-rose-300');

            rerender(<PercentageBadge value={-6.5} reverse={true} />);
            badge = screen.getByTestId('percentage-badge');
            expect(badge).toHaveTextContent('-6.5%');
            // Decrease with reverse should be emerald
            expect(badge.className).toContain('text-emerald-300');
        });

        it('supports decimal ratios <= 1.0 converting to percent', () => {
            render(<PercentageBadge value={0.045} decimals={2} />);
            expect(screen.getByTestId('percentage-badge')).toHaveTextContent('+4.50%');
        });
    });
});
