import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { InvestmentDossierPdfGenerator } from '../../components/investments/InvestmentDossierPdfGenerator';
import { InvestmentReadinessScorecard } from '../../components/investments/InvestmentReadinessScorecard';
import { CustomReportBuilder } from '../../components/investments/CustomReportBuilder';
import { InvestmentProjectContext } from '../../context/InvestmentProjectContext';
import { NotificationContext } from '../../context/NotificationContext';
import { AuthContext } from '../../context/AuthContext';

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
        annual_payroll_base: 2200000,
        readiness_scorecard: {
            criteria: []
        }
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
    updateProject: vi.fn().mockResolvedValue({ success: true }),
    loading: false,
};

const mockNotificationValue = {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn()
};

const mockAuthValue = {
    user: { id: 1, name: 'Jan Kowalski', role: 'admin' },
    isAuthenticated: true,
    hasPermission: () => true
};

function renderWithContext(ui) {
    return render(
        <AuthContext.Provider value={mockAuthValue}>
            <NotificationContext.Provider value={mockNotificationValue}>
                <InvestmentProjectContext.Provider value={mockContextValue}>
                    {ui}
                </InvestmentProjectContext.Provider>
            </NotificationContext.Provider>
        </AuthContext.Provider>
    );
}

describe('Investment Scoring & Dossier PDF Tooltips (Phase 56 Commit 285)', () => {
    describe('InvestmentDossierPdfGenerator', () => {
        it('renders accessible tooltips and has zero native title attributes', async () => {
            renderWithContext(
                <InvestmentDossierPdfGenerator
                    project={mockProject}
                    simulationData={mockSimulationData}
                />
            );

            expect(screen.getByTestId('investment-dossier-pdf-generator')).toBeInTheDocument();

            // Zero native title attributes
            const elementsWithTitle = screen.getByTestId('investment-dossier-pdf-generator').querySelectorAll('[title]');
            expect(elementsWithTitle.length).toBe(0);

            // Objaśnienie Dossier PDF InfoTooltip
            expect(screen.getByRole('button', { name: /Objaśnienie Generatora Dossier Inwestycyjnego/i })).toBeInTheDocument();

            // Hover on scale selector button reveals tooltip
            const scaleMlnBtn = screen.getByRole('button', { name: 'mln PLN' });
            fireEvent.mouseEnter(scaleMlnBtn);
            await waitFor(() => {
                expect(screen.getByText(/Prezentuj kwoty w milionach PLN/i)).toBeInTheDocument();
            });

            // Hover on Print PDF button reveals tooltip
            const printBtn = screen.getByRole('button', { name: /Drukuj \/ Pobierz PDF/i });
            fireEvent.mouseEnter(printBtn);
            await waitFor(() => {
                expect(screen.getByText(/Wygeneruj dokument PDF lub otwórz okno drukowania/i)).toBeInTheDocument();
            });
        });

        it('shows tooltips on LMA badge and preview toggle', async () => {
            renderWithContext(
                <InvestmentDossierPdfGenerator
                    project={mockProject}
                    simulationData={mockSimulationData}
                />
            );

            // Preview toggle button
            const previewBtn = screen.getByRole('button', { name: /Zwiń Podgląd/i });
            fireEvent.mouseEnter(previewBtn);
            await waitFor(() => {
                expect(screen.getByText(/Ukryj podgląd dokumentu A4/i)).toBeInTheDocument();
            });
        });
    });

    describe('InvestmentReadinessScorecard', () => {
        it('renders accessible tooltips and InfoTooltips across institutional scorecard', async () => {
            renderWithContext(
                <InvestmentReadinessScorecard
                    project={mockProject}
                    simulationData={mockSimulationData}
                />
            );

            expect(screen.getByTestId('investment-readiness-scorecard')).toBeInTheDocument();

            // InfoTooltip for scorecard
            expect(screen.getByRole('button', { name: /Objaśnienie Scorecardu Gotowości Inwestycyjnej/i })).toBeInTheDocument();

            // InfoTooltip for presets
            expect(screen.getByRole('button', { name: /Objaśnienie presetów/i })).toBeInTheDocument();

            // Score dial tooltip on hover
            const scoreDial = screen.getByTestId('overall-score-dial');
            fireEvent.mouseEnter(scoreDial);
            await waitFor(() => {
                expect(screen.getByText(/Łączna punktacja ważona gotowości inwestycyjnej/i)).toBeInTheDocument();
            });

            // Bankability badge tooltip on hover
            const bankabilityBadge = screen.getByTestId('bankability-badge');
            fireEvent.mouseEnter(bankabilityBadge);
            await waitFor(() => {
                expect(screen.getByText(/Status bankowalności projektu/i)).toBeInTheDocument();
            });
        });

        it('provides tooltips on maturity preset buttons and filter tabs', async () => {
            renderWithContext(
                <InvestmentReadinessScorecard
                    project={mockProject}
                    simulationData={mockSimulationData}
                />
            );

            // Hover on Greenfield preset button (named "Wczesny")
            const wczesnyBtn = screen.getByRole('button', { name: 'Wczesny' });
            fireEvent.mouseEnter(wczesnyBtn);
            await waitFor(() => {
                expect(screen.getByText(/Projekt w fazie wstępnej koncepcji/i)).toBeInTheDocument();
            });

            // Hover on Legal filter
            const legalFilterBtn = screen.getByRole('button', { name: 'Formalno-Prawne (4)' });
            fireEvent.mouseEnter(legalFilterBtn);
            await waitFor(() => {
                expect(screen.getByText(/Filtruj kryteria filaru Formalno-Prawnego/i)).toBeInTheDocument();
            });
        });
    });

    describe('CustomReportBuilder', () => {
        it('renders accessible tooltips, InfoTooltips and controls in custom report builder', async () => {
            renderWithContext(
                <CustomReportBuilder
                    project={mockProject}
                    simulationData={mockSimulationData}
                />
            );

            expect(screen.getByTestId('custom-report-builder')).toBeInTheDocument();

            // Header InfoTooltip
            expect(screen.getByRole('button', { name: /Objaśnienie Kreatora Raportów/i })).toBeInTheDocument();

            // Preset InfoTooltip
            expect(screen.getByRole('button', { name: /Objaśnienie szablonu raportu/i })).toBeInTheDocument();

            // Horizon InfoTooltip
            expect(screen.getByRole('button', { name: /Objaśnienie horyzontu czasowego/i })).toBeInTheDocument();

            // Scale InfoTooltip
            expect(screen.getByRole('button', { name: /Objaśnienie skali kwot/i })).toBeInTheDocument();

            // Hover on Add Metric button
            const addMetricBtn = screen.getByTestId('open-metric-picker-button');
            fireEvent.mouseEnter(addMetricBtn);
            await waitFor(() => {
                expect(screen.getByText(/Otwórz bibliotekę 30\+ instytucjonalnych pozycji finansowych/i)).toBeInTheDocument();
            });

            // Hover on Export CSV button
            const exportCsvBtn = screen.getByTestId('export-csv-button');
            fireEvent.mouseEnter(exportCsvBtn);
            await waitFor(() => {
                expect(screen.getByText(/Eksportuj skomponowany raport wraz z danymi okresów do pliku CSV/i)).toBeInTheDocument();
            });
        });

        it('shows tooltips on horizon and scale buttons', async () => {
            renderWithContext(
                <CustomReportBuilder
                    project={mockProject}
                    simulationData={mockSimulationData}
                />
            );

            const horizon5Btn = screen.getByRole('button', { name: '5L' });
            fireEvent.mouseEnter(horizon5Btn);
            await waitFor(() => {
                expect(screen.getByText(/Ustaw horyzont czasowy raportu na 5 lat/i)).toBeInTheDocument();
            });
        });
    });
});
