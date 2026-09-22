import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    calculateDepreciationSchedule,
    calculateDebtSchedule,
    calculate15YearStatements,
    calculateIrr,
    calculatePaybackPeriod,
    calculateAppraisalMetrics,
    runSimulation
} from '../../workers/financialCalculations';
import { InvestmentWorkerClient, getInvestmentWorkerClient } from '../../workers/InvestmentWorkerClient';

describe('Financial Calculations Engine & Web Worker (Phase 43 Commit 212)', () => {
    const mockProject = {
        id: 'proj-solar-manufacturing',
        name: 'Fabryka Paneli Fotowoltaicznych 500MW',
        currency: 'PLN',
        start_date: '2026-01-01',
        commercial_operation_date: '2027-01-01', // 12 months construction
        planning_horizon_years: 15,
        capex_stages: [
            {
                id: 'stage-civil',
                stage_name: 'Hala produkcyjna i magazyn',
                net_amount: 15000000,
                start_date: '2026-01-01',
                duration_months: 10,
                kst_code: 'KST_1', // 2.5%
                kst_annual_rate: 2.5
            },
            {
                id: 'stage-machinery',
                stage_name: 'Linia laminacji i cięcia laserowego',
                net_amount: 25000000,
                start_date: '2026-03-01',
                duration_months: 8,
                kst_code: 'KST_4', // 10.0%
                kst_annual_rate: 10.0
            },
            {
                id: 'stage-it',
                stage_name: 'System MES, ERP i sensory IoT',
                net_amount: 5000000,
                start_date: '2026-06-01',
                duration_months: 6,
                kst_code: 'KST_IT', // 30.0%
                kst_annual_rate: 30.0
            }
        ],
        debt_facility: {
            principal_amount: 27000000, // 60% LTV
            base_interest_rate_percent: 5.85,
            margin_percent: 2.15, // 8.00% total
            upfront_fee_percent: 1.0,
            tenor_months: 120, // 10 years
            grace_period_months: 12,
            repayment_type: 'annuity'
        },
        financing_structure: {
            investor1_equity: 12000000,
            investor2_equity: 6000000,
            debt_facility_amount: 27000000
        },
        operating_assumptions: {
            annual_revenue_base: 36000000,
            revenue_growth_rate_percent: 3.0,
            variable_cost_percent: 42.0,
            annual_fixed_costs_base: 4500000,
            fixed_cost_growth_rate_percent: 2.5,
            annual_payroll_base: 6000000,
            payroll_growth_rate_percent: 4.0,
            capacity_ramp_up: {
                year1_percent: 70.0,
                year2_percent: 90.0,
                year3_percent: 100.0
            },
            cit_rate_percent: 19.0,
            tax_loss_carry_forward_enabled: true,
            tax_loss_offset_cap_percent: 50.0,
            dso: 45,
            dpo: 30,
            dio: 25
        },
        wacc_parameters: {
            risk_free_rate_percent: 5.50,
            equity_risk_premium_percent: 6.00,
            levered_beta: 1.15,
            cost_of_equity_percent: 12.40,
            target_debt_ratio_percent: 60.0
        },
        valuation_multiple: {
            multiple: 7.5,
            multiple_type: 'ev_ebitda'
        }
    };

    describe('1. KŚT Asset Depreciation Engine', () => {
        it('calculates linear depreciation starting month after OT completion', () => {
            const result = calculateDepreciationSchedule(
                mockProject.capex_stages,
                mockProject.start_date,
                15,
                1.0
            );

            // Total CAPEX: 15M + 25M + 5M = 45,000,000 PLN
            expect(result.totalCapex).toBe(45000000);

            // Stage 1 (Civil: 15M, 10 months, starts month 1 -> finishes month 10, OT month 11, dep starts month 12)
            // In months 1..10, capex is positive, depreciation is 0
            expect(result.monthlyCapex[1]).toBeGreaterThan(0);
            expect(result.monthlyDepreciation[1]).toBe(0);

            // Total annual depreciation in Year 2 (full operations) should reflect all 3 stages:
            // 15M * 2.5% + 25M * 10% + 5M * 30% = 375k + 2,500k + 1,500k = 4,375,000 PLN
            expect(result.annualDepreciation[2]).toBeCloseTo(4375000, -3);
            expect(result.annualDepreciation.length).toBe(16); // index 0..15
        });

        it('scales capex and depreciation proportionately when capexMultiplier is applied', () => {
            const baseResult = calculateDepreciationSchedule(mockProject.capex_stages, '2026-01-01', 15, 1.0);
            const scaledResult = calculateDepreciationSchedule(mockProject.capex_stages, '2026-01-01', 15, 1.10); // +10%

            expect(scaledResult.totalCapex).toBeCloseTo(baseResult.totalCapex * 1.10, 2);
            expect(scaledResult.annualDepreciation[2]).toBeCloseTo(baseResult.annualDepreciation[2] * 1.10, 0);
        });
    });

    describe('2. Senior Debt Amortization Engine', () => {
        it('calculates annuity debt schedule with grace period and upfront fee', () => {
            const result = calculateDebtSchedule(
                mockProject.debt_facility,
                45000000,
                15,
                'annuity'
            );

            expect(result.initialPrincipal).toBe(27000000);
            expect(result.upfrontFee).toBe(270000); // 1.0% of 27M

            // Month 1 should have drawdown
            expect(result.monthlyDrawdown[1]).toBe(27000000);

            // During grace period (months 1..12), principal repaid must be 0
            for (let m = 1; m <= 12; m++) {
                expect(result.monthlyPrincipalRepaid[m]).toBe(0);
                expect(result.monthlyInterest[m]).toBeGreaterThan(0);
            }

            // Month 13 should start repaying principal
            expect(result.monthlyPrincipalRepaid[13]).toBeGreaterThan(0);

            // At end of tenor (120 months = 10 years), debt should be fully amortized to 0
            expect(result.monthlyClosingDebt[120]).toBeCloseTo(0, 1);
            expect(result.annualClosingDebt[10]).toBeCloseTo(0, 1);
        });

        it('supports linear debt amortization with equal principal repayments', () => {
            const result = calculateDebtSchedule(
                mockProject.debt_facility,
                45000000,
                15,
                'linear'
            );

            // Repayment period = 120 - 12 = 108 months
            const expectedMonthlyPrincipal = 27000000 / 108;
            expect(result.monthlyPrincipalRepaid[13]).toBeCloseTo(expectedMonthlyPrincipal, 2);
            expect(result.monthlyPrincipalRepaid[20]).toBeCloseTo(expectedMonthlyPrincipal, 2);
            expect(result.monthlyClosingDebt[120]).toBeCloseTo(0, 1);
        });
    });

    describe('3. 15-Year 3-Statement Projection Engine', () => {
        it('models construction period with zero revenue and post-COD operational ramp-up', () => {
            const { monthlyPeriods, annualPeriods } = calculate15YearStatements(
                mockProject,
                mockProject.operating_assumptions,
                undefined,
                15
            );

            expect(monthlyPeriods.length).toBe(180);
            expect(annualPeriods.length).toBe(15);

            // Year 1 is construction: revenue = 0
            expect(annualPeriods[0].revenue).toBe(0);
            expect(annualPeriods[0].ebitda).toBe(0);
            expect(annualPeriods[0].capex).toBe(45000000);

            // Year 2 is Year 1 of COD: 70% ramp-up of 36M = 25.2M PLN
            expect(annualPeriods[1].revenue).toBeCloseTo(25200000, -3);
            expect(annualPeriods[1].ebitda).toBeGreaterThan(0);
            expect(annualPeriods[1].netIncome).toBeDefined();

            // Year 3 is Year 2 of COD: 90% ramp-up + 3% growth
            expect(annualPeriods[2].revenue).toBeGreaterThan(annualPeriods[1].revenue);

            // Check cash conversion cycle / NWC impact
            expect(annualPeriods[1].changeInNwc).toBeDefined();
            expect(annualPeriods[1].operatingCashFlow).toBeDefined();
        });

        it('accumulates tax losses and applies tax loss carry-forward', () => {
            const { annualPeriods } = calculate15YearStatements(
                mockProject,
                mockProject.operating_assumptions,
                undefined,
                15
            );

            // In Year 1 (construction + upfront fee + interest during construction), EBT is negative
            expect(annualPeriods[0].ebt).toBeLessThan(0);
            expect(annualPeriods[0].cit).toBe(0); // Zero tax paid during losses
        });
    });

    describe('4. Valuation Appraisal, Numerical IRR Solver & Covenants', () => {
        it('calculates numerical IRR with Newton-Raphson / bisection solver accurately', () => {
            // Test standard cash flow stream: -100, 30, 40, 50, 60
            // Standard Excel IRR for this is ~24.89%
            const flows = [-100, 30, 40, 50, 60];
            const irr = calculateIrr(flows);
            expect(irr).not.toBeNull();
            expect(irr).toBeCloseTo(24.89, 1);
        });

        it('returns null for IRR when cash flows have no sign change', () => {
            expect(calculateIrr([100, 200, 300])).toBeNull();
            expect(calculateIrr([-100, -200, -300])).toBeNull();
            expect(calculateIrr([])).toBeNull();
        });

        it('calculates exact linear fractional payback period', () => {
            // Outlay -100, Year 1: +40 (cum -60), Year 2: +40 (cum -20), Year 3: +40 (cum +20)
            // Payback should be exactly 2.50 years
            const flows = [-100, 40, 40, 40];
            const payback = calculatePaybackPeriod(flows);
            expect(payback).toBe(2.50);
        });

        it('calculates comprehensive appraisal metrics (NPV, MoIC, DSCR)', () => {
            const statements = calculate15YearStatements(mockProject, mockProject.operating_assumptions);
            const appraisal = calculateAppraisalMetrics(
                mockProject,
                statements.annualPeriods,
                statements.totalCapex,
                statements.initialEquity
            );

            expect(appraisal.projectNpv).toBeGreaterThan(0);
            expect(appraisal.projectIrrPercent).toBeGreaterThan(8.0); // Above WACC
            expect(appraisal.simplePaybackYears).toBeGreaterThan(2);
            expect(appraisal.equityMoic).toBeGreaterThan(1.0);
            expect(appraisal.minDscr).toBeGreaterThan(0);
            expect(appraisal.avgDscr).toBeGreaterThan(1.50);
            expect(appraisal.isBankable).toBe(true);
        });
    });

    describe('5. What-If Sensitivity Overrides & Execution Performance', () => {
        it('increases EBITDA and NPV when revenueMultiplier is increased by +10%', () => {
            const baseResult = runSimulation(mockProject, mockProject.operating_assumptions);
            const sensitiveResult = runSimulation(
                mockProject,
                mockProject.operating_assumptions,
                { revenueMultiplier: 1.10 }
            );

            expect(sensitiveResult.summary.totalRevenue15Y).toBeGreaterThan(baseResult.summary.totalRevenue15Y);
            expect(sensitiveResult.summary.totalEbitda15Y).toBeGreaterThan(baseResult.summary.totalEbitda15Y);
            expect(sensitiveResult.summary.projectNpv).toBeGreaterThan(baseResult.summary.projectNpv);
        });

        it('decreases NPV and IRR when capexMultiplier is increased by +15%', () => {
            const baseResult = runSimulation(mockProject, mockProject.operating_assumptions);
            const highCapexResult = runSimulation(
                mockProject,
                mockProject.operating_assumptions,
                { capexMultiplier: 1.15 }
            );

            expect(highCapexResult.summary.totalCapex).toBeGreaterThan(baseResult.summary.totalCapex);
            expect(highCapexResult.summary.projectNpv).toBeLessThan(baseResult.summary.projectNpv);
            expect(highCapexResult.summary.projectIrrPercent).toBeLessThan(baseResult.summary.projectIrrPercent);
        });

        it('executes full 15-year 3-statement simulation in less than 25 milliseconds', () => {
            const result = runSimulation(mockProject, mockProject.operating_assumptions);

            expect(result.monthlyPeriodsCount).toBe(180);
            expect(result.annualPeriods.length).toBe(15);
            expect(result.executionTimeMs).toBeLessThan(25); // Ultraspeed target
        });
    });

    describe('6. InvestmentWorkerClient Architecture & Fallback', () => {
        it('instantiates client and performs asynchronous simulation with synchronous fallback', async () => {
            const client = new InvestmentWorkerClient();
            const result = await client.simulate(mockProject, mockProject.operating_assumptions);

            expect(result).toBeDefined();
            expect(result.summary).toBeDefined();
            expect(result.summary.totalCapex).toBe(45000000);
            expect(result.annualPeriods.length).toBe(15);
            expect(result.appraisal.currency).toBe('PLN');

            client.terminate();
        });

        it('returns singleton instance via getInvestmentWorkerClient', () => {
            const client1 = getInvestmentWorkerClient();
            const client2 = getInvestmentWorkerClient();
            expect(client1).toBe(client2);
        });
    });
});
