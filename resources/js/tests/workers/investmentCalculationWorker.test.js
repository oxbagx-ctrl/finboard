import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    calculateDepreciationSchedule,
    calculateDebtSchedule,
    calculate15YearStatements,
    calculateIrr,
    calculatePaybackPeriod,
    calculateAppraisalMetrics,
    runSimulation,
    TaxLossVintage,
    TaxLossPool,
    calculateBankingCovenants,
    calculateEquityCureRequirement
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

    describe('7. Cyclical Reinvestment CAPEX (Nakłady A, B, C) & KŚT Schedule (Phase 43 Commit 214)', () => {
        const mockReinvestments = [
            {
                id: 'prog-a',
                program_type: 'program_a',
                name: 'Nakład A (IT / SCADA)',
                enabled: true,
                net_amount: 1500000,
                frequency_years: 5,
                first_occurrence_year: 5,
                kst_code: 'KST_IT',
                kst_annual_rate: 30.0,
            },
            {
                id: 'prog-b',
                program_type: 'program_b',
                name: 'Nakład B (Maszyny)',
                enabled: true,
                net_amount: 4000000,
                frequency_years: 7,
                first_occurrence_year: 7,
                kst_code: 'KST_4',
                kst_annual_rate: 10.0,
            },
            {
                id: 'prog-c',
                program_type: 'program_c',
                name: 'Nakład C (Tabor)',
                enabled: true,
                net_amount: 2000000,
                frequency_years: 5,
                first_occurrence_year: 5,
                kst_code: 'KST_7',
                kst_annual_rate: 20.0,
            }
        ];

        it('schedules reinvestment capex in specific years and calculates initial vs reinvestment capex', () => {
            const assumptionsWithReinvest = {
                ...mockProject.operating_assumptions,
                reinvestment_programs: mockReinvestments
            };

            const statements = calculate15YearStatements(mockProject, assumptionsWithReinvest);

            // Initial Capex is 45,000,000 PLN
            expect(statements.initialCapex).toBe(45000000);

            // In 15 years:
            // Prog A: Y5, Y10, Y15 = 3 * 1.5M = 4.5M
            // Prog B: Y7, Y14 = 2 * 4.0M = 8.0M
            // Prog C: Y5, Y10, Y15 = 3 * 2.0M = 6.0M
            // Total Reinvestment Capex = 18.5M
            expect(statements.totalReinvestmentCapex).toBe(18500000);
            expect(statements.totalCapex).toBe(45000000 + 18500000);

            // Year 5 has Prog A (1.5M) + Prog C (2.0M) = 3.5M
            expect(statements.annualPeriods[4].capex).toBe(3500000);

            // Year 7 has Prog B (4.0M)
            expect(statements.annualPeriods[6].capex).toBe(4000000);

            // Year 10 has Prog A (1.5M) + Prog C (2.0M) = 3.5M
            expect(statements.annualPeriods[9].capex).toBe(3500000);
        });

        it('capitalizes reinvested assets and increases depreciation in following periods according to KŚT rate', () => {
            const assumptionsWithout = {
                ...mockProject.operating_assumptions,
                reinvestment_programs: []
            };
            const assumptionsWith = {
                ...mockProject.operating_assumptions,
                reinvestment_programs: mockReinvestments
            };

            const resWithout = runSimulation(mockProject, assumptionsWithout);
            const resWith = runSimulation(mockProject, assumptionsWith);

            // In Year 6 (following Year 5 reinvestment of 3.5M PLN), depreciation should be higher
            const depYear6Without = resWithout.annualPeriods[5].depreciation;
            const depYear6With = resWith.annualPeriods[5].depreciation;

            expect(depYear6With).toBeGreaterThan(depYear6Without);
        });

        it('scales reinvestment capex proportionately when reinvestmentMultiplier is applied or disabled', () => {
            const assumptionsWith = {
                ...mockProject.operating_assumptions,
                reinvestment_programs: mockReinvestments
            };

            const resNormal = runSimulation(mockProject, assumptionsWith);
            const resScaled = runSimulation(mockProject, assumptionsWith, { reinvestmentMultiplier: 1.20 }); // +20%
            const resDisabled = runSimulation(mockProject, assumptionsWith, { reinvestmentsEnabled: false });

            expect(resScaled.summary.totalReinvestmentCapex).toBe(Math.round(18500000 * 1.20));
            expect(resDisabled.summary.totalReinvestmentCapex).toBe(0);
            expect(resDisabled.summary.totalCapex).toBe(45000000);
        });
    });

    describe('6. TaxLossVintage & TaxLossPool Pure Logic (art. 7 ust. 5 CIT Parity)', () => {
        it('initializes vintage with statutory 5-year expiration window (T+5)', () => {
            const vintage = TaxLossVintage.create(1, 1000000);

            expect(vintage.originYear).toBe(1);
            expect(vintage.expiryYear).toBe(6); // 1 + 5
            expect(vintage.initialAmount).toBe(1000000);
            expect(vintage.remainingAmount).toBe(1000000);
            expect(vintage.settledAmount).toBe(0);
            expect(vintage.hasUsedOneOffDeduction).toBe(false);

            // In Year 1 (origin year), not available
            expect(vintage.isAvailable(1)).toBe(false);
            expect(vintage.isExpired(1)).toBe(false);

            // Available in Years 2 through 6
            for (let y = 2; y <= 6; y++) {
                expect(vintage.isAvailable(y)).toBe(true);
                expect(vintage.isExpired(y)).toBe(false);
            }

            // In Year 7 (7 > 6), expired permanently
            expect(vintage.isAvailable(7)).toBe(false);
            expect(vintage.isExpired(7)).toBe(true);
        });

        it('limits annual deduction to 50% of initial loss under standard_loss_cap', () => {
            const vintage = TaxLossVintage.create(1, 1000000);

            // Year 2: max 50% of 1,000,000 = 500,000 PLN
            const maxDeductibleY2 = vintage.maxDeductibleInYear(2, 'standard_loss_cap', 50.0);
            expect(maxDeductibleY2).toBe(500000);

            // Settle 400,000 PLN
            const vAfterY2 = vintage.settle(400000);
            expect(vAfterY2.remainingAmount).toBe(600000);
            expect(vAfterY2.settledAmount).toBe(400000);

            // Year 3: max is still 50% of initial loss (500,000), even though 600,000 remains
            const maxDeductibleY3 = vAfterY2.maxDeductibleInYear(3, 'standard_loss_cap', 50.0);
            expect(maxDeductibleY3).toBe(500000);

            // Settle 500,000 PLN
            const vAfterY3 = vAfterY2.settle(500000);
            expect(vAfterY3.remainingAmount).toBe(100000);

            // Year 4: remaining is 100,000, which is below 500,000 cap
            const maxDeductibleY4 = vAfterY3.maxDeductibleInYear(4, 'standard_loss_cap', 50.0);
            expect(maxDeductibleY4).toBe(100000);
        });

        it('allows one-off deduction up to 5M PLN under one_off_5m mode', () => {
            // Case A: Loss <= 5M (e.g. 3,500,000 PLN) -> 100% deductible in one year
            const vintageA = TaxLossVintage.create(1, 3500000);
            const maxDedA = vintageA.maxDeductibleInYear(2, 'one_off_5m');
            expect(maxDedA).toBe(3500000);

            // Case B: Loss > 5M (e.g. 8,000,000 PLN) -> max 5,000,000 PLN in one-off year
            const vintageB = TaxLossVintage.create(1, 8000000);
            const maxDedB = vintageB.maxDeductibleInYear(2, 'one_off_5m');
            expect(maxDedB).toBe(5000000);

            // Settle 5M using one-off
            const vAfterOneOff = vintageB.settle(5000000, true);
            expect(vAfterOneOff.hasUsedOneOffDeduction).toBe(true);
            expect(vAfterOneOff.remainingAmount).toBe(3000000);

            // Year 3: subsequent deduction reverts to 50% of initial loss (4,000,000 PLN), bounded by remaining (3,000,000 PLN)
            const maxDedY3 = vAfterOneOff.maxDeductibleInYear(3, 'one_off_5m');
            expect(maxDedY3).toBe(3000000);
        });

        it('performs FIFO settlement across multiple vintages in TaxLossPool', () => {
            const pool = TaxLossPool.empty()
                .addLoss(1, 400000)  // Vintage Y1: 50% cap = 200k/yr
                .addLoss(2, 600000); // Vintage Y2: 50% cap = 300k/yr

            expect(pool.openingBalance(3)).toBe(1000000);

            // In Year 3, 500,000 PLN profit generated
            const outcome = pool.settle(3, 500000, 'standard_loss_cap');
            const { result, pool: updatedPool } = outcome;

            // FIFO: Y1 contributes 200k (50% cap), Y2 contributes 300k (50% cap) -> total = 500k
            expect(result.lossDeducted).toBe(500000);
            expect(result.taxableIncomeAfterDeduction).toBe(0);
            expect(result.lossExpired).toBe(0);
            expect(result.settlementDetails.length).toBe(2);
            expect(result.settlementDetails[0].vintage_year).toBe(1);
            expect(result.settlementDetails[0].deducted).toBe(200000);
            expect(result.settlementDetails[1].vintage_year).toBe(2);
            expect(result.settlementDetails[1].deducted).toBe(300000);

            // Closing pool: 200k remaining in Y1 + 300k remaining in Y2 = 500k
            expect(updatedPool.closingBalance(3)).toBe(500000);
        });

        it('purges unutilized tax losses upon 5-year expiration in Year 7 (T+5)', () => {
            let pool = TaxLossPool.empty().addLoss(1, 1000000);

            // Year 2: deduct 300,000 PLN
            const y2 = pool.settle(2, 300000);
            pool = y2.pool;
            expect(pool.closingBalance(2)).toBe(700000);

            // Years 3, 4, 5, 6: No profit
            for (let y = 3; y <= 6; y++) {
                const yOutcome = pool.settle(y, 0);
                pool = yOutcome.pool;
                expect(yOutcome.result.lossExpired).toBe(0);
                expect(pool.closingBalance(y)).toBe(700000);
            }

            // In Year 7 (currentYear 7 > expiryYear 6):
            // The remaining 700,000 PLN must expire permanently!
            const y7 = pool.settle(7, 500000);
            expect(y7.result.lossExpired).toBe(700000);
            expect(y7.result.lossDeducted).toBe(0); // Expired loss cannot be deducted
            expect(y7.result.taxableIncomeAfterDeduction).toBe(500000);
            expect(y7.pool.closingBalance(7)).toBe(0);
        });
    });

    describe('7. Web Worker CIT & Tax Loss Parity (Phase 49 Commit 242)', () => {
        it('compares standard_loss_cap vs one_off_5m settlement in 15-year 3-statement simulation', () => {
            const assumptionsStandard = {
                ...mockProject.operating_assumptions,
                tax_loss_carry_forward_enabled: true,
                tax_loss_settlement_mode: 'standard_loss_cap',
                tax_loss_offset_cap_percent: 50.0
            };

            const assumptionsOneOff = {
                ...mockProject.operating_assumptions,
                tax_loss_carry_forward_enabled: true,
                tax_loss_settlement_mode: 'one_off_5m',
                tax_loss_offset_cap_percent: 50.0,
                tax_loss_one_off_cap_amount: 5000000.0
            };

            const statementsStd = calculate15YearStatements(mockProject, assumptionsStandard);
            const statementsOneOff = calculate15YearStatements(mockProject, assumptionsOneOff);

            // In Year 1, project has negative EBT (construction interest/fees)
            expect(statementsStd.annualPeriods[0].ebt).toBeLessThan(0);
            expect(statementsStd.annualPeriods[0].cit).toBe(0);
            expect(statementsOneOff.annualPeriods[0].cit).toBe(0);

            const year1Loss = Math.abs(statementsStd.annualPeriods[0].ebt);
            expect(year1Loss).toBeGreaterThan(0);

            // Year 2 has substantial operational profit
            // Under one_off_5m, the project can offset up to 5M PLN (or 100% of loss if <= 5M)
            // Under standard_loss_cap, it is capped at 50% of Year 1 loss
            expect(statementsOneOff.annualPeriods[1].taxLossUsed).toBeGreaterThanOrEqual(
                statementsStd.annualPeriods[1].taxLossUsed
            );

            // Consequently, CIT paid in Year 2 is less than or equal under one_off_5m
            expect(statementsOneOff.annualPeriods[1].cit).toBeLessThanOrEqual(
                statementsStd.annualPeriods[1].cit
            );
        });

        it('verifies monthly YTD CIT advances sum exactly to annual CIT (art. 25 ust. 1 CIT)', () => {
            const statements = calculate15YearStatements(mockProject, {
                ...mockProject.operating_assumptions,
                tax_loss_settlement_mode: 'one_off_5m'
            });

            const { monthlyPeriods, annualPeriods } = statements;

            for (let y = 1; y <= 15; y++) {
                const yearMonths = monthlyPeriods.filter(m => m.year === y);
                expect(yearMonths.length).toBe(12);

                const sumMonthlyCit = yearMonths.reduce((sum, m) => sum + m.cit, 0);
                const sumMonthlyNetIncome = yearMonths.reduce((sum, m) => sum + m.netIncome, 0);
                const sumMonthlyEbt = yearMonths.reduce((sum, m) => sum + m.ebt, 0);

                const annualP = annualPeriods[y - 1];

                // Check non-negative monthly advances
                yearMonths.forEach(m => {
                    expect(m.cit).toBeGreaterThanOrEqual(0);
                });

                // Perfect sum equality between monthly advances and annual statement
                expect(sumMonthlyCit).toBeCloseTo(annualP.cit, 2);
                expect(sumMonthlyEbt).toBeCloseTo(annualP.ebt, 2);
                expect(sumMonthlyNetIncome).toBeCloseTo(annualP.netIncome, 2);
            }
        });

        it('includes taxLossCarryForwardOpening, taxLossExpired, taxLossUsed, and taxLossCarryForwardClosing metadata', () => {
            const statements = calculate15YearStatements(mockProject, {
                ...mockProject.operating_assumptions,
                tax_loss_settlement_mode: 'standard_loss_cap'
            });

            // Check metadata fields exist on annual periods
            statements.annualPeriods.forEach(p => {
                expect(p.taxLossCarryForwardOpening).toBeDefined();
                expect(p.taxLossExpired).toBeDefined();
                expect(p.taxLossUsed).toBeDefined();
                expect(p.taxLossCarryForwardClosing).toBeDefined();
                expect(p.taxableIncome).toBeDefined();
            });

            // Check metadata fields exist on monthly periods
            statements.monthlyPeriods.forEach(m => {
                expect(m.taxLossCarryForwardOpening).toBeDefined();
                expect(m.taxLossExpired).toBeDefined();
                expect(m.taxLossUsed).toBeDefined();
                expect(m.taxLossCarryForwardClosing).toBeDefined();
                expect(m.taxableIncome).toBeDefined();
            });
        });
    });

    describe("8. EU Grants Disbursement Schedule & Cash Flow Parity (Phase 51 Commit 246)", () => {
        it("incorporates grant disbursement schedule into monthly and annual financing cash flow", () => {
            const projectWithGrants = {
                ...mockProject,
                capex_stages: [
                    {
                        id: "stage-1",
                        stage_name: "Hala produkcyjna",
                        net_amount: 12000000,
                        start_date: "2026-01-01",
                        duration_months: 6,
                        kst_code: "KST_1",
                        kst_annual_rate: 2.5
                    },
                    {
                        id: "stage-2",
                        stage_name: "Park maszynowy",
                        net_amount: 12000000,
                        start_date: "2026-03-01",
                        duration_months: 6,
                        kst_code: "KST_4",
                        kst_annual_rate: 10.0
                    },
                    {
                        id: "stage-3",
                        stage_name: "Infrastruktura OZE",
                        net_amount: 8000000,
                        start_date: "2026-06-01",
                        duration_months: 4,
                        kst_code: "KST_3",
                        kst_annual_rate: 7.0
                    }
                ],
                debt_facility: {
                    ...mockProject.debt_facility,
                    principal_amount: 14000000,
                    upfront_fee_percent: 0,
                },
                financing_structure: {
                    investor1_equity: 8000000,
                    investor2_equity: 0,
                    bank_loan_amount: 14000000,
                    debt_facility_amount: 14000000,
                    grant_amount: 10000000,
                    grant_disbursement_schedule: [
                        { tranche_number: 1, amount: 4000000, month: 3, milestone: "Fundamenty" },
                        { tranche_number: 2, amount: 6000000, month: 8, milestone: "Konstrukcja" },
                    ]
                }
            };

            const statements = calculate15YearStatements(projectWithGrants);

            // Month 3 should have 4M grant
            const month3 = statements.monthlyPeriods.find(p => p.period === 3);
            expect(month3).toBeDefined();
            expect(month3.grantReceived).toBe(4000000);
            expect(month3.financingCashFlow).toBeGreaterThanOrEqual(4000000);

            // Month 8 should have 6M grant
            const month8 = statements.monthlyPeriods.find(p => p.period === 8);
            expect(month8).toBeDefined();
            expect(month8.grantReceived).toBe(6000000);

            // Year 1 annual statement should have 10M total grant received
            const year1 = statements.annualPeriods[0];
            expect(year1.grantReceived).toBe(10000000);

            // Without grant funding, cash would have a 10M PLN deficit
            const projectWithoutGrants = {
                ...projectWithGrants,
                financing_structure: {
                    ...projectWithGrants.financing_structure,
                    grant_amount: 0,
                    grant_disbursement_schedule: []
                }
            };
            const statementsNoGrants = calculate15YearStatements(projectWithoutGrants);
            const cashDifference = year1.closingCash - statementsNoGrants.annualPeriods[0].closingCash;
            expect(cashDifference).toBeCloseTo(10000000, 2);
        });

        it("falls back to eligible capex stages when grant_disbursement_schedule is omitted but grant_amount > 0", () => {
            const projectWithFallbackGrants = {
                ...mockProject,
                financing_structure: {
                    investor1_equity: 8000000,
                    bank_loan_amount: 14000000,
                    grant_amount: 10000000,
                },
                capex_stages: [
                    {
                        id: "stage-1",
                        stage_name: "Budynek A",
                        net_amount: 20000000,
                        start_date: "2026-01-01",
                        duration_months: 6,
                        is_grant_eligible: true,
                        grant_eligible_amount: 15000000,
                    },
                    {
                        id: "stage-2",
                        stage_name: "Instalacja B",
                        net_amount: 12000000,
                        start_date: "2026-04-01",
                        duration_months: 6,
                        is_grant_eligible: true,
                        grant_eligible_amount: 15000000,
                    }
                ]
            };

            const statements = calculate15YearStatements(projectWithFallbackGrants);
            const totalGrantsReceived = statements.annualPeriods.reduce((sum, p) => sum + (p.grantReceived || 0), 0);
            expect(totalGrantsReceived).toBe(10000000);
        });
    });
    describe('8. LMA Banking Covenants, LLCR, DSRA & Equity Cure Simulator (Phase 51 Commit 247)', () => {
        it('segregates DSRA reserve from unrestricted free cash on balance sheet', () => {
            const statements = calculate15YearStatements(mockProject, mockProject.operating_assumptions);
            
            // Check monthly periods
            statements.monthlyPeriods.forEach(m => {
                expect(m.dsraReserve).toBeDefined();
                expect(m.freeCash).toBeDefined();
                expect(m.dsraReserve).toBeGreaterThanOrEqual(0);
                expect(m.freeCash).toBeGreaterThanOrEqual(0);
                if (m.closingCash >= 0) {
                    expect(Math.round((m.dsraReserve + m.freeCash) * 100) / 100).toBeCloseTo(m.closingCash, 1);
                } else {
                    expect(m.dsraReserve).toBe(0);
                    expect(m.freeCash).toBe(0);
                }
            });

            // Check annual periods
            statements.annualPeriods.forEach(p => {
                expect(p.dsraReserve).toBeDefined();
                expect(p.freeCash).toBeDefined();
                expect(p.dsraReserve).toBeGreaterThanOrEqual(0);
                expect(p.freeCash).toBeGreaterThanOrEqual(0);
                if (p.closingCash >= 0) {
                    expect(Math.round((p.dsraReserve + p.freeCash) * 100) / 100).toBeCloseTo(p.closingCash, 1);
                }
                
                // When debt is zero, DSRA reserve is released to 0
                if (p.closingDebt === 0) {
                    expect(p.dsraReserve).toBe(0);
                    expect(p.freeCash).toBeCloseTo(p.closingCash, 2);
                }
            });
        });

        it('calculates LLCR (Loan Life Coverage Ratio) according to LMA Project Finance standard', () => {
            const statements = calculate15YearStatements(mockProject, mockProject.operating_assumptions);
            const covenants = calculateBankingCovenants(statements.annualPeriods, { minLlcr: 1.35 }, 'PLN', {
                costOfDebtPercent: 8.0
            });

            expect(covenants.summary.minLlcr).toBeDefined();
            expect(covenants.summary.avgLlcr).toBeDefined();
            expect(covenants.summary.minLlcr).toBeGreaterThan(0);
            expect(covenants.summary.avgLlcr).toBeGreaterThanOrEqual(covenants.summary.minLlcr);

            // Commercial periods with active debt should have valid LLCR and DSRA metrics
            const debtPeriods = covenants.yearlyMetrics.filter(m => m.isCommercial && m.hasDebtService && m.closingDebt > 0);
            expect(debtPeriods.length).toBeGreaterThan(0);
            debtPeriods.forEach(m => {
                expect(m.llcr).not.toBeNull();
                expect(m.llcrStatus).toBeDefined();
                expect(m.dsraRequired).toBeGreaterThan(0);
                expect(m.dsraReserve).toBeGreaterThanOrEqual(0);
                expect(m.freeCash).toBeGreaterThanOrEqual(0);
            });
        });

        it('simulates Equity Cure requirement and Deal Advisory recommendations upon covenant breach', () => {
            const statements = calculate15YearStatements(mockProject, mockProject.operating_assumptions);
            
            // Apply strict stress thresholds forcing breaches
            const stressThresholds = {
                minDscr: 2.50,
                minLlcr: 2.50,
                minIcr: 5.00,
                maxLeverage: 1.50,
                minCurrentRatio: 2.00,
                minDsrfMonths: 12
            };

            const covenants = calculateBankingCovenants(statements.annualPeriods, stressThresholds, 'PLN');
            
            expect(covenants.summary.isBankable).toBe(false);
            expect(covenants.summary.bankabilityStatus).toBe('breach');
            expect(covenants.summary.equityCure).toBeDefined();
            expect(covenants.summary.equityCure.isCureNeeded).toBe(true);
            expect(covenants.summary.equityCure.totalEquityCureRequired).toBeGreaterThan(0);
            expect(covenants.summary.equityCure.peakAnnualCure).toBeGreaterThan(0);
            expect(covenants.summary.equityCure.curesByYear.length).toBeGreaterThan(0);
            expect(covenants.summary.equityCure.recommendations.length).toBeGreaterThanOrEqual(3);
            expect(covenants.summary.equityCure.recommendations[0]).toContain('Equity Cure');
        });

        it('issues LMA Bankability Certificate when project covenants are fully compliant', () => {
            const safeProject = {
                ...mockProject,
                capex_stages: [
                    { id: 'stage-civil', stage_name: 'Hala', net_amount: 10000000, start_date: '2026-01-01', duration_months: 6, kst_code: 'KST_1', kst_annual_rate: 2.5 }
                ],
                debt_facility: {
                    principal_amount: 2000000,
                    base_interest_rate_percent: 4.0,
                    margin_percent: 1.5,
                    upfront_fee_percent: 0.5,
                    tenor_months: 60,
                    grace_period_months: 12,
                    repayment_type: 'annuity'
                },
                financing_structure: {
                    investor1_equity: 10000000,
                    debt_facility_amount: 2000000,
                },
                operating_assumptions: {
                    annual_revenue_base: 40000000,
                    revenue_growth_rate_percent: 3.0,
                    variable_cost_percent: 20.0,
                    annual_fixed_costs_base: 2000000,
                    fixed_cost_growth_rate_percent: 2.0,
                    annual_payroll_base: 2000000,
                    payroll_growth_rate_percent: 2.0,
                    capacity_ramp_up: { year1_percent: 100.0, year2_percent: 100.0, year3_percent: 100.0 },
                    cit_rate_percent: 19.0,
                    working_capital: { receivables_days: 15, inventory_days: 15, payables_days: 15 }
                }
            };

            const statements = calculate15YearStatements(safeProject, safeProject.operating_assumptions);
            const covenants = calculateBankingCovenants(statements.annualPeriods, {
                minDscr: 1.10,
                minLlcr: 1.15,
                minIcr: 2.00,
                maxLeverage: 4.00,
                minCurrentRatio: 1.00,
                minDsrfMonths: 3
            }, 'PLN');

            expect(covenants.summary.isBankable).toBe(true);
            expect(covenants.summary.bankabilityStatus).toBe('compliant');
            expect(covenants.summary.equityCure.isCureNeeded).toBe(false);
            expect(covenants.summary.equityCure.totalEquityCureRequired).toBe(0);
            expect(covenants.summary.equityCure.recommendations[0]).toContain('Certyfikat Bankowalności LMA');
        });
    });
});
