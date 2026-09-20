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
                label: 'Sprzedaż maszyn',
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
        expect(screen.getByText('Sprzedaż maszyn')).toBeInTheDocument();

        // Click to collapse
        const groupRow = screen.getByText('Przychody ze Sprzedaży').closest('tr');
        fireEvent.click(groupRow);

        // Children should no longer be in the document
        expect(screen.queryByText('Sprzedaż maszyn')).not.toBeInTheDocument();

        // Click again to expand
        fireEvent.click(groupRow);
        expect(screen.getByText('Sprzedaż maszyn')).toBeInTheDocument();
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

    it('handles single category vs multi-category groups gracefully without broken collapse', () => {
        const singleCategoryData = [
            {
                id: 'single_group',
                label: 'Pojedyncza Kategoria Wynikowa',
                code: 'SINGLE-01',
                amount: 300000,
                isGroup: true,
                change: 5.0,
                children: [
                    {
                        id: 'sub_1',
                        label: 'Jedyny Podtyp',
                        code: 'SUB-01',
                        amount: 300000,
                        change: 5.0,
                    },
                ],
            },
            {
                id: 'empty_group',
                label: 'Grupa Bez Podkategorii',
                code: 'EMPTY-01',
                amount: 150000,
                isGroup: true,
                change: null,
                children: [],
            },
        ];

        render(
            <FinancialTable
                data={singleCategoryData}
                currency="PLN"
                revenueTotal={300000}
            />
        );

        // Single child is displayed with '1 poz.'
        expect(screen.getByText('1 poz.')).toBeInTheDocument();
        expect(screen.getByText('Jedyny Podtyp')).toBeInTheDocument();

        // Empty group does not display count badge and is not expandable
        expect(screen.getByText('Grupa Bez Podkategorii')).toBeInTheDocument();
        expect(screen.queryByText('0 kat.')).not.toBeInTheDocument();
        expect(screen.queryByText('0 poz.')).not.toBeInTheDocument();
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

    it("strictly applies reverseChange polarization for OPEX expenses vs revenue sub-rows", () => {
        const polarizationData = [
            {
                id: "rev_group",
                label: "Przychody ze Sprzedaży",
                code: "REV-TOT",
                amount: 1000000,
                isGroup: true,
                change: 15.0,
                reverseChange: false,
                children: [
                    {
                        id: "rev_child_up",
                        label: "Sprzedaż Produktów (+)",
                        code: "REV-01",
                        amount: 600000,
                        change: 25.0, // Revenue increase -> GOOD (emerald)
                        reverseChange: false,
                    },
                    {
                        id: "rev_child_down",
                        label: "Sprzedaż Usług (-)",
                        code: "REV-02",
                        amount: 400000,
                        change: -10.0, // Revenue decrease -> BAD (rose)
                        reverseChange: false,
                    },
                ],
            },
            {
                id: "opex_group",
                label: "Koszty Operacyjne (OPEX)",
                code: "OPEX-TOT",
                amount: 500000,
                isGroup: true,
                change: 10.0, // Expense increase -> BAD (rose)
                reverseChange: true,
                children: [
                    {
                        id: "opex_child_up",
                        label: "Koszty Wynagrodzeń (+)",
                        code: "OPEX-01",
                        amount: 300000,
                        change: 18.0, // Cost increase with reverseChange -> BAD (rose)
                        reverseChange: true,
                    },
                    {
                        id: "opex_child_down",
                        label: "Usługi Obce (-)",
                        code: "OPEX-02",
                        amount: 200000,
                        change: -5.0, // Cost decrease with reverseChange -> GOOD (emerald)
                        reverseChange: true,
                    },
                ],
            },
        ];

        render(
            <FinancialTable
                data={polarizationData}
                currency="PLN"
                revenueTotal={1000000}
            />
        );

        // Revenue sub-row with +25.0% change should have emerald styling (good)
        const revChildUp = screen.getByText("Sprzedaż Produktów (+)").closest("tr");
        const revUpBadge = revChildUp.querySelector("[data-testid=\"percentage-badge\"]");
        expect(revUpBadge).toBeInTheDocument();
        expect(revUpBadge).toHaveTextContent("+25.0%");
        expect(revUpBadge.className).toContain("text-emerald-300");

        // Revenue sub-row with -10.0% change should have rose styling (bad)
        const revChildDown = screen.getByText("Sprzedaż Usług (-)").closest("tr");
        const revDownBadge = revChildDown.querySelector("[data-testid=\"percentage-badge\"]");
        expect(revDownBadge).toBeInTheDocument();
        expect(revDownBadge).toHaveTextContent("-10.0%");
        expect(revDownBadge.className).toContain("text-rose-300");

        // OPEX parent row with +10.0% change with reverseChange: true should have rose styling (bad)
        const opexGroupRow = screen.getByText("Koszty Operacyjne (OPEX)").closest("tr");
        const opexGroupBadge = opexGroupRow.querySelector("[data-testid=\"percentage-badge\"]");
        expect(opexGroupBadge).toBeInTheDocument();
        expect(opexGroupBadge).toHaveTextContent("+10.0%");
        expect(opexGroupBadge.className).toContain("text-rose-300");

        // OPEX sub-row with +18.0% change with reverseChange: true should have rose styling (bad)
        const opexChildUp = screen.getByText("Koszty Wynagrodzeń (+)").closest("tr");
        const opexUpBadge = opexChildUp.querySelector("[data-testid=\"percentage-badge\"]");
        expect(opexUpBadge).toBeInTheDocument();
        expect(opexUpBadge).toHaveTextContent("+18.0%");
        expect(opexUpBadge.className).toContain("text-rose-300");

        // OPEX sub-row with -5.0% change with reverseChange: true should have emerald styling (good)
        const opexChildDown = screen.getByText("Usługi Obce (-)").closest("tr");
        const opexDownBadge = opexChildDown.querySelector("[data-testid=\"percentage-badge\"]");
        expect(opexDownBadge).toBeInTheDocument();
        expect(opexDownBadge).toHaveTextContent("-5.0%");
        expect(opexDownBadge.className).toContain("text-emerald-300");
    });
});
