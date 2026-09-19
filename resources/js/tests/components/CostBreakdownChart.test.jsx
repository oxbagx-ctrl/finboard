import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CostBreakdownChart } from '../../components/charts/CostBreakdownChart';

vi.mock('recharts', async () => {
    const original = await vi.importActual('recharts');
    return {
        ...original,
        ResponsiveContainer: ({ children }) => <div className="responsive-container">{children}</div>,
    };
});

describe('CostBreakdownChart Component', () => {
    it('renders empty fallback state when no data is provided', () => {
        render(<CostBreakdownChart data={[]} />);

        expect(screen.getByText(/Brak danych struktury kosztów operacyjnych/i)).toBeInTheDocument();
    });

    it('renders OPEX categories and percentages in the legend', () => {
        const mockData = [
            {
                category_name: 'Wynagrodzenia i świadczenia',
                category_code: 'OPEX-SAL',
                amount: 150000,
                percentage: 60.0,
            },
            {
                category_name: 'Infrastruktura IT i chmura',
                category_code: 'OPEX-IT',
                amount: 100000,
                percentage: 40.0,
            },
        ];

        render(<CostBreakdownChart data={mockData} currency="PLN" />);

        expect(screen.getByText('Wynagrodzenia i świadczenia')).toBeInTheDocument();
        expect(screen.getByText('Infrastruktura IT i chmura')).toBeInTheDocument();
        expect(screen.getByText('60.0%')).toBeInTheDocument();
        expect(screen.getByText('40.0%')).toBeInTheDocument();
        expect(screen.getByText('SUMA KOSZTÓW')).toBeInTheDocument();
    });
});
