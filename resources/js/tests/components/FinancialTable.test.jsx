import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FinancialTable } from '../../components/ui/FinancialTable';

const mockTableData = [
    {
        id: 'revenue_group',
        label: 'Przychody ze Sprzedaży',
        code: 'REV-TOT',
        amount: 1000000,
        isGroup: true,
        change: 14.5,
        children: [
            {
                id: 'rev_1',
                label: 'Sprzeda\u017c maszyn',
                code: 'REV-01',
                amount: 750000,
                change: 20.0,
            },
            {
                id: 'rev_2',
                label: 'Usługi SLA',
                code: 'REV-02',
                amount: 250000,
                change: 0.0, // Legitimate zero change
            },
        ],
    },
    {
        id: 'cogs',
        label: 'Koszt Wytworzenia (COGS)',
        code: 'COGS',
        amount: 550000,
        isDeduction: true,
        change: null, // Missing / no comparative data
        reverseChange: true,
    },
    {
        id: 'gross_profit',
        label: 'Zysk Brutto',
        code: 'GP',
        amount: 450000,
        isSummary: true,
        change: -5.2,
    },
    {
        id: 'net_profit',
        label: 'Zysk Netto Okresu',
        code: 'EAT',
        amount: 200000,
        isSummary: true,
        isFinalResult: true,
        change: 12.4,
    },
];

describe('FinancialTable Component', () => {
    it('renders header, title, currency, and table columns', () => {
        render(
            <FinancialTable
                title="Rachunek Wyników Test"
                subtitle="Podtytuł zestawienia"
                data={mockTableData}
                currency="PLN"
                revenueTotal={1000000}
            />
        );

        expect(screen.getByText('Rachunek Wyników Test')).toBeInTheDocument();
        expect(screen.getByText('Podtytuł zestawienia')).toBeInTheDocument();
        expect(screen.getByText('WALUTA: PLN')).toBeInTheDocument();
        expect(screen.getByText('TRYB: KONSOLIDOWANY')).toBeInTheDocument();
        expect(screen.getByText('Pozycja Finansowa / Kategoria')).toBeInTheDocument();
        expect(screen.getByText('Kwota (PLN)')).toBeInTheDocument();
        expect(screen.getByText('% Przych.')).toBeInTheDocument();
        expect(screen.getByText('Dynamika R/R')).toBeInTheDocument();
    });

    it('distinguishes between null change (fallback "—") and legitimate 0.0% change', () => {
        render(
            <FinancialTable
                data={mockTableData}
                currency="PLN"
                revenueTotal={1000000}
            />
        );

        // COGS has change: null -> must render fallback "—"
        const cogsRow = screen.getByText('Koszt Wytworzenia (COGS)').closest('tr');
        expect(cogsRow).toBeInTheDocument();
        expect(cogsRow).toHaveTextContent('—'); // in Dynamika R/R
        expect(cogsRow).not.toHaveTextContent('0.0%');

        // REV-02 child row has change: 0.0 -> must render "0.0%" with minus icon
        const slaRow = screen.getByText('Usługi SLA').closest('tr');
        expect(slaRow).toBeInTheDocument();
        expect(slaRow).toHaveTextContent('0.0%');

        // Revenue row has +14.5%
        const revRow = screen.getByText('Przychody ze Sprzedaży').closest('tr');
        expect(revRow).toHaveTextContent('+14.5%');

        // Gross Profit has -5.2%
        const gpRow = screen.getByText('Zysk Brutto').closest('tr');
        expect(gpRow).toHaveTextContent('-5.2%');
    });

    it('calculates % of revenue accurately for main and child rows', () => {
        render(
            <FinancialTable
                data={mockTableData}
                currency="PLN"
                revenueTotal={1000000}
            />
        );

        // Revenue: 1000000 / 1000000 = 100.0%
        expect(screen.getByText('100.0%')).toBeInTheDocument();
        // COGS: 550000 / 1000000 = 55.0%
        expect(screen.getByText('55.0%')).toBeInTheDocument();
        // GP: 450000 / 1000000 = 45.0%
        expect(screen.getByText('45.0%')).toBeInTheDocument();
        // Child 1: 750000 / 1000000 = 75.0%
        expect(screen.getByText('75.0%')).toBeInTheDocument();
        // Child 2: 250000 / 1000000 = 25.0%
        expect(screen.getByText('25.0%')).toBeInTheDocument();
    });

    it('toggles expandable group rows on click', () => {
        render(
            <FinancialTable
                data={mockTableData}
                currency="PLN"
                revenueTotal={1000000}
            />
        );

        // Children are visible initially because expandedGroups is open
        expect(screen.getByText('Sprzeda\u017c maszyn')).toBeInTheDocument();

        // Click to collapse
        const groupRow = screen.getByText('Przychody ze Sprzedaży').closest('tr');
        fireEvent.click(groupRow);

        // Children should no longer be in the document
        expect(screen.queryByText('Sprzeda\u017c maszyn')).not.toBeInTheDocument();

        // Click again to expand
        fireEvent.click(groupRow);
        expect(screen.getByText('Sprzeda\u017c maszyn')).toBeInTheDocument();
    });

    it('renders category count badges for groups and deduction indicators for cost lines', () => {
        render(
            <FinancialTable
                data={mockTableData}
                currency="PLN"
                revenueTotal={1000000}
            />
        );

        // Group has 2 children -> renders '2 kat.'
        expect(screen.getByText('2 kat.')).toBeInTheDocument();

        // COGS is marked as deduction -> renders '(-)'
        expect(screen.getByText('(-)')).toBeInTheDocument();
    });

    it('renders final net result row with prominent styling and WYNIK KOŃCOWY status', () => {
        render(
            <FinancialTable
                data={mockTableData}
                currency="PLN"
                revenueTotal={1000000}
            />
        );

        const netRow = screen.getByText('Zysk Netto Okresu').closest('tr');
        expect(netRow).toBeInTheDocument();
        expect(netRow).toHaveClass('border-b-4');
        expect(screen.getByText('WYNIK KOŃCOWY')).toBeInTheDocument();
    });
});
