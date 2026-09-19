import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MetricCard } from '../../components/ui/Card';

describe('MetricCard Component', () => {
    it('renders clean fallback "—" without ratio suffix when value is null, undefined, or "—"', () => {
        const { rerender } = render(
            <MetricCard
                title="Wskaźnik Płynności Bieżącej"
                value={null}
                isRatio={true}
                ratioSuffix="x"
                subtitle="BRAK DANYCH BILANSOWYCH"
            />
        );

        expect(screen.getByText('Wskaźnik Płynności Bieżącej')).toBeInTheDocument();
        expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(1);
        expect(screen.queryByText('x')).not.toBeInTheDocument();
        expect(screen.getByText('BRAK DANYCH BILANSOWYCH')).toBeInTheDocument();

        // Rerender with '—' string and explicit change
        rerender(
            <MetricCard
                title="Wskaźnik Płynności Bieżącej"
                value="—"
                isRatio={true}
                ratioSuffix="x"
                change={2.5}
            />
        );
        expect(screen.getAllByText('—').length).toBe(1);
        expect(screen.queryByText('x')).not.toBeInTheDocument();
        expect(screen.getByText('+2.5%')).toBeInTheDocument();

        // Rerender with undefined
        rerender(
            <MetricCard
                title="Wskaźnik Płynności Bieżącej"
                value={undefined}
                isRatio={true}
                ratioSuffix="x"
            />
        );
        expect(screen.getAllByText('—').length).toBe(1);
        expect(screen.queryByText('x')).not.toBeInTheDocument();
    });

    it('renders ratio value with ratio suffix when valid value is provided', () => {
        render(
            <MetricCard
                title="Wskaźnik Płynności Bieżącej"
                value="1.85"
                isRatio={true}
                ratioSuffix="x"
                subtitle="CEL DORADCY: >1.5x"
            />
        );

        expect(screen.getByText('1.85')).toBeInTheDocument();
        expect(screen.getByText('x')).toBeInTheDocument();
        expect(screen.getByText('CEL DORADCY: >1.5x')).toBeInTheDocument();
    });

    it('renders currency value when numerical monetary value is passed', () => {
        render(
            <MetricCard
                title="Przychody ze Sprzedaży"
                value={2500000}
                currency="PLN"
                change={15.5}
                subtitle="DYNAMIKA R/R (+15.5%)"
            />
        );

        expect(screen.getByText('Przychody ze Sprzedaży')).toBeInTheDocument();
        expect(screen.getByText(/2\s*500\s*000/)).toBeInTheDocument();
        expect(screen.getByText('+15.5%')).toBeInTheDocument();
    });
});
