import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { InvestmentPlanningView } from '../../views/InvestmentPlanningView';
import { InvestmentProjectProvider } from '../../context/InvestmentProjectContext';
import { NotificationProvider } from '../../context/NotificationContext';
import { AuthContext } from '../../context/AuthContext';
import apiClient from '../../api/client';
import {
    calculate15YearStatements,
    calculateExitValuation,
    calculateBankingCovenants,
    calculateInvestmentReadiness,
    runSimulation
} from '../../workers/financialCalculations';
import { computeDossierSha256 } from '../../components/investments/InvestmentDossierPdfGenerator';

// Mock Recharts ResponsiveContainer to avoid DOM resize observer issues in JSDOM/HappyDOM
vi.mock('recharts', async () => {
    const actual = await vi.importActual('recharts');
    return {
        ...actual,
        ResponsiveContainer: ({ children }) => (
            <div data-testid="mock-responsive-container" style={{ width: 800, height: 300 }}>
                {children}
            </div>
        ),
    };
});

// Mock apiClient
vi.mock('../../api/client', () => ({
    default: {
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
    },
}));

describe('Phase 45 Commit 225: End-to-End (E2E) Investment Planning Lifecycle Test Suite', () => {
    const mockCompany = {
        id: 'comp-energy-1',
        name: 'Baltic Clean Energy SPV S.A.',
        code: 'BALTIC',
        tax_id: '525-28-99-001',
    };

    const mockUser = {
        id: 'user-director-1',
        name: 'dr Tomasz Wiśniewski (Head of Project Finance)',
        email: 'tomasz.wisniewski@balticenergy.pl',
        role: 'director',
    };

    const mockFullProject = {
        id: 'proj-offshore-wind-150',
        name: 'Morska Farma Wiatrowa Bałtyk Północ 150MW',
        description: 'Projekt morskiej energetyki wiatrowej z magazynem energii BESS oraz przyłączem HVDC',
        status: 'approved',
        start_date: '2026-01-01',
        commercial_operation_date: '2027-01-01',
        planning_horizon_years: 15,
        currency: 'PLN',
        budget: {
            total_net_capex: 100000000,
            currency: 'PLN',
        },
        capex_stages: [
            {
                id: 'stage-turbines',
                stage_name: 'Dostawa i montaż fundamentów monopile oraz turbin 15MW',
                net_amount: 60000000,
                start_date: '2026-01-01',
                duration_months: 10,
                kst_code: 'KST_3',
                kst_annual_rate: 7.0,
            },
            {
                id: 'stage-bess',
                stage_name: 'Wielkoskalowy Bateryjny Magazyn Energii (BESS) 50MW/200MWh',
                net_amount: 40000000,
                start_date: '2026-03-01',
                duration_months: 8,
                kst_code: 'KST_6',
                kst_annual_rate: 10.0,
            }
        ],
        financing_structure: {
            investor1_equity: 24000000, // 60% Sponsor
            investor2_equity: 16000000, // 40% Co-investor
            debt_facility_amount: 60000000,
            equity_amount: 40000000,
            senior_debt_amount: 60000000,
            grant_amount: 0,
            currency: 'PLN',
        },
        debt_facility: {
            principal_amount: 60000000,
            base_interest_rate_percent: 5.50, // WIBOR 6M
            margin_percent: 2.25,             // Łącznie 7.75%
            upfront_fee_percent: 1.0,
            tenor_months: 120,                // 10 lat
            grace_period_months: 12,
            repayment_type: 'annuity',
        },
        operating_assumptions: {
            annual_revenue_base: 45000000,
            revenue_growth_rate_percent: 3.5,
            variable_cost_percent: 20.0,
            annual_fixed_costs_base: 4000000,
            fixed_cost_growth_rate_percent: 2.5,
            annual_payroll_base: 4500000,
            payroll_growth_rate_percent: 3.0,
            cit_rate_percent: 19.0,
            tax_loss_carry_forward_enabled: true,
            tax_loss_offset_cap_percent: 50.0,
            dso: 35,
            dpo: 30,
            dio: 15,
            capacity_ramp_up: {
                year1_percent: 80.0,
                year2_percent: 95.0,
                year3_percent: 100.0,
            },
        },
        valuation_multiple: {
            multiple: 8.5,
            multiple_type: 'ev_ebitda',
        },
        wacc_parameters: {
            risk_free_rate_percent: 5.50,
            equity_risk_premium_percent: 6.00,
            levered_beta: 1.15,
            cost_of_equity_percent: 12.40,
            target_debt_ratio_percent: 60.0,
        },
    };

    const renderWithProviders = (ui, { user = mockUser, company = mockCompany } = {}) => {
        return render(
            <AuthContext.Provider value={{ user, activeCompany: company }}>
                <NotificationProvider>
                    <InvestmentProjectProvider>
                        {ui}
                    </InvestmentProjectProvider>
                </NotificationProvider>
            </AuthContext.Provider>
        );
    };

    beforeEach(() => {
        vi.clearAllMocks();
        window.print = vi.fn();
    });

    // =========================================================================
    // 1. FULL END-TO-END WORKFLOW ACROSS ALL 4 TABS
    // =========================================================================
    describe('1. Full End-to-End Workflow Across All 4 Module Stages', () => {
        it('navigates through Assumptions, Sensitivity, Statements, and Dossier tabs seamlessly', async () => {
            apiClient.get.mockResolvedValueOnce({
                data: { status: 'success', data: [mockFullProject] },
            });

            renderWithProviders(<InvestmentPlanningView />);

            // Wait for project data to load
            await waitFor(() => {
                expect(screen.getByText('Morska Farma Wiatrowa Bałtyk Północ 150MW')).toBeInTheDocument();
            });

            // --- TAB 1: ZAŁOŻENIA & CAPEX ---
            expect(screen.getByText('1. Założenia & CAPEX')).toBeInTheDocument();
            expect(screen.getByText('Konfigurator Założeń Projektu Finance')).toBeInTheDocument();

            // Verify Capex Schedule and Financing Structure components are present
            expect(screen.getByText(/Harmonogram Etapów CAPEX/i)).toBeInTheDocument();
            expect(screen.getByText(/Montaż Finansowy & Struktura Długu/i)).toBeInTheDocument();
            expect(screen.getByText(/Założenia Operacyjne & Model P&L/i)).toBeInTheDocument();

            // --- TAB 2: SYMULATOR WHAT-IF ---
            const sensitivityTabBtn = screen.getByText('2. Symulator What-If');
            fireEvent.click(sensitivityTabBtn);

            await waitFor(() => {
                expect(screen.getByText('Cockpit Analizy Wrażliwości & Symulator What-If')).toBeInTheDocument();
            });
            expect(screen.getByText('Nakłady CAPEX')).toBeInTheDocument();
            expect(screen.getByText(/Przychody ze Sprzedaży/i)).toBeInTheDocument();

            // --- TAB 3: MODEL 15-LETNI & WYCENA ---
            const statementsTabBtn = screen.getByText('3. Model 15-letni & Wycena');
            fireEvent.click(statementsTabBtn);

            await waitFor(() => {
                expect(screen.getByTestId('three-statement-grid')).toBeInTheDocument();
            });
            // Verify all 4 Phase 44 components in tab 3
            expect(screen.getByTestId('banking-covenants-strip')).toBeInTheDocument();
            expect(screen.getByTestId('exit-valuation-overlay')).toBeInTheDocument();
            expect(screen.getByTestId('exit-waterfall-visualizer')).toBeInTheDocument();

            // --- TAB 4: SCORING & DOSSIER PDF ---
            const dossierTabBtn = screen.getByText('4. Scoring & Dossier PDF');
            fireEvent.click(dossierTabBtn);

            await waitFor(() => {
                expect(screen.getByTestId('investment-dossier-pdf-generator')).toBeInTheDocument();
            });
            // Verify all 3 Phase 45 components in tab 4
            expect(screen.getByTestId('investment-readiness-scorecard')).toBeInTheDocument();
            expect(screen.getByTestId('custom-report-builder')).toBeInTheDocument();

            // Verify official document preview in Dossier Generator
            expect(screen.getByTestId('dossier-document-preview')).toBeInTheDocument();
            expect(screen.getByText('Certyfikat Integralności Danych (SHA-256 Audit Seal)')).toBeInTheDocument();
        });
    });

    // =========================================================================
    // 2. CROSS-COMPONENT FINANCIAL INTEGRITY & MATHEMATICAL CONSISTENCY
    // =========================================================================
    describe('2. Cross-Component Financial Integrity & Parameter Consistency', () => {
        it('verifies that CAPEX, Senior Debt, and DSCR are mathematically unified across all calculations', () => {
            const simulation = runSimulation(mockFullProject);
            const statements = calculate15YearStatements(mockFullProject);
            const covenants = calculateBankingCovenants(statements.annualPeriods, undefined, 'PLN');
            const readiness = calculateInvestmentReadiness(mockFullProject, simulation);
            const exitVal = calculateExitValuation(statements.annualPeriods, statements.initialEquity, simulation.appraisal.waccPercent, 'PLN');

            // 1. CAPEX consistency
            const totalStageCapex = mockFullProject.capex_stages.reduce((s, c) => s + parseFloat(c.net_amount), 0);
            expect(totalStageCapex).toBe(100000000);
            expect(statements.initialCapex).toBe(100000000);
            expect(simulation.summary.initialCapex).toBe(100000000);

            // 2. Financing consistency (Equity + Debt = CAPEX)
            const sponsorEquity = parseFloat(mockFullProject.financing_structure.investor1_equity);
            const lpEquity = parseFloat(mockFullProject.financing_structure.investor2_equity);
            const totalEquity = sponsorEquity + lpEquity;
            const debtPrincipal = mockFullProject.debt_facility.principal_amount;

            expect(totalEquity + debtPrincipal).toBe(totalStageCapex);
            expect(statements.initialEquity).toBe(totalEquity);

            // 3. Banking covenants DSCR alignment
            expect(covenants.summary.minDscr).toBeGreaterThan(1.0);
            expect(simulation.covenants.summary.minDscr).toBe(covenants.summary.minDscr);

            // 4. Readiness Scorecard integration with model
            expect(readiness.overallScore).toBeGreaterThanOrEqual(60);
            expect(readiness.pillars.financial.earnedPoints).toBeGreaterThan(0);

            // 5. Exit valuation consistency
            expect(exitVal.enterpriseValue).toBeGreaterThan(0);
            expect(exitVal.equityValue).toBe(exitVal.enterpriseValue - exitVal.netDebtAtExit);
            expect(exitVal.equityMoic).toBeGreaterThan(1.0);
        });

        it('verifies 3-statement Zero-Variance balance equality (Assets = Liabilities + Equity) across all 15 years', () => {
            const statements = calculate15YearStatements(mockFullProject);
            expect(statements.annualPeriods).toHaveLength(15);

            let cumNetIncome = 0;
            let cumDepr = 0;
            const initialEquity = statements.initialEquity;
            const initialCapex = statements.initialCapex;

            statements.annualPeriods.forEach((period) => {
                cumNetIncome += period.netIncome;
                cumDepr += period.depreciation;

                const netPpe = Math.max(0, initialCapex - cumDepr);
                const currentAssets = period.closingReceivables + period.closingInventory + period.closingCash;
                const totalAssets = netPpe + currentAssets;

                const totalEquity = initialEquity + cumNetIncome;
                const totalLiabilitiesAndEquity = totalEquity + period.closingDebt + period.closingPayables;

                const delta = Math.abs(totalAssets - totalLiabilitiesAndEquity);
                expect(delta).toBeLessThan(1.0);
            });
        });
    });

    // =========================================================================
    // 3. CRYPTOGRAPHIC INTEGRITY & AUDIT TRAIL VERIFICATION
    // =========================================================================
    describe('3. Cryptographic Integrity & Dossier Export Verification', () => {
        it('computes deterministic SHA-256 seal and detects data alterations', async () => {
            const payload1 = {
                projectId: mockFullProject.id,
                totalCapex: 100000000,
                initialEquity: 40000000,
                tenor: 120,
                minDscr: 1.45,
            };

            const hash1 = await computeDossierSha256(payload1);
            expect(hash1).toHaveLength(64);
            expect(/^[a-f0-9]{64}$/i.test(hash1)).toBe(true);

            // Same payload produces identical hash
            const hash1Repeat = await computeDossierSha256(payload1);
            expect(hash1Repeat).toBe(hash1);

            // Altered payload produces different hash
            const payload2 = { ...payload1, minDscr: 1.25 };
            const hash2 = await computeDossierSha256(payload2);
            expect(hash2).not.toBe(hash1);
        });

        it('triggers print PDF and JSON dossier download in dossier tab', async () => {
            apiClient.get.mockResolvedValueOnce({
                data: { status: 'success', data: [mockFullProject] },
            });

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

            renderWithProviders(<InvestmentPlanningView />);

            await waitFor(() => {
                expect(screen.getByText('Morska Farma Wiatrowa Bałtyk Północ 150MW')).toBeInTheDocument();
            });

            // Navigate to tab 4
            fireEvent.click(screen.getByText('4. Scoring & Dossier PDF'));

            await waitFor(() => {
                expect(screen.getByTestId('investment-dossier-pdf-generator')).toBeInTheDocument();
            });

            // 1. Test Print PDF action
            const printBtn = screen.getByTestId('print-pdf-button');
            fireEvent.click(printBtn);
            expect(window.print).toHaveBeenCalled();

            // 2. Test JSON Dossier export action
            const exportJsonBtn = screen.getByTestId('export-json-dossier-button');
            fireEvent.click(exportJsonBtn);
            expect(anchorClickMock).toHaveBeenCalled();

            vi.restoreAllMocks();
        });
    });

    // =========================================================================
    // 4. BOUNDARY & STRESS TESTING SCENARIOS
    // =========================================================================
    describe('4. Boundary Stress Testing & Credit Committee Scenarios', () => {
        it('detects covenant breach and warning status when project is stressed with higher debt and lower revenues', () => {
            const stressedProject = {
                ...mockFullProject,
                debt_facility: {
                    ...mockFullProject.debt_facility,
                    principal_amount: 85000000, // 85% debt leverage
                    margin_percent: 4.5,
                },
                operating_assumptions: {
                    ...mockFullProject.operating_assumptions,
                    annual_revenue_base: 30000000, // -40% revenue shock
                    variable_cost_percent: 28.0,
                }
            };

            const statements = calculate15YearStatements(stressedProject);
            const covenants = calculateBankingCovenants(statements.annualPeriods, undefined, 'PLN');
            const readiness = calculateInvestmentReadiness(stressedProject);

            // DSCR should drop significantly
            expect(covenants.summary.minDscr).toBeLessThan(1.20);
            expect(covenants.summary.isBankable).toBe(false);

            // Readiness scorecard should detect covenant pressure
            expect(readiness.bankabilityStatus).not.toBe('compliant');
        });

        it('handles construction ramp-up where Year 1 has partial capacity and debt grace period', () => {
            const rampUpProject = {
                ...mockFullProject,
                operating_assumptions: {
                    ...mockFullProject.operating_assumptions,
                    capacity_ramp_up: {
                        year1_percent: 50.0,
                        year2_percent: 85.0,
                        year3_percent: 100.0,
                    }
                }
            };

            const statements = calculate15YearStatements(rampUpProject);
            expect(statements.annualPeriods[0].revenue).toBeLessThan(statements.annualPeriods[1].revenue);
            expect(statements.annualPeriods[1].revenue).toBeLessThan(statements.annualPeriods[2].revenue);

            // Debt principal repaid in Year 1 should be 0 due to 12-month grace period
            const year1Principal = statements.annualPeriods[0].debtPrincipalRepaid || 0;
            expect(year1Principal).toBe(0);
        });
    });
});
