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
    it('verifies diverse multi-category OPEX distribution instead of single 100% entry', () => {
        const mockGranularOpex = [
            { category_id: 'cat-opex-payroll', category_name: 'Wynagrodzenia i świadczenia', category_code: 'PAYROLL', amount: 46000, percentage: 46.0 },
            { category_id: 'cat-opex-services', category_name: 'Usługi obce i podwykonawcy', category_code: 'SRV', amount: 18000, percentage: 18.0 },
            { category_id: 'cat-opex-office', category_name: 'Czynsz biurowy i media', category_code: 'OFFICE', amount: 14000, percentage: 14.0 },
            { category_id: 'cat-opex-marketing', category_name: 'Marketing i reklama B2B', category_code: 'MKT', amount: 9000, percentage: 9.0 },
            { category_id: 'cat-opex-software', category_name: 'Oprogramowanie i chmura', category_code: 'CLOUD', amount: 8000, percentage: 8.0 },
            { category_id: 'cat-opex-legal', category_name: 'Obsługa prawna i audyt', category_code: 'LEGAL', amount: 5000, percentage: 5.0 },
        ];

        render(<CostBreakdownChart data={mockGranularOpex} currency="PLN" />);

        // All 6 categories should be rendered in the legend without truncation
        expect(screen.getByText('Wynagrodzenia i świadczenia')).toBeInTheDocument();
        expect(screen.getByText('[PAYROLL]')).toBeInTheDocument();
        expect(screen.getByText('46.0%')).toBeInTheDocument();

        expect(screen.getByText('Usługi obce i podwykonawcy')).toBeInTheDocument();
        expect(screen.getByText('[SRV]')).toBeInTheDocument();
        expect(screen.getByText('18.0%')).toBeInTheDocument();

        expect(screen.getByText('Czynsz biurowy i media')).toBeInTheDocument();
        expect(screen.getByText('[OFFICE]')).toBeInTheDocument();
        expect(screen.getByText('14.0%')).toBeInTheDocument();

        expect(screen.getByText('Marketing i reklama B2B')).toBeInTheDocument();
        expect(screen.getByText('[MKT]')).toBeInTheDocument();
        expect(screen.getByText('9.0%')).toBeInTheDocument();

        expect(screen.getByText('Oprogramowanie i chmura')).toBeInTheDocument();
        expect(screen.getByText('[CLOUD]')).toBeInTheDocument();
        expect(screen.getByText('8.0%')).toBeInTheDocument();

        expect(screen.getByText('Obsługa prawna i audyt')).toBeInTheDocument();
        expect(screen.getByText('[LEGAL]')).toBeInTheDocument();
        expect(screen.getByText('5.0%')).toBeInTheDocument();

        // Check center total badge (100 000 zł)
        expect(screen.getByText('SUMA KOSZTÓW')).toBeInTheDocument();
        expect(screen.getByText(/100.*000.*zł/)).toBeInTheDocument();

        // Verify none of the items has 100%
        expect(screen.queryByText('100.0%')).not.toBeInTheDocument();
    });

    it("auto-sorts categories descending by amount and renders YoY dynamics badges with polarization", () => {
        const unsortedDataWithYoY = [
            {
                category_id: "cat-cloud",
                category_name: "Oprogramowanie i chmura",
                category_code: "CLOUD",
                amount: 15000,
                percentage: 15.0,
                previous_amount: 10000,
                amount_change: 5000,
                yoy_growth_pct: 50.0, // Cost increased by 50% -> BAD (rose badge with reverseChange: true)
            },
            {
                category_id: "cat-salaries",
                category_name: "Wynagrodzenia i świadczenia",
                category_code: "PAYROLL",
                amount: 60000,
                percentage: 60.0,
                previous_amount: 80000,
                amount_change: -20000,
                yoy_growth_pct: -25.0, // Cost decreased by 25% -> GOOD (emerald badge with reverseChange: true)
            },
            {
                category_id: "cat-office",
                category_name: "Czynsz biurowy",
                category_code: "OFFICE",
                amount: 25000,
                percentage: 25.0,
                previous_amount: null,
                amount_change: null,
                yoy_growth_pct: null, // New category -> fallback "—"
            },
        ];

        render(<CostBreakdownChart data={unsortedDataWithYoY} currency="PLN" reverseChange={true} />);

        // The items in the legend should be sorted descending by amount: PAYROLL (60k), OFFICE (25k), CLOUD (15k)
        const rows = screen.getAllByText(/\[(PAYROLL|OFFICE|CLOUD)\]/).map(el => el.closest("div.flex.items-center.justify-between"));
        expect(rows).toHaveLength(3);
        expect(rows[0]).toHaveTextContent("Wynagrodzenia i świadczenia");
        expect(rows[1]).toHaveTextContent("Czynsz biurowy");
        expect(rows[2]).toHaveTextContent("Oprogramowanie i chmura");

        // Check YoY Dynamics badges
        // PAYROLL decreased costs (-25.0%) -> with reverseChange: true, it should have emerald styling
        const payrollBadge = rows[0].querySelector("[data-testid=\"percentage-badge\"]");
        expect(payrollBadge).toBeInTheDocument();
        expect(payrollBadge).toHaveTextContent("-25.0%");
        expect(payrollBadge.className).toContain("text-emerald-300");
        expect(payrollBadge).toHaveAttribute("title", expect.stringContaining("Poprzednio:"));

        // OFFICE had no comparative data -> fallback "—"
        const officeBadge = rows[1].querySelector("[data-testid=\"percentage-badge-fallback\"]");
        expect(officeBadge).toBeInTheDocument();
        expect(officeBadge).toHaveTextContent("—");

        // CLOUD increased costs (+50.0%) -> with reverseChange: true, it should have rose styling
        const cloudBadge = rows[2].querySelector("[data-testid=\"percentage-badge\"]");
        expect(cloudBadge).toBeInTheDocument();
        expect(cloudBadge).toHaveTextContent("+50.0%");
        expect(cloudBadge.className).toContain("text-rose-300");
        expect(cloudBadge).toHaveAttribute("title", expect.stringContaining("Poprzednio:"));
    });
});
