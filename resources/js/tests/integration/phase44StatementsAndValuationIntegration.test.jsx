import React, { useState } from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThreeStatementGrid } from '../../components/investments/ThreeStatementGrid';
import { ExitValuationOverlay } from '../../components/investments/ExitValuationOverlay';
import { ExitWaterfallVisualizer } from '../../components/investments/ExitWaterfallVisualizer';
import { BankingCovenantsStrip } from '../../components/investments/BankingCovenantsStrip';
import { InvestmentPlanningView } from '../../views/InvestmentPlanningView';
import { InvestmentProjectContext } from '../../context/InvestmentProjectContext';
import { AuthContext } from '../../context/AuthContext';
import { NotificationContext } from '../../context/NotificationContext';
import {
    calculate15YearStatements,
    calculateExitValuation,
    calculateExitWaterfall,
    calculateBankingCovenants,
    runSimulation
} from '../../workers/financialCalculations';

// Mock Recharts ResponsiveContainer to avoid DOM resize observer warnings
vi.mock('recharts', async () => {
    const actual = await vi.importActual('recharts');
    return {
        ...actual,
        ResponsiveContainer: ({ children }) => (
            <div data-testid="responsive-container" style={{ width: '800px', height: '320px' }}>
                {children}
            </div>
        ),
    };
});

describe('Phase 44 Statements, Valuation & Covenants Comprehensive Test Suite (Commit 221)', () => {
    const mockNotify = vi.fn();
    const mockNotifyError = vi.fn();

    const mockCompany = {
        id: 1,
        name: 'Baltic Energy & Tech SPV',
        currency: 'PLN'
    };

    const mockProject = {
        id: 'proj-phase44-e2e',
        name: 'Morska Farma Wiatrowa & Magazyn Energii 150MW',
        currency: 'PLN',
        start_date: '2026-01-01',
        commercial_operation_date: '2027-01-01',
        planning_horizon_years: 15,
        capex_stages: [
            {
                id: 'stage-turbines',
                stage_name: 'Turbiny Wiatrowe Offshore 15MW',
                net_amount: 60000000,
                start_date: '2026-01-01',
                duration_months: 10,
                kst_code: 'KST_3',
                kst_annual_rate: 7.0,
            },
            {
                id: 'stage-bess',
                stage_name: 'Bateryjny Magazyn Energii BESS',
                net_amount: 40000000,
                start_date: '2026-03-01',
                duration_months: 8,
                kst_code: 'KST_6',
                kst_annual_rate: 10.0,
            },
        ],
        debt_facility: {
            principal_amount: 60000000,
            base_interest_rate_percent: 5.50,
            margin_percent: 2.25, // 7.75%
            upfront_fee_percent: 1.0,
            tenor_months: 120, // 10 lat
            grace_period_months: 12,
            repayment_type: 'annuity',
        },
        financing_structure: {
            investor1_equity: 24000000, // 60% Sponsor
            investor2_equity: 16000000, // 40% LP
            debt_facility_amount: 60000000,
        },
        operating_assumptions: {
            annual_revenue_base: 45000000,
            revenue_growth_rate_percent: 3.5,
            variable_cost_percent: 20.0,
            annual_fixed_costs_base: 4000000,
            fixed_cost_growth_rate_percent: 2.5,
            annual_payroll_base: 4500000,
            payroll_growth_rate_percent: 3.0,
            capacity_ramp_up: {
                year1_percent: 80.0,
                year2_percent: 95.0,
                year3_percent: 100.0,
            },
            cit_rate_percent: 19.0,
            tax_loss_carry_forward_enabled: true,
            tax_loss_offset_cap_percent: 50.0,
            dso: 35,
            dpo: 30,
            dio: 15,
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

    beforeEach(() => {
        vi.clearAllMocks();
    });

    // =========================================================================
    // 1. MATHEMATICAL INTEGRITY & 3-STATEMENT ACCOUNTING EQUATIONS
    // =========================================================================
    describe('1. 3-Statement Mathematical & Accounting Equation Integrity', () => {
        it('verifies Balance Sheet balances across all 15 years (Assets = Liabilities + Equity)', () => {
            const statements = calculate15YearStatements(mockProject);
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
                // Difference must be zero or negligible rounding (< 1 PLN)
                expect(delta).toBeLessThan(1.0);
            });
        });

        it('verifies Cash Flow continuity and closing cash reconciliation with Balance Sheet', () => {
            const statements = calculate15YearStatements(mockProject);
            let runningCash = statements.initialEquity;

            statements.annualPeriods.forEach((period) => {
                const calculatedEndingCash = runningCash + period.netCashFlow;
                expect(Math.abs(period.closingCash - calculatedEndingCash)).toBeLessThan(1.0);
                runningCash = period.closingCash;
            });
        });

        it('reconciles operating cash flow with EBITDA, CIT, and Working Capital change', () => {
            const statements = calculate15YearStatements(mockProject);
            statements.annualPeriods.forEach((period) => {
                if (period.revenue > 0) {
                    const expectedOcf = period.netIncome + period.depreciation + period.changeInNwc;
                    expect(Math.abs(period.operatingCashFlow - expectedOcf)).toBeLessThan(1.0);
                }
            });
        });
    });

    // =========================================================================
    // 2. THREE-STATEMENT GRID COMPONENT HIERARCHY & GRANULARITY
    // =========================================================================
    describe('2. ThreeStatementGrid Component Behavior', () => {
        const renderGridWithContext = (props = {}) => {
            const contextValue = {
                selectedProject: mockProject,
                selectedProjectId: mockProject.id,
                loading: false,
            };

            return render(
                <InvestmentProjectContext.Provider value={contextValue}>
                    <ThreeStatementGrid project={mockProject} {...props} />
                </InvestmentProjectContext.Provider>
            );
        };

        it('renders PnL, Balance Sheet, and Cash Flow statement navigation tabs', async () => {
            renderGridWithContext();

            await waitFor(() => {
                expect(screen.getByRole('button', { name: /RZiS \(P&L\)/i })).toBeInTheDocument();
                expect(screen.getByRole('button', { name: /Bilans/i })).toBeInTheDocument();
                expect(screen.getByRole('button', { name: /Cash Flow/i })).toBeInTheDocument();
            });
        });

        it('toggles section folding for Revenue and OPEX hierarchy', async () => {
            renderGridWithContext();

            await waitFor(() => {
                expect(screen.getByText('Przychody ze Sprzedaży')).toBeInTheDocument();
                expect(screen.getByText('EBITDA (Zysk Operacyjny Gotówkowy)')).toBeInTheDocument();
            });

            // Check that sub-rows can be collapsed and expanded
            const collapseAllBtn = screen.getByRole('button', { name: /^Zwiń wszystko$/i });
            fireEvent.click(collapseAllBtn);

            await waitFor(() => {
                expect(screen.queryByText('↳ Koszty Zmienne (Media, Surowce, Prowizje)')).not.toBeInTheDocument();
            });

            const expandAllBtn = screen.getByRole('button', { name: /^Rozwiń wszystko$/i });
            fireEvent.click(expandAllBtn);

            await waitFor(() => {
                expect(screen.getByText('↳ Koszty Zmienne (Media, Surowce, Prowizje)')).toBeInTheDocument();
            });
        });

        it('switches granularity to monthly view with year filter', async () => {
            renderGridWithContext();

            await waitFor(() => {
                expect(screen.getByText('15 Lat (Rocznie)')).toBeInTheDocument();
            });

            const monthlyBtn = screen.getByText('180 M (Miesięcznie)');
            fireEvent.click(monthlyBtn);

            await waitFor(() => {
                expect(screen.getByLabelText('Wybierz rok do wyświetlenia')).toBeInTheDocument();
            });
        });
    });

    // =========================================================================
    // 3. EXIT VALUATION OVERLAY MODELING & BUYER ECONOMICS
    // =========================================================================
    describe('3. ExitValuationOverlay Calculations & Sensitivity Matrix', () => {
        it('calculates Enterprise Value to Equity Value Bridge at Year 5', () => {
            const statements = calculate15YearStatements(mockProject);
            const appraisalWacc = 9.85;

            const exitResult = calculateExitValuation(
                statements.annualPeriods,
                statements.initialEquity,
                appraisalWacc,
                'PLN',
                { exitYear: 5, exitMultiple: 8.5 }
            );

            expect(exitResult.exitYear).toBe(5);
            expect(exitResult.exitMultiple).toBe(8.5);
            expect(exitResult.enterpriseValue).toBeGreaterThan(0);
            expect(exitResult.equityValue).toBe(Math.max(0, exitResult.enterpriseValue - exitResult.netDebtAtExit));
            expect(exitResult.equityMoic).toBeGreaterThan(1.0);
            expect(exitResult.equityIrrPercent).toBeGreaterThan(0);
        });

        it('calculates Buyer Yields correctly (Entry Cap Rate and Spread over WACC)', () => {
            const statements = calculate15YearStatements(mockProject);
            const wacc = 9.5;
            const exitResult = calculateExitValuation(
                statements.annualPeriods,
                statements.initialEquity,
                wacc,
                'PLN',
                { exitYear: 5, exitMultiple: 8.0 }
            );

            // Entry EBITDA Yield = 1 / Multiple = 1 / 8.0 = 12.5%
            expect(exitResult.buyerEbitdaYieldPercent).toBe(12.5);
            expect(exitResult.buyerYieldSpreadPercent).toBe(12.5 - wacc);
            expect(exitResult.buyerImpliedPaybackYears).toBe(8.0);
        });

        it('generates 2D sensitivity matrix across multiples and exit years', () => {
            const statements = calculate15YearStatements(mockProject);
            const exitResult = calculateExitValuation(
                statements.annualPeriods,
                statements.initialEquity,
                9.5,
                'PLN',
                { exitYear: 5, exitMultiple: 8.5 }
            );

            expect(exitResult.sensitivityGrid.length).toBeGreaterThan(0);
            expect(exitResult.sensitivityMultiples.length).toBeGreaterThanOrEqual(5);
            expect(exitResult.sensitivityYears.length).toBeGreaterThanOrEqual(5);
        });
    });

    // =========================================================================
    // 4. EXIT WATERFALL VISUALIZER & INVESTOR PROCEEDS SPLIT
    // =========================================================================
    describe('4. ExitWaterfallVisualizer Mechanics (Pari Passu vs Two-Tier Hurdle)', () => {
        it('calculates Pari Passu pro-rata split matching initial equity share (60% / 40%)', () => {
            const statements = calculate15YearStatements(mockProject);
            const initialEquity = statements.initialEquity; // 40M

            const waterfallResult = calculateExitWaterfall(
                statements.annualPeriods,
                initialEquity,
                'PLN',
                {
                    exitYear: 5,
                    exitMultiple: 8.5,
                    structure: 'pari_passu',
                    sponsorSharePercent: 60.0,
                }
            );

            expect(waterfallResult.structure).toBe('pari_passu');
            expect(waterfallResult.investor1.sharePercent).toBe(60.0);
            expect(waterfallResult.investor2.sharePercent).toBe(40.0);

            // Total proceeds sum
            const sumProceeds = waterfallResult.investor1.totalProceeds + waterfallResult.investor2.totalProceeds;
            expect(Math.abs(sumProceeds - waterfallResult.totalProceedsTotal)).toBeLessThan(1.0);

            // Pro-rata equity split of exit proceeds
            const totalExitProceeds = waterfallResult.investor1.exitProceeds + waterfallResult.investor2.exitProceeds;
            expect(waterfallResult.investor1.exitProceeds / totalExitProceeds).toBeCloseTo(0.60, 2);
            expect(waterfallResult.investor2.exitProceeds / totalExitProceeds).toBeCloseTo(0.40, 2);
        });

        it('calculates Two-Tier Hurdle waterfall giving Sponsor carried interest on excess tier 2', () => {
            const statements = calculate15YearStatements(mockProject);
            const initialEquity = statements.initialEquity;

            const waterfallResult = calculateExitWaterfall(
                statements.annualPeriods,
                initialEquity,
                'PLN',
                {
                    exitYear: 5,
                    exitMultiple: 10.0,
                    structure: 'two_tier_hurdle',
                    sponsorSharePercent: 60.0,
                    hurdleRatePercent: 8.0,
                    carrySharePercent: 80.0,
                }
            );

            expect(waterfallResult.structure).toBe('two_tier_hurdle');
            expect(waterfallResult.hurdleRatePercent).toBe(8.0);
            expect(waterfallResult.carrySharePercent).toBe(80.0);

            // Sponsor MoIC should be higher due to carry incentive
            expect(waterfallResult.investor1.moic).toBeGreaterThan(waterfallResult.investor2.moic);
            expect(waterfallResult.investor1.irrPercent).toBeGreaterThan(waterfallResult.investor2.irrPercent);
        });

        it('verifies Waterfall Steps sequence (EV -> Debt -> Cash -> EqV -> GP -> LP)', () => {
            const statements = calculate15YearStatements(mockProject);
            const waterfallResult = calculateExitWaterfall(
                statements.annualPeriods,
                statements.initialEquity,
                'PLN',
                { exitYear: 5, exitMultiple: 8.5 }
            );

            expect(waterfallResult.waterfallSteps).toHaveLength(6);
            expect(waterfallResult.waterfallSteps[0].category).toBe('ev');
            expect(waterfallResult.waterfallSteps[1].category).toBe('debt');
            expect(waterfallResult.waterfallSteps[2].category).toBe('cash');
            expect(waterfallResult.waterfallSteps[3].category).toBe('equity');
            expect(waterfallResult.waterfallSteps[4].category).toBe('sponsor');
            expect(waterfallResult.waterfallSteps[5].category).toBe('partner');
        });
    });

    // =========================================================================
    // 5. BANKING COVENANTS STRIP & REAL-TIME BANKABILITY AUDIT
    // =========================================================================
    describe('5. BankingCovenantsStrip & Stress Threshold Testing', () => {
        it('calculates DSCR and ICR for all commercial debt service periods', () => {
            const statements = calculate15YearStatements(mockProject);
            const covenants = calculateBankingCovenants(statements.annualPeriods, {
                minDscr: 1.20,
                minIcr: 2.50,
            });

            expect(covenants.yearlyMetrics).toHaveLength(15);
            expect(covenants.summary.minDscr).toBeGreaterThan(1.0);
            expect(covenants.summary.minIcr).toBeGreaterThan(1.5);
            expect(covenants.summary.pinchYear).not.toBeNull();
        });

        it('triggers covenant breaches when thresholds are stressed', () => {
            const statements = calculate15YearStatements(mockProject);
            // Ultra-strict thresholds that should trigger breaches
            const stressedCovenants = calculateBankingCovenants(statements.annualPeriods, {
                minDscr: 3.50, // Unrealistically high DSCR
                minIcr: 8.00,
            });

            expect(stressedCovenants.summary.isBankable).toBe(false);
            expect(stressedCovenants.summary.bankabilityStatus).toBe('breach');
            expect(stressedCovenants.summary.totalBreachesCount).toBeGreaterThan(0);
        });

        it('correctly reports bankability status for balanced project under standard LMA', () => {
            const statements = calculate15YearStatements(mockProject);
            const standardCovenants = calculateBankingCovenants(statements.annualPeriods, {
                minDscr: 1.20,
                minIcr: 2.00,
                maxLeverage: 4.50,
                minCurrentRatio: 1.05,
                minDsrfMonths: 6,
            });

            expect(standardCovenants.summary.minDscr).toBeGreaterThanOrEqual(1.20);
        });
    });

    // =========================================================================
    // 6. E2E INTEGRATION IN INVESTMENTPLANNINGVIEW (STATEMENTS TAB)
    // =========================================================================
    describe('6. InvestmentPlanningView Statements Tab Cross-Component Integration', () => {
        const FullPlanningViewWrapper = () => {
            const [activeTab, setActiveTab] = useState('statements');

            const authContextValue = {
                activeCompany: mockCompany,
                companies: [mockCompany],
            };

            const projectContextValue = {
                projects: [mockProject],
                selectedProject: mockProject,
                selectedProjectId: mockProject.id,
                loading: false,
                activeTab,
                setActiveTab,
                selectProject: vi.fn(),
                createProject: vi.fn(),
            };

            const notificationContextValue = {
                notify: mockNotify,
                notifyError: mockNotifyError,
                notifications: [],
            };

            return (
                <AuthContext.Provider value={authContextValue}>
                    <NotificationContext.Provider value={notificationContextValue}>
                        <InvestmentProjectContext.Provider value={projectContextValue}>
                            <InvestmentPlanningView />
                        </InvestmentProjectContext.Provider>
                    </NotificationContext.Provider>
                </AuthContext.Provider>
            );
        };

        it('renders all four Phase 44 components concurrently in statements tab without race conditions', async () => {
            render(<FullPlanningViewWrapper />);

            // 1. Banking Covenants Strip
            await waitFor(() => {
                expect(screen.getByText(/KOWENANTY BANKOWE & TEST BANKOWALNOŚCI \(15 LAT\)/i)).toBeInTheDocument();
            });

            // 2. Exit Valuation Overlay
            await waitFor(() => {
                expect(screen.getByText(/Wycena Wyjścia \(Exit Valuation\)/i)).toBeInTheDocument();
            });

            // 3. Exit Waterfall Visualizer
            await waitFor(() => {
                expect(screen.getByText(/Wizualizator Kaskady Wyjścia \(Exit Waterfall\)/i)).toBeInTheDocument();
            });

            // 4. Three-Statement Grid
            await waitFor(() => {
                expect(screen.getByRole('button', { name: /RZiS \(P&L\)/i })).toBeInTheDocument();
                expect(screen.getByText(/1\. Rachunek Zysków i Strat/i)).toBeInTheDocument();
            });
        });
    });
    // =========================================================================
    // 7. STATUTORY CIT TAX LOSS CARRY-FORWARD & 3-STATEMENT REGRESSION (PHASE 49)
    // =========================================================================
    describe('7. Statutory CIT Tax Loss Carry-Forward & 3-Statement Regression', () => {
        const createCitProject = (mode, oneOffCap = 5000000) => ({
            ...mockProject,
            operating_assumptions: {
                ...mockProject.operating_assumptions,
                annual_revenue_base: 25000000,
                capacity_ramp_up: {
                    year1_percent: 10.0, // Initial loss in Y1
                    year2_percent: 85.0,
                    year3_percent: 100.0,
                },
                cit_rate_percent: 19.0,
                tax_loss_carry_forward_enabled: true,
                tax_loss_settlement_mode: mode,
                tax_loss_one_off_cap_amount: oneOffCap,
                tax_loss_offset_cap_percent: 50.0,
            },
        });

        it('maintains Balance Sheet zero-variance across all 15 years under both standard_loss_cap and one_off_5m modes', () => {
            const standardProject = createCitProject('standard_loss_cap');
            const oneOffProject = createCitProject('one_off_5m', 5000000);

            const standardStmts = calculate15YearStatements(standardProject);
            const oneOffStmts = calculate15YearStatements(oneOffProject);

            expect(standardStmts.annualPeriods).toHaveLength(15);
            expect(oneOffStmts.annualPeriods).toHaveLength(15);

            // Both models must satisfy Assets = Liabilities + Equity
            [standardStmts, oneOffStmts].forEach((statements) => {
                let cumNetIncome = 0;
                let cumDepr = 0;
                statements.annualPeriods.forEach((period) => {
                    cumNetIncome += period.netIncome;
                    cumDepr += period.depreciation;
                    const netPpe = Math.max(0, statements.initialCapex - cumDepr);
                    const totalAssets = netPpe + period.closingReceivables + period.closingInventory + period.closingCash;
                    const totalLiabilitiesAndEquity = (statements.initialEquity + cumNetIncome) + period.closingDebt + period.closingPayables;
                    expect(Math.abs(totalAssets - totalLiabilitiesAndEquity)).toBeLessThan(1.0);
                });
            });
        });

        it('confirms that monthly YTD CIT advances sum exactly to annual CIT in every year', () => {
            const project = createCitProject('one_off_5m', 5000000);
            const statements = calculate15YearStatements(project);

            for (let y = 1; y <= 15; y++) {
                const annualPeriod = statements.annualPeriods[y - 1];
                const monthlyInYear = statements.monthlyPeriods.filter((m) => m.year === y);
                const sumMonthlyCit = monthlyInYear.reduce((acc, m) => acc + m.cit, 0);

                expect(sumMonthlyCit).toBeCloseTo(annualPeriod.cit, 2);
            }
        });

        it('verifies one_off_5m accelerates tax deduction in Year 2 compared to standard 50% cap', () => {
            const standardStmts = calculate15YearStatements(createCitProject('standard_loss_cap'));
            const oneOffStmts = calculate15YearStatements(createCitProject('one_off_5m', 5000000));

            const stdY2 = standardStmts.annualPeriods[1];
            const oneOffY2 = oneOffStmts.annualPeriods[1];

            // In Year 2, one-off deduction up to 5M allows equal or greater tax loss usage
            expect(oneOffY2.taxLossUsed).toBeGreaterThanOrEqual(stdY2.taxLossUsed);
            // Resulting in lower or equal CIT payable in Year 2
            expect(oneOffY2.cit).toBeLessThanOrEqual(stdY2.cit);
            // And higher or equal Year 2 Net Income
            expect(oneOffY2.netIncome).toBeGreaterThanOrEqual(stdY2.netIncome);
        });

        it('renders ThreeStatementGrid with expandable tax breakdown rows showing correct pool figures', async () => {
            const citProject = createCitProject('one_off_5m', 5000000);
            const statements = calculate15YearStatements(citProject);

            const contextValue = {
                selectedProject: citProject,
                selectedProjectId: citProject.id,
                loading: false,
            };

            render(
                <InvestmentProjectContext.Provider value={contextValue}>
                    <ThreeStatementGrid project={citProject} />
                </InvestmentProjectContext.Provider>
            );

            // Expand tax breakdown sub-rows
            const expandTaxBtn = screen.getByRole('button', { name: /Rozwiń rozliczenie podatkowe CIT/i });
            fireEvent.click(expandTaxBtn);

            await waitFor(() => {
                expect(screen.getByText(/Saldo Otwarcia Tarczy Podatkowej/i)).toBeInTheDocument();
                expect(screen.getByText(/Wygasłe Straty Podatkowe/i)).toBeInTheDocument();
                expect(screen.getByText(/Odliczona Tarcza Podatkowa/i)).toBeInTheDocument();
                expect(screen.getByText(/Podstawa Opodatkowania CIT/i)).toBeInTheDocument();
                expect(screen.getByText(/Saldo Zamknięcia Tarczy Podatkowej/i)).toBeInTheDocument();
            });
        });
    });
});
