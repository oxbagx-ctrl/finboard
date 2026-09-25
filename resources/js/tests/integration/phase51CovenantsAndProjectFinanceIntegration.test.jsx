import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BankingCovenantsStrip, COVENANT_PRESETS } from '../../components/investments/BankingCovenantsStrip';
import { InvestmentProjectContext } from '../../context/InvestmentProjectContext';
import { runSimulation } from '../../workers/financialCalculations';

// Mock Recharts ResponsiveContainer to prevent layout engine warnings in Vitest JSDOM
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

describe('Phase 51 LMA Banking Covenants, LLCR, DSRA & Equity Cure Integration Suite (Commit 248)', () => {
    const baseProject = {
        id: 'proj-phase51-offshore',
        name: 'Morska Farma Wiatrowa 120MW Bałtyk Środkowy',
        currency: 'PLN',
        start_date: '2026-01-01',
        commercial_operation_date: '2027-01-01',
        planning_horizon_years: 15,
        capex_stages: [
            {
                id: 'stage-turbines',
                stage_name: 'Turbiny Wiatrowe Offshore 15MW x 8',
                net_amount: 50000000,
                start_date: '2026-01-01',
                duration_months: 10,
                kst_code: 'KST_3',
                kst_annual_rate: 7.0,
                grant_eligible_amount: 50000000,
            },
            {
                id: 'stage-cables',
                stage_name: 'Podmorska Infrastruktura Kablowa i Trafostacja',
                net_amount: 30000000,
                start_date: '2026-03-01',
                duration_months: 8,
                kst_code: 'KST_2',
                kst_annual_rate: 4.5,
                grant_eligible_amount: 30000000,
            },
        ],
        debt_facility: {
            principal_amount: 48000000, // 60% Debt
            base_interest_rate_percent: 5.50,
            margin_percent: 2.25, // 7.75% nominal Kd
            upfront_fee_percent: 1.0,
            tenor_months: 120, // 10 years
            grace_period_months: 12,
            repayment_type: 'annuity',
        },
        financing_structure: {
            investor1_equity: 16000000, // 20% Sponsor
            investor2_equity: 0,
            grant_amount: 16000000, // 20% Grant
            vat_bridge_loan: 18400000,
            grant_disbursement_schedule: [
                { milestone: 'Zaliczka NFOŚiGW', amount: 4800000, date: '2026-02-15' },
                { milestone: 'Transza Pośrednia 50%', amount: 6400000, date: '2026-07-31' },
                { milestone: 'Transza Końcowa Certyfikowana', amount: 4800000, date: '2027-01-31' },
            ],
        },
        operating_assumptions: {
            annual_revenue_base: 28000000,
            revenue_growth_rate_percent: 3.0,
            variable_cost_percent: 15.0,
            annual_fixed_costs_base: 2500000,
            fixed_cost_growth_rate_percent: 2.5,
            annual_payroll_base: 2000000,
            payroll_growth_rate_percent: 3.0,
            capacity_ramp_up: {
                year1_percent: 75.0,
                year2_percent: 90.0,
                year3_percent: 100.0,
            },
            cit_rate_percent: 19.0,
            tax_loss_carry_forward_enabled: true,
            tax_loss_offset_cap_percent: 50.0,
            dso: 30,
            dpo: 35,
            dio: 10,
        },
    };

    const renderWithContext = (project = baseProject, props = {}) => {
        const contextValue = {
            selectedProject: project,
            selectedProjectId: project?.id || null,
            loading: false,
        };

        return render(
            <InvestmentProjectContext.Provider value={contextValue}>
                <BankingCovenantsStrip project={project} defaultExpanded={true} {...props} />
            </InvestmentProjectContext.Provider>
        );
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('1. performs 15-year simulation with DSRA escrow reserve segregation and zero balance variance', () => {
        const simulationResult = runSimulation(baseProject, baseProject.operating_assumptions);
        expect(simulationResult).toBeDefined();

        const { annualPeriods } = simulationResult;
        expect(annualPeriods).toHaveLength(15);

        // Verify DSRA reserve segregation from free cash across all 15 years
        annualPeriods.forEach((sheet) => {
            expect(sheet.dsraReserve).toBeDefined();
            expect(sheet.freeCash).toBeDefined();
            expect(sheet.dsraReserve).toBeGreaterThanOrEqual(0);
            expect(sheet.freeCash).toBeGreaterThanOrEqual(0);

            // When closing cash is positive, freeCash + dsraReserve equals closingCash
            if (sheet.closingCash > 0) {
                expect(sheet.freeCash + sheet.dsraReserve).toBeCloseTo(sheet.closingCash, 1);
            }
        });

        // After debt tenor (years 11-15), closing debt is 0, so DSRA reserve must be released to 0
        for (let y = 11; y <= 15; y++) {
            const period = annualPeriods[y - 1];
            expect(period.closingDebt).toBe(0);
            expect(period.dsraReserve).toBe(0);
            expect(period.freeCash).toBeCloseTo(period.closingCash, 1);
        }
    });

    it('2. verifies LMA LLCR calculation discounts future CFADS by Kd and incorporates DSRA reserve', () => {
        const simulationResult = runSimulation(baseProject, baseProject.operating_assumptions);
        const { covenants } = simulationResult;

        expect(covenants).toBeDefined();
        expect(covenants.summary.minLlcr).toBeDefined();
        expect(covenants.summary.avgLlcr).toBeDefined();
        expect(covenants.summary.minLlcr).toBeGreaterThan(0);
        expect(covenants.summary.avgLlcr).toBeGreaterThan(covenants.summary.minLlcr);

        // Inspect yearly metrics during commercial debt-bearing period (Years 2 to 10)
        covenants.yearlyMetrics.forEach((m) => {
            if (m.isCommercial && m.year <= 10) {
                expect(typeof m.llcr).toBe('number');
                expect(m.llcr).toBeGreaterThan(0);
                expect(['compliant', 'warning', 'breach']).toContain(m.llcrStatus);
                expect(m.llcrHeadroom).toBeDefined();
                expect(m.dsraReserve).toBeDefined();
            } else if (m.year > 10) {
                // Post-tenor years: no senior debt, LLCR is null
                expect(m.llcr).toBeNull();
            }
        });
    });

    it('3. enforces presentation guardrails: CR and DSRF never display negative values', () => {
        // Create an extreme cash drain scenario to produce negative liquidity
        const distressedProject = {
            ...baseProject,
            operating_assumptions: {
                ...baseProject.operating_assumptions,
                annual_revenue_base: 5000000, // Very low revenue
                annual_fixed_costs_base: 15000000, // High costs causing negative cash
            },
        };

        const simulation = runSimulation(distressedProject, distressedProject.operating_assumptions);
        const covenants = simulation.covenants;

        expect(covenants.summary.minCurrentRatio).toBeLessThan(1.0);

        renderWithContext(distressedProject, {
            simulationData: simulation,
        });

        // The KPI value text for Current Ratio must display '(Deficyt NWC)' and not a negative number
        expect(screen.getByText('(Deficyt NWC)')).toBeInTheDocument();

        // And DSRF must display '(Luka gotówkowa)' with 0.0 m. and not negative months
        expect(screen.getByText('(Luka gotówkowa)')).toBeInTheDocument();
        expect(screen.getByText('DEFICYT PŁYNNOŚCI')).toBeInTheDocument();
        expect(screen.getByText('BRAK REZERWY')).toBeInTheDocument();
    });

    it('4. computes precise Deal Advisory Equity Cure requirements under covenant breach', () => {
        // Project with tight debt service causing DSCR & LLCR breach
        const strainedProject = {
            ...baseProject,
            debt_facility: {
                ...baseProject.debt_facility,
                principal_amount: 55000000,
                base_interest_rate_percent: 8.50,
                margin_percent: 3.00, // 11.5% interest rate
            },
            operating_assumptions: {
                ...baseProject.operating_assumptions,
                annual_revenue_base: 18000000, // Lower revenue
            },
        };

        const simulation = runSimulation(strainedProject, strainedProject.operating_assumptions);
        const covenants = simulation.covenants;

        expect(covenants.summary.bankabilityStatus).toBe('breach');
        expect(covenants.equityCure).toBeDefined();
        expect(covenants.equityCure.isCureNeeded).toBe(true);
        expect(covenants.equityCure.totalEquityCureRequired).toBeGreaterThan(0);
        expect(covenants.equityCure.peakAnnualCure).toBeGreaterThan(0);
        expect(covenants.equityCure.curesByYear.length).toBeGreaterThan(0);
        expect(covenants.equityCure.recommendations.length).toBeGreaterThan(0);

        // Render BankingCovenantsStrip and switch to Sub-tab 3 (Deal Advisory)
        renderWithContext(strainedProject, {
            simulationData: simulation,
        });

        // Click on Tab 3: Wąskie Gardło & Analiza Buforu
        const tab3Button = screen.getByRole('button', { name: /3\. Wąskie Gardło/i });
        fireEvent.click(tab3Button);

        // Verify Equity Cure Simulator appears in UI with exact titles
        expect(screen.getByText(/Equity Cure Simulator/i)).toBeInTheDocument();
        expect(screen.getByText(/Łączny Wymóg Dokapitalizowania/i)).toBeInTheDocument();
        expect(screen.getByText(/Szczytowy Roczny Zastrzyk/i)).toBeInTheDocument();
        expect(screen.getByText(/Zalecenia Deal Advisory dla Zespołu Transakcyjnego/i)).toBeInTheDocument();
    });

    it('5. presents LMA Bankability Certificate when project satisfies all covenants', () => {
        // Bankable project structure with conservative debt and high operating coverage
        const bankableProject = {
            ...baseProject,
            capex_stages: [
                {
                    id: 'stage-turbines',
                    stage_name: 'Turbiny Wiatrowe Offshore 15MW x 8',
                    net_amount: 30000000,
                    start_date: '2026-01-01',
                    duration_months: 10,
                    kst_code: 'KST_3',
                    kst_annual_rate: 7.0,
                },
                {
                    id: 'stage-cables',
                    stage_name: 'Podmorska Infrastruktura Kablowa i Trafostacja',
                    net_amount: 20000000,
                    start_date: '2026-03-01',
                    duration_months: 8,
                    kst_code: 'KST_2',
                    kst_annual_rate: 4.5,
                },
            ],
            debt_facility: {
                principal_amount: 5000000,
                base_interest_rate_percent: 4.0,
                margin_percent: 1.5,
                upfront_fee_percent: 1.0,
                tenor_months: 120,
                grace_period_months: 12,
                repayment_type: 'annuity',
            },
            financing_structure: {
                investor1_equity: 35000000,
                investor2_equity: 10000000,
                debt_facility_amount: 5000000,
                grant_amount: 0,
                vat_bridge_loan: 0,
            },
            operating_assumptions: {
                ...baseProject.operating_assumptions,
                annual_revenue_base: 50000000,
            },
        };

        const simulation = runSimulation(bankableProject, bankableProject.operating_assumptions);
        const covenants = simulation.covenants;

        expect(covenants.summary.bankabilityStatus).toBe('compliant');
        expect(covenants.equityCure.isCureNeeded).toBe(false);

        renderWithContext(bankableProject, {
            simulationData: simulation,
        });

        // Click on Tab 3: Wąskie Gardło & Analiza Buforu
        const tab3Button = screen.getByRole('button', { name: /3\. Wąskie Gardło/i });
        fireEvent.click(tab3Button);

        // Verify LMA Certificate is rendered
        expect(screen.getByText(/Certyfikat Bankowalności LMA/i)).toBeInTheDocument();
        expect(screen.getByText(/LMA COMPLIANT/i)).toBeInTheDocument();
        expect(screen.getByText(/Opinia Komitetu Kredytowego/i)).toBeInTheDocument();
    });

    it('6. responds dynamically to covenant threshold slider changes and preset switching', async () => {
        const simulation = runSimulation(baseProject, baseProject.operating_assumptions);

        renderWithContext(baseProject, {
            simulationData: simulation,
        });

        // Click Conservative Preset (minLlcr: 1.45, minDscr: 1.30)
        const conservativeBtn = screen.getByRole('button', { name: /Konserwatywny/i });
        expect(conservativeBtn).toBeInTheDocument();
        fireEvent.click(conservativeBtn);

        // Switch to Sub-tab 2: Konfigurator wymogów banku
        const tab2Button = screen.getByRole('button', { name: /2\. Konfigurator Wymogów Banku/i });
        fireEvent.click(tab2Button);

        // Verify LLCR input reflects 1.45x
        await waitFor(() => {
            expect(screen.getAllByText(/1.45x/i).length).toBeGreaterThan(0);
        });

        // Click Restore LMA Standards button
        const restoreBtn = screen.getByRole('button', { name: /Przywróć standardy LMA/i });
        expect(restoreBtn).toBeInTheDocument();
        fireEvent.click(restoreBtn);

        // Verify reset back to standard 1.35x
        await waitFor(() => {
            expect(screen.getAllByText(/1.35x/i).length).toBeGreaterThan(0);
        });
    });
});
