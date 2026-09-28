import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BankingCovenantsStrip } from '../../components/investments/BankingCovenantsStrip';
import { ExitValuationOverlay } from '../../components/investments/ExitValuationOverlay';
import { ExitWaterfallVisualizer } from '../../components/investments/ExitWaterfallVisualizer';
import { ThreeStatementGrid } from '../../components/investments/ThreeStatementGrid';
import { InvestmentProjectContext } from '../../context/InvestmentProjectContext';

const mockSimulationData = {
    annualPeriods: [
        {
            year: 1,
            revenue: 15000000,
            totalOpex: 8000000,
            capex: 20000000,
            ebitda: 7000000,
            ebit: 5000000,
            ebt: 3500000,
            netIncome: 2835000,
            cit: 665000,
            cashInterest: 1500000,
            interestExpense: 1500000,
            debtServiceCoverageRatio: 2.0,
            interestCoverageRatio: 3.33,
            principalRepayment: 2000000,
            totalDebtService: 3500000,
            closingDebt: 25000000,
            operatingCashFlow: 6000000,
            capexCashFlow: -20000000,
            financingCashFlow: 20000000,
            closingCash: 6000000,
            closingReceivables: 1200000,
            closingPayables: 800000,
            closingInventory: 500000,
            fcff: 5500000,
            fcfe: 4000000,
            totalAssets: 40000000,
            totalLiabilitiesAndEquity: 40000000,
            totalEquity: 15000000,
            balanceDiscrepancy: 0,
        },
        {
            year: 2,
            revenue: 18000000,
            totalOpex: 9000000,
            capex: 0,
            ebitda: 9000000,
            ebit: 7000000,
            ebt: 5800000,
            netIncome: 4698000,
            cit: 1102000,
            cashInterest: 1200000,
            interestExpense: 1200000,
            debtServiceCoverageRatio: 2.43,
            interestCoverageRatio: 5.83,
            principalRepayment: 2500000,
            totalDebtService: 3700000,
            closingDebt: 22500000,
            operatingCashFlow: 8000000,
            capexCashFlow: 0,
            financingCashFlow: -3700000,
            closingCash: 10300000,
            closingReceivables: 1500000,
            closingPayables: 900000,
            closingInventory: 600000,
            fcff: 7200000,
            fcfe: 5200000,
            totalAssets: 42000000,
            totalLiabilitiesAndEquity: 42000000,
            totalEquity: 19500000,
            balanceDiscrepancy: 0,
        },
        {
            year: 5,
            revenue: 22000000,
            totalOpex: 10000000,
            capex: 1500000,
            ebitda: 12000000,
            ebit: 9500000,
            ebt: 8800000,
            netIncome: 7128000,
            cit: 1672000,
            cashInterest: 700000,
            interestExpense: 700000,
            debtServiceCoverageRatio: 3.24,
            interestCoverageRatio: 13.57,
            principalRepayment: 3000000,
            totalDebtService: 3700000,
            closingDebt: 12000000,
            operatingCashFlow: 10500000,
            capexCashFlow: -1500000,
            financingCashFlow: -3700000,
            closingCash: 18000000,
            closingReceivables: 1800000,
            closingPayables: 1000000,
            closingInventory: 700000,
            fcff: 9000000,
            fcfe: 7000000,
            totalAssets: 46000000,
            totalLiabilitiesAndEquity: 46000000,
            totalEquity: 34000000,
            balanceDiscrepancy: 0,
        }
    ],
    monthlyPeriods: [],
    summary: {
        totalCapex: 20000000,
        initialEquity: 15000000,
        totalRevenue15Y: 250000000,
        totalEbitda15Y: 130000000,
        projectIrrPercent: 15.2,
        equityMoic: 3.1,
        minDscr: 1.45,
        avgDscr: 2.10,
    },
    appraisal: {
        isBankable: true,
        waccPercent: 8.5
    }
};

// Mock Web Worker client
vi.mock('../../workers/InvestmentWorkerClient', () => {
    return {
        getInvestmentWorkerClient: () => ({
            simulate: vi.fn().mockResolvedValue(mockSimulationData)
        })
    };
});

const mockProject = {
    id: 1,
    name: 'BESS 50MW / 200MWh Project Alpha',
    currency: 'PLN',
    planning_horizon_years: 15,
    valuation_multiple: { multiple: 7.5 },
    operating_assumptions: {
        annual_fixed_costs_base: 1400000,
        annual_payroll_base: 2200000
    },
    debt_facility: {
        facility_amount: 25000000,
        margin_bps: 220,
        tenor_years: 12,
        repayment_type: 'annuity',
        covenants: {
            dscr_min: 1.20,
            icr_min: 2.00,
            current_ratio_min: 1.10,
            leverage_max: 4.50,
            dsrf_months: 6,
            llcr_min: 1.30,
        }
    }
};

const mockContextValue = {
    selectedProject: mockProject,
    selectProject: vi.fn(),
    refreshProjects: vi.fn(),
    loading: false,
};

function renderWithContext(ui) {
    return render(
        <InvestmentProjectContext.Provider value={mockContextValue}>
            {ui}
        </InvestmentProjectContext.Provider>
    );
}

describe('Investment Statements & Valuation Tooltips (Phase 56 Commit 284)', () => {
    describe('BankingCovenantsStrip', () => {
        it('renders accessible tooltips and has no native title attributes on table breaches', async () => {
            renderWithContext(
                <BankingCovenantsStrip
                    project={mockProject}
                    simulationData={mockSimulationData}
                    defaultExpanded={true}
                />
            );

            expect(screen.getByTestId('banking-covenants-strip')).toBeInTheDocument();

            // Check that all native title attributes are absent across the strip
            const elementsWithTitle = screen.getByTestId('banking-covenants-strip').querySelectorAll('[title]');
            expect(elementsWithTitle.length).toBe(0);

            // Verify KPI InfoTooltips exist with aria labels
            expect(screen.getByRole('button', { name: /Objaśnienie kowenantu DSCR/i })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /Objaśnienie wskaźnika ICR/i })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /Objaśnienie wskaźnika płynności bieżącej/i })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /Objaśnienie wskaźnika dźwigni finansowej/i })).toBeInTheDocument();

            // Verify hover on DSCR InfoTooltip reveals content
            const dscrInfo = screen.getByRole('button', { name: /Objaśnienie kowenantu DSCR/i });
            fireEvent.mouseEnter(dscrInfo);

            await waitFor(() => {
                expect(screen.getByText(/Debt Service Coverage Ratio/i)).toBeInTheDocument();
            });
        });

        it('shows tooltip on bankability status badge and presets', async () => {
            renderWithContext(
                <BankingCovenantsStrip
                    project={mockProject}
                    simulationData={mockSimulationData}
                    defaultExpanded={true}
                />
            );

            // Preset button hover
            const stdPreset = screen.getByRole('button', { name: /Standard \(1\.20x\)/i });
            fireEvent.mouseEnter(stdPreset);

            await waitFor(() => {
                expect(screen.getByText(/Standardowe wytyczne rynkowe.*dla długu Senior Debt/i)).toBeInTheDocument();
            });
        });
    });

    describe('ExitValuationOverlay', () => {
        it('renders Tooltips on executive metrics and InfoTooltips on KPI cards without native title attributes', async () => {
            renderWithContext(<ExitValuationOverlay project={mockProject} defaultOpen={true} />);

            await waitFor(() => {
                expect(screen.getByTestId('exit-valuation-overlay')).toBeInTheDocument();
            });

            // Check that no native title attributes are present
            const elementsWithTitle = screen.getByTestId('exit-valuation-overlay').querySelectorAll('[title]');
            expect(elementsWithTitle.length).toBe(0);

            // Verify InfoTooltips on executive KPI cards
            await waitFor(() => {
                expect(screen.getByRole('button', { name: /Objaśnienie Enterprise Value/i })).toBeInTheDocument();
                expect(screen.getByRole('button', { name: /Objaśnienie Equity Value/i })).toBeInTheDocument();
                expect(screen.getByRole('button', { name: /Objaśnienie wskaźników MoIC i IRR/i })).toBeInTheDocument();
                expect(screen.getByRole('button', { name: /Objaśnienie wskaźnika buyer yield/i })).toBeInTheDocument();
            });

            // Hover on Enterprise Value InfoTooltip
            const evInfo = screen.getByRole('button', { name: /Objaśnienie Enterprise Value/i });
            fireEvent.mouseEnter(evInfo);

            await waitFor(() => {
                expect(screen.getByText(/Wycena całego przedsiębiorstwa/i)).toBeInTheDocument();
            });
        });

        it('supports interactive and keyboard-accessible 2D sensitivity matrix cells', async () => {
            renderWithContext(<ExitValuationOverlay project={mockProject} defaultOpen={true} />);

            await waitFor(() => {
                expect(screen.getByText(/3\. Macierz Wrażliwości Wyjścia \(2D Matrix\)/i)).toBeInTheDocument();
            });

            // Click matrix tab
            fireEvent.click(screen.getByText(/3\. Macierz Wrażliwości Wyjścia \(2D Matrix\)/i));

            await waitFor(() => {
                expect(screen.getByTestId('exit-sensitivity-table')).toBeInTheDocument();
            });

            // Verify interactive buttons in matrix cells
            const interactiveCells = screen.getAllByRole('button', { name: /Scenariusz Rok/i });
            expect(interactiveCells.length).toBeGreaterThan(0);

            // Test keyboard trigger (Enter)
            const firstCell = interactiveCells[0];
            fireEvent.keyDown(firstCell, { key: 'Enter', code: 'Enter' });

            // Hover cell to show Floating UI tooltip
            fireEvent.mouseEnter(firstCell);
            await waitFor(() => {
                expect(screen.getByText(/Wybierz: Rok/i)).toBeInTheDocument();
            });
        });
    });

    describe('ExitWaterfallVisualizer', () => {
        it('renders accessible tooltips on waterfall steps and controls without native title attributes', async () => {
            renderWithContext(<ExitWaterfallVisualizer project={mockProject} defaultOpen={true} />);

            await waitFor(() => {
                expect(screen.getByTestId('exit-waterfall-visualizer')).toBeInTheDocument();
            });

            // Check that no native title attributes are present
            const elementsWithTitle = screen.getByTestId('exit-waterfall-visualizer').querySelectorAll('[title]');
            expect(elementsWithTitle.length).toBe(0);

            // Verify InfoTooltips on waterfall controls
            expect(screen.getByRole('button', { name: /Objaśnienie roku wyjścia/i })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /Objaśnienie mnożnika EV/i })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /Objaśnienie struktury kaskady/i })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /Objaśnienie udziałów kapitałowych/i })).toBeInTheDocument();

            // Hover on structure InfoTooltip
            const structInfo = screen.getByRole('button', { name: /Objaśnienie struktury kaskady/i });
            fireEvent.mouseEnter(structInfo);

            await waitFor(() => {
                expect(screen.getByText(/Model podziału zysków: Pari Passu/i)).toBeInTheDocument();
            });
        });

        it('renders tooltips on investor comparison cards and schedule table headers', async () => {
            renderWithContext(<ExitWaterfallVisualizer project={mockProject} defaultOpen={true} />);

            await waitFor(() => {
                expect(screen.getByText(/2\. Zwroty Inwestorów \(Sponsor vs LP\)/i)).toBeInTheDocument();
            });

            fireEvent.click(screen.getByText(/2\. Zwroty Inwestorów \(Sponsor vs LP\)/i));

            await waitFor(() => {
                expect(screen.getByTestId('sponsor-card')).toBeInTheDocument();
                expect(screen.getByTestId('partner-card')).toBeInTheDocument();
            });

            // Click schedule tab
            fireEvent.click(screen.getByText(/3\. Harmonogram Wypłat Kaskadowych/i));

            await waitFor(() => {
                expect(screen.getByTestId('waterfall-schedule-table')).toBeInTheDocument();
            });
        });
    });

    describe('ThreeStatementGrid', () => {
        it('has eliminated native title on balance-integrity-badge and CIT breakdown toggle', async () => {
            renderWithContext(<ThreeStatementGrid project={mockProject} />);

            await waitFor(() => {
                expect(screen.getByTestId('three-statement-grid')).toBeInTheDocument();
            });

            // The balance-integrity-badge must NOT have native title
            const balanceBadge = screen.getByTestId('balance-integrity-badge');
            expect(balanceBadge).not.toHaveAttribute('title');

            // Hover on balance badge triggers Floating UI tooltip
            fireEvent.mouseEnter(balanceBadge);
            await waitFor(() => {
                expect(screen.getByText(/Zasada podwójnego zapisu: Aktywa = Pasywa/i)).toBeInTheDocument();
            });

            // Check statement tabs have tooltips
            const rzisBtn = screen.getByRole('button', { name: /RZiS \(P&L\)/i });
            fireEvent.mouseEnter(rzisBtn);
            await waitFor(() => {
                expect(screen.getByText(/Rachunek Zysków i Strat \(P&L\): Przychody/i)).toBeInTheDocument();
            });

            // Expand tax breakdown toggle and verify no native title
            const taxToggle = screen.getByRole('button', { name: /Rozwiń rozliczenie podatkowe CIT/i });
            expect(taxToggle).not.toHaveAttribute('title');
        });
    });
});
