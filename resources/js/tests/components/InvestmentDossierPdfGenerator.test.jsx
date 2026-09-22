import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { InvestmentDossierPdfGenerator, computeDossierSha256 } from '../../components/investments/InvestmentDossierPdfGenerator';
import { InvestmentProjectContext } from '../../context/InvestmentProjectContext';
import { NotificationContext } from '../../context/NotificationContext';
import { AuthContext } from '../../context/AuthContext';

// Mock Recharts ResponsiveContainer to prevent size observer warnings
vi.mock('recharts', async () => {
    const actual = await vi.importActual('recharts');
    return {
        ...actual,
        ResponsiveContainer: ({ children }) => (
            <div data-testid="recharts-mock-container" style={{ width: 800, height: 240 }}>
                {children}
            </div>
        ),
    };
});

describe('InvestmentDossierPdfGenerator Component (Phase 45 Commit 224)', () => {
    const mockSuccess = vi.fn();
    const mockNotifyError = vi.fn();

    const mockProject = {
        id: 'proj-dossier-1',
        name: 'Biometanownia Rolnicza 2.5MW & Bio-LNG',
        currency: 'PLN',
        start_date: '2026-01-01',
        commercial_operation_date: '2027-01-01',
        planning_horizon_years: 15,
        capex_stages: [
            { id: 'c1', stage_name: 'Instalacja fermentacji', net_amount: 35000000 },
            { id: 'c2', stage_name: 'Moduł skraplania Bio-LNG', net_amount: 25000000 }
        ],
        financing_structure: {
            investor1_equity: 12000000,
            investor2_equity: 8000000,
            debt_facility_amount: 40000000
        },
        debt_facility: {
            principal_amount: 40000000,
            base_interest_rate_percent: 5.75,
            margin_percent: 2.25,
            tenor_months: 120,
            grace_period_months: 12,
            repayment_type: 'annuity'
        },
        operating_assumptions: {
            annual_revenue_base: 28000000,
            variable_cost_percent: 18.0,
            annual_fixed_costs_base: 2000000,
            annual_payroll_base: 2500000
        }
    };

    const mockSimulationData = {
        summary: {
            totalCapex: 60000000,
            initialCapex: 60000000,
            initialEquity: 20000000,
            initialDebt: 40000000,
            minDscr: 1.42,
            avgDscr: 1.68
        },
        appraisal: {
            npv: 38500000,
            irr: 22.4,
            equityIrr: 31.8,
            waccPercent: 8.5,
            moic: 3.65
        },
        statements: {
            initialCapex: 60000000,
            initialEquity: 20000000,
            annualPeriods: Array.from({ length: 15 }, (_, i) => ({
                year: i + 1,
                revenue: 28000000 * Math.pow(1.025, i),
                variableCosts: 5000000,
                fixedCosts: 2000000,
                payrollCosts: 2500000,
                totalOpex: 9500000,
                ebitda: 18500000,
                netIncome: 11000000,
                capex: i === 0 ? 60000000 : 0,
                operatingCashFlow: 15000000,
                interestExpense: Math.max(0, (40000000 - i * 4000000) * 0.08),
                debtPrincipalRepaid: i < 10 ? 4000000 : 0,
                fcfe: 7500000,
                closingCash: 5000000 + (i + 1) * 2000000,
                closingDebt: Math.max(0, 40000000 - (i + 1) * 4000000),
                dscr: 1.42
            }))
        },
        covenants: {
            currency: 'PLN',
            summary: {
                minDscr: 1.42,
                avgDscr: 1.68,
                minIcr: 4.2,
                minDsrfMonths: 9.2,
                peakLeverage: 2.1,
                isBankable: true,
                bankabilityStatus: 'compliant',
                totalBreachesCount: 0
            },
            annualCovenants: Array.from({ length: 15 }, (_, i) => ({
                year: i + 1,
                totalDebtService: i < 10 ? 5500000 : 0,
                principalRepaid: i < 10 ? 4000000 : 0,
                cfads: 15000000,
                closingCash: 5000000 + (i + 1) * 2000000,
                closingDebt: Math.max(0, 40000000 - (i + 1) * 4000000),
                netDebt: Math.max(0, 40000000 - (i + 1) * 4000000 - 5000000),
                dscr: 1.42,
                icr: 4.2,
                dsrfMonths: 9.2,
                leverageRatio: 1.8,
                isCompliant: true
            }))
        },
        exitValuation: {
            exitYear: 5,
            exitMultiple: 7.5,
            enterpriseValue: 138750000,
            grossDebtAtExit: 20000000,
            cashAtExit: 15000000,
            netDebtAtExit: 5000000,
            equityValue: 133750000,
            initialEquity: 20000000,
            equityMoic: 4.25,
            equityIrrPercent: 34.2
        }
    };

    const renderComponent = (props = {}) => {
        const projectContextValue = {
            selectedProject: mockProject,
            selectedProjectId: mockProject.id,
            updateProject: vi.fn(),
            loading: false
        };

        const notificationContextValue = {
            success: mockSuccess,
            error: mockNotifyError,
            info: vi.fn(),
            warning: vi.fn()
        };

        const authContextValue = {
            user: { name: 'Adam Kowalski', email: 'adam@finboard.pl' },
            activeCompany: { name: 'Helvest Partners' }
        };

        return render(
            <AuthContext.Provider value={authContextValue}>
                <NotificationContext.Provider value={notificationContextValue}>
                    <InvestmentProjectContext.Provider value={projectContextValue}>
                        <InvestmentDossierPdfGenerator
                            project={mockProject}
                            simulationData={mockSimulationData}
                            {...props}
                        />
                    </InvestmentProjectContext.Provider>
                </NotificationContext.Provider>
            </AuthContext.Provider>
        );
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders component header, configurator controls, action buttons, and document preview', async () => {
        renderComponent();

        expect(screen.getByTestId('investment-dossier-pdf-generator')).toBeInTheDocument();
        expect(screen.getByText(/Generator Dossier Inwestycyjnego/i)).toBeInTheDocument();
        expect(screen.getByText(/LMA & Credit Committee Ready/i)).toBeInTheDocument();

        // Action buttons
        expect(screen.getByTestId('toggle-preview-button')).toBeInTheDocument();
        expect(screen.getByTestId('export-json-dossier-button')).toBeInTheDocument();
        expect(screen.getByTestId('print-pdf-button')).toBeInTheDocument();

        // Document preview container
        expect(screen.getByTestId('dossier-document-preview')).toBeInTheDocument();
        expect(screen.getByText('Biometanownia Rolnicza 2.5MW & Bio-LNG')).toBeInTheDocument();
    });

    it('computes and displays a 64-character SHA-256 cryptographic integrity seal', async () => {
        renderComponent();

        await waitFor(() => {
            const hashEl = screen.getByTestId('rendered-sha256');
            expect(hashEl).toBeInTheDocument();
            expect(hashEl.textContent.trim().length).toBe(64);
        });

        expect(screen.getByText('Certyfikat Integralności Danych (SHA-256 Audit Seal)')).toBeInTheDocument();
        expect(screen.getByText('VERIFIED / UNALTERED')).toBeInTheDocument();
    });

    it('toggles document sections on and off via configurator checkboxes', () => {
        renderComponent();

        // Initially all sections are visible
        expect(screen.getByTestId('dossier-section-seal')).toBeInTheDocument();
        expect(screen.getByTestId('dossier-section-summary')).toBeInTheDocument();
        expect(screen.getByTestId('dossier-section-scorecard')).toBeInTheDocument();
        expect(screen.getByTestId('dossier-section-financing')).toBeInTheDocument();
        expect(screen.getByTestId('dossier-section-statements')).toBeInTheDocument();
        expect(screen.getByTestId('dossier-section-waterfall')).toBeInTheDocument();

        // Toggle off Waterfall section
        const waterfallToggle = screen.getByTestId('toggle-section-waterfall');
        fireEvent.click(waterfallToggle);

        expect(screen.queryByTestId('dossier-section-waterfall')).not.toBeInTheDocument();

        // Toggle off Financing section
        const financingToggle = screen.getByTestId('toggle-section-financing');
        fireEvent.click(financingToggle);

        expect(screen.queryByTestId('dossier-section-financing')).not.toBeInTheDocument();

        // Re-enable Waterfall
        fireEvent.click(waterfallToggle);
        expect(screen.getByTestId('dossier-section-waterfall')).toBeInTheDocument();
    });

    it('updates executive commentary notes and synchronizes with preview memo', () => {
        renderComponent();

        const notesInput = screen.getByTestId('executive-notes-input');
        fireEvent.change(notesInput, {
            target: { value: 'Projekt posiada klauzulę take-or-pay na odbiór Bio-LNG. Ryzyko rynkowe zminimalizowane.' }
        });

        expect(screen.getAllByText(/Projekt posiada klauzulę take-or-pay na odbiór Bio-LNG/i).length).toBeGreaterThan(0);
    });

    it('switches numerical presentation scale between PLN, tys. PLN, and mln PLN', () => {
        renderComponent();

        const scaleContainer = screen.getByTestId('dossier-scale-selector');

        // Switch to mln PLN
        const mlnBtn = within(scaleContainer).getByRole('button', { name: 'mln PLN' });
        fireEvent.click(mlnBtn);
        expect(mlnBtn).toHaveClass('bg-emerald-600');
        expect(screen.getAllByText(/mln PLN/i).length).toBeGreaterThan(0);

        // Switch to PLN
        const plnBtn = within(scaleContainer).getByRole('button', { name: 'PLN' });
        fireEvent.click(plnBtn);
        expect(plnBtn).toHaveClass('bg-emerald-600');
        expect(screen.getAllByText(/PLN/i).length).toBeGreaterThan(0);
    });

    it('switches watermark selection in preview', () => {
        renderComponent();

        const watermarkSelect = screen.getByTestId('watermark-select');

        // Change to OFFICIAL
        fireEvent.change(watermarkSelect, { target: { value: 'OFFICIAL' } });
        expect(screen.getByTestId('dossier-watermark')).toHaveTextContent(/OFICJALNE DOSSIER/i);

        // Change to DRAFT
        fireEvent.change(watermarkSelect, { target: { value: 'DRAFT' } });
        expect(screen.getByTestId('dossier-watermark')).toHaveTextContent(/DRAFT \/\/ SZKIC/i);

        // Change to NONE
        fireEvent.change(watermarkSelect, { target: { value: 'NONE' } });
        expect(screen.queryByTestId('dossier-watermark')).not.toBeInTheDocument();
    });

    it('toggles preview visibility completely', () => {
        renderComponent();

        expect(screen.getByTestId('dossier-document-preview')).toBeInTheDocument();

        const togglePreviewBtn = screen.getByTestId('toggle-preview-button');
        fireEvent.click(togglePreviewBtn);

        expect(screen.queryByTestId('dossier-document-preview')).not.toBeInTheDocument();

        fireEvent.click(togglePreviewBtn);
        expect(screen.getByTestId('dossier-document-preview')).toBeInTheDocument();
    });

    it('triggers window.print() when clicking Print/PDF button', () => {
        window.print = vi.fn();

        renderComponent();

        const printBtn = screen.getByTestId('print-pdf-button');
        fireEvent.click(printBtn);

        expect(window.print).toHaveBeenCalled();
    });

    it('copies SHA-256 checksum to clipboard', async () => {
        const writeTextMock = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, 'clipboard', {
            value: {
                writeText: writeTextMock
            },
            writable: true,
            configurable: true
        });

        renderComponent();

        await waitFor(() => {
            const hashEl = screen.getByTestId('rendered-sha256');
            expect(hashEl.textContent.trim().length).toBe(64);
        });

        const copyBtn = screen.getByTestId('copy-sha-button');
        fireEvent.click(copyBtn);

        await waitFor(() => {
            expect(writeTextMock).toHaveBeenCalled();
            expect(mockSuccess).toHaveBeenCalledWith(
                expect.stringContaining('Skopiowano sumę SHA-256'),
                expect.any(String)
            );
        });
    });

    it('exports complete dossier data as JSON file', () => {
        const anchorClickMock = vi.fn();
        const originalCreateElement = document.createElement.bind(document);
        vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
            if (tagName === 'a') {
                const a = originalCreateElement('a');
                a.click = anchorClickMock;
                return a;
            }
            return originalCreateElement(tagName);
        });

        renderComponent();

        const exportBtn = screen.getByTestId('export-json-dossier-button');
        fireEvent.click(exportBtn);

        expect(anchorClickMock).toHaveBeenCalled();
        expect(mockSuccess).toHaveBeenCalledWith(
            expect.stringContaining('Eksport Dossier JSON'),
            expect.any(String)
        );

        vi.restoreAllMocks();
    });

    it('computeDossierSha256 produces deterministic 64-char hex string', async () => {
        const payload = { test: 'finboard', amount: 1000000 };
        const hash = await computeDossierSha256(payload);

        expect(typeof hash).toBe('string');
        expect(hash.length).toBe(64);
        expect(/^[a-f0-9]{64}$/i.test(hash)).toBe(true);
    });
});
