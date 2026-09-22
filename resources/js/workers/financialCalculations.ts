/**
 * FinBoard Financial Engineering & Calculation Engine
 * Pure mathematical routines for 15-Year 3-Statement Projection, DCF, and Covenants
 */

import {
    InvestmentProjectInput,
    OperatingAssumptionsInput,
    WhatIfOverrides,
    CapexStageInput,
    DebtFacilityInput,
    ReinvestmentProgramInput,
    MonthlyStatementPeriod,
    AnnualStatementPeriod,
    AppraisalMetrics,
    SimulationResult
} from './types';

// Standard Polish KŚT Asset Depreciation Rates (% per year)
export const KST_RATES: Record<string, number> = {
    'KST_0': 0.0,   // Land (not depreciated)
    'KST_1': 2.5,   // Industrial buildings
    'KST_2': 4.5,   // Civil engineering structures
    'KST_3': 7.0,   // Boilers & energy machinery
    'KST_4': 10.0,  // General machinery & apparatus
    'KST_5': 14.0,  // Specialized tech lines
    'KST_6': 10.0,  // Technical networks & utilities
    'KST_7': 20.0,  // Transport equipment & vehicles
    'KST_8': 20.0,  // Tools & equipment
    'KST_IT': 30.0, // Computer hardware & software
};

/**
 * Calculate Monthly & Annual KŚT Asset Depreciation Schedule
 */
export function calculateDepreciationSchedule(
    stages: CapexStageInput[] = [],
    projectStartDateStr: string = '2026-01-01',
    horizonYears: number = 15,
    capexMultiplier: number = 1.0,
    reinvestments: ReinvestmentProgramInput[] = [],
    reinvestmentMultiplier: number = 1.0,
    reinvestmentsEnabled: boolean = true
): {
    monthlyDepreciation: number[];
    monthlyCapex: number[];
    monthlyReinvestmentCapex: number[];
    annualDepreciation: number[];
    annualCapex: number[];
    annualReinvestmentCapex: number[];
    totalCapex: number;
    initialCapex: number;
    totalReinvestmentCapex: number;
} {
    const totalMonths = horizonYears * 12;
    const monthlyDepreciation = new Array(totalMonths + 1).fill(0);
    const monthlyCapex = new Array(totalMonths + 1).fill(0);
    const monthlyReinvestmentCapex = new Array(totalMonths + 1).fill(0);

    const projectStart = new Date(projectStartDateStr);
    const startYear = projectStart.getFullYear() || 2026;
    const startMonth = projectStart.getMonth() || 0; // 0-based

    let initialCapex = 0;

    // 1. Initial Construction CAPEX Stages
    for (const stage of stages) {
        const baseAmount = typeof stage.net_amount === 'string'
            ? parseFloat(stage.net_amount) || 0
            : Number(stage.net_amount) || 0;
        const netAmount = baseAmount * (capexMultiplier > 0 ? capexMultiplier : 1.0);
        initialCapex += netAmount;

        const duration = Math.max(1, Math.min(120, parseInt(String(stage.duration_months || 6), 10)));
        const stageStart = stage.start_date ? new Date(stage.start_date) : projectStart;
        
        const stageStartYear = stageStart.getFullYear() || startYear;
        const stageStartMonth = stageStart.getMonth() || 0;

        // Calculate offset in months from project start (1-based index)
        const monthOffset = (stageStartYear - startYear) * 12 + (stageStartMonth - startMonth);
        const stageFirstMonth = Math.max(1, monthOffset + 1);

        // Distribute CAPEX evenly across duration
        const capexPerMonth = netAmount / duration;
        for (let d = 0; d < duration; d++) {
            const m = stageFirstMonth + d;
            if (m <= totalMonths) {
                monthlyCapex[m] += capexPerMonth;
            }
        }

        // OT (Acceptance to service) is the month following the completion of capex
        const otMonth = stageFirstMonth + duration; // month in which asset is placed in service
        const firstDepMonth = otMonth + 1;         // depreciation starts next month

        // Determine annual depreciation rate
        const kstCode = stage.kst_code || 'KST_4';
        const ratePercent = stage.kst_annual_rate !== undefined
            ? Number(stage.kst_annual_rate)
            : (KST_RATES[kstCode] !== undefined ? KST_RATES[kstCode] : 10.0);

        if (ratePercent > 0 && firstDepMonth <= totalMonths) {
            const monthlyRate = (ratePercent / 100.0) / 12.0;
            const standardMonthlyCharge = netAmount * monthlyRate;
            let remainingBookValue = netAmount;

            for (let m = firstDepMonth; m <= totalMonths; m++) {
                if (remainingBookValue <= 0.0001) break;
                const charge = Math.min(standardMonthlyCharge, remainingBookValue);
                monthlyDepreciation[m] += charge;
                remainingBookValue -= charge;
            }
        }
    }

    let totalCapex = initialCapex;
    let totalReinvestmentCapex = 0;

    // 2. Cyclical Reinvestment Programs (Replacement CAPEX: Nakłady A, B, C)
    if (reinvestmentsEnabled && reinvestments && reinvestments.length > 0) {
        for (const prog of reinvestments) {
            if (prog.enabled === false) continue;

            const baseReinvestAmount = typeof prog.net_amount === 'string'
                ? parseFloat(prog.net_amount) || 0
                : Number(prog.net_amount) || 0;
            const netReinvestAmount = baseReinvestAmount * (reinvestmentMultiplier > 0 ? reinvestmentMultiplier : 1.0);
            if (netReinvestAmount <= 0) continue;

            // Determine occurrence years
            let occurrenceYears: number[] = [];
            if (prog.specific_years && Array.isArray(prog.specific_years) && prog.specific_years.length > 0) {
                occurrenceYears = prog.specific_years.filter(y => y >= 1 && y <= horizonYears);
            } else {
                const firstYr = Math.max(1, Math.min(horizonYears, Number(prog.first_occurrence_year || 5)));
                const freq = Math.max(1, Math.min(horizonYears, Number(prog.frequency_years || 5)));
                for (let yr = firstYr; yr <= horizonYears; yr += freq) {
                    occurrenceYears.push(yr);
                }
            }

            const kstCode = prog.kst_code || 'KST_4';
            const ratePercent = prog.kst_annual_rate !== undefined
                ? Number(prog.kst_annual_rate)
                : (KST_RATES[kstCode] !== undefined ? KST_RATES[kstCode] : 10.0);
            const monthlyRate = (ratePercent / 100.0) / 12.0;
            const standardMonthlyCharge = netReinvestAmount * monthlyRate;

            for (const yr of occurrenceYears) {
                // Occurs in month 1 of operating year
                const m = (yr - 1) * 12 + 1;
                if (m <= totalMonths) {
                    monthlyCapex[m] += netReinvestAmount;
                    monthlyReinvestmentCapex[m] += netReinvestAmount;
                    totalCapex += netReinvestAmount;
                    totalReinvestmentCapex += netReinvestAmount;

                    // Asset enters service in month m, depreciation starts month m + 1
                    if (ratePercent > 0 && m + 1 <= totalMonths) {
                        let remainingBookValue = netReinvestAmount;
                        for (let dm = m + 1; dm <= totalMonths; dm++) {
                            if (remainingBookValue <= 0.0001) break;
                            const charge = Math.min(standardMonthlyCharge, remainingBookValue);
                            monthlyDepreciation[dm] += charge;
                            remainingBookValue -= charge;
                        }
                    }
                }
            }
        }
    }

    // Aggregate to annual figures (1..horizonYears)
    const annualDepreciation = new Array(horizonYears + 1).fill(0);
    const annualCapex = new Array(horizonYears + 1).fill(0);
    const annualReinvestmentCapex = new Array(horizonYears + 1).fill(0);

    for (let m = 1; m <= totalMonths; m++) {
        const y = Math.ceil(m / 12);
        annualDepreciation[y] += monthlyDepreciation[m];
        annualCapex[y] += monthlyCapex[m];
        annualReinvestmentCapex[y] += monthlyReinvestmentCapex[m];
    }

    return {
        monthlyDepreciation,
        monthlyCapex,
        monthlyReinvestmentCapex,
        annualDepreciation,
        annualCapex,
        annualReinvestmentCapex,
        totalCapex,
        initialCapex,
        totalReinvestmentCapex
    };
}

/**
 * Calculate Senior Debt & VAT Bridge Loan Schedules
 */
export function calculateDebtSchedule(
    facility: DebtFacilityInput | null | undefined,
    totalCapex: number,
    horizonYears: number = 15,
    repaymentTypeOverride?: 'annuity' | 'linear' | 'bullet' | null
): {
    initialPrincipal: number;
    monthlyInterest: number[];
    monthlyPrincipalRepaid: number[];
    monthlyDrawdown: number[];
    monthlyClosingDebt: number[];
    upfrontFee: number;
    annualInterest: number[];
    annualPrincipalRepaid: number[];
    annualClosingDebt: number[];
} {
    const totalMonths = horizonYears * 12;
    const monthlyInterest = new Array(totalMonths + 1).fill(0);
    const monthlyPrincipalRepaid = new Array(totalMonths + 1).fill(0);
    const monthlyDrawdown = new Array(totalMonths + 1).fill(0);
    const monthlyClosingDebt = new Array(totalMonths + 1).fill(0);

    if (!facility || Number(facility.principal_amount) <= 0) {
        return {
            initialPrincipal: 0,
            monthlyInterest,
            monthlyPrincipalRepaid,
            monthlyDrawdown,
            monthlyClosingDebt,
            upfrontFee: 0,
            annualInterest: new Array(horizonYears + 1).fill(0),
            annualPrincipalRepaid: new Array(horizonYears + 1).fill(0),
            annualClosingDebt: new Array(horizonYears + 1).fill(0)
        };
    }

    const principal = Number(facility.principal_amount);
    const baseRate = Number(facility.base_interest_rate_percent ?? 5.85);
    const margin = Number(facility.margin_percent ?? 2.50);
    const upfrontFeeRate = Number(facility.upfront_fee_percent ?? 1.0);
    const upfrontFee = principal * (upfrontFeeRate / 100.0);

    const tenorMonths = Math.max(1, Math.min(totalMonths, Number(facility.tenor_months ?? 120)));
    const graceMonths = Math.max(0, Math.min(tenorMonths - 1, Number(facility.grace_period_months ?? 12)));
    const repaymentMonths = tenorMonths - graceMonths;

    const repaymentType = repaymentTypeOverride || facility.repayment_type || 'annuity';
    const annualRate = (baseRate + margin) / 100.0;
    const monthlyRate = annualRate / 12.0;

    // Full drawdown in month 1
    monthlyDrawdown[1] = principal;
    let balance = principal;

    // Monthly annuity calculation
    let fixedAnnuityPayment = 0;
    if (repaymentType === 'annuity' && repaymentMonths > 0) {
        if (monthlyRate > 0) {
            fixedAnnuityPayment = principal * (monthlyRate * Math.pow(1 + monthlyRate, repaymentMonths)) /
                (Math.pow(1 + monthlyRate, repaymentMonths) - 1);
        } else {
            fixedAnnuityPayment = principal / repaymentMonths;
        }
    }

    for (let m = 1; m <= totalMonths; m++) {
        if (balance <= 0.001) {
            monthlyClosingDebt[m] = 0;
            continue;
        }

        const interest = balance * monthlyRate;
        monthlyInterest[m] = interest;

        let principalRepaid = 0;
        if (m > graceMonths && m <= tenorMonths) {
            if (repaymentType === 'linear') {
                principalRepaid = principal / repaymentMonths;
            } else if (repaymentType === 'annuity') {
                principalRepaid = Math.max(0, fixedAnnuityPayment - interest);
            } else if (repaymentType === 'bullet') {
                if (m === tenorMonths) {
                    principalRepaid = balance;
                }
            }
        }

        principalRepaid = Math.min(principalRepaid, balance);
        monthlyPrincipalRepaid[m] = principalRepaid;
        balance -= principalRepaid;
        monthlyClosingDebt[m] = Math.max(0, balance);
    }

    // Aggregate to annual figures
    const annualInterest = new Array(horizonYears + 1).fill(0);
    const annualPrincipalRepaid = new Array(horizonYears + 1).fill(0);
    const annualClosingDebt = new Array(horizonYears + 1).fill(0);

    for (let m = 1; m <= totalMonths; m++) {
        const y = Math.ceil(m / 12);
        annualInterest[y] += monthlyInterest[m];
        annualPrincipalRepaid[y] += monthlyPrincipalRepaid[m];
        if (m % 12 === 0 || m === totalMonths) {
            annualClosingDebt[y] = monthlyClosingDebt[m];
        }
    }

    return {
        initialPrincipal: principal,
        monthlyInterest,
        monthlyPrincipalRepaid,
        monthlyDrawdown,
        monthlyClosingDebt,
        upfrontFee,
        annualInterest,
        annualPrincipalRepaid,
        annualClosingDebt
    };
}

/**
 * Calculate 15-Year Monthly & Annual 3-Statement Model
 */
export function calculate15YearStatements(
    project: InvestmentProjectInput,
    assumptionsInput?: OperatingAssumptionsInput,
    overrides?: WhatIfOverrides,
    horizonYears: number = 15
): {
    monthlyPeriods: MonthlyStatementPeriod[];
    annualPeriods: AnnualStatementPeriod[];
    totalCapex: number;
    initialCapex: number;
    totalReinvestmentCapex: number;
    initialDebt: number;
    initialEquity: number;
    depreciationSchedule: ReturnType<typeof calculateDepreciationSchedule>;
    debtSchedule: ReturnType<typeof calculateDebtSchedule>;
} {
    const totalMonths = horizonYears * 12;
    const assumptions = assumptionsInput || project.operating_assumptions || {};

    const capexMult = overrides?.capexMultiplier ?? 1.0;
    const revMult = overrides?.revenueMultiplier ?? 1.0;
    const varCostMult = overrides?.variableCostMultiplier ?? 1.0;
    const fixedCostMult = overrides?.fixedCostMultiplier ?? 1.0;
    const payrollMult = overrides?.payrollMultiplier ?? 1.0;
    const reinvestmentMult = overrides?.reinvestmentMultiplier ?? 1.0;
    const reinvestmentsEnabled = overrides?.reinvestmentsEnabled ?? true;

    // 1. Depreciation schedule
    const depSchedule = calculateDepreciationSchedule(
        project.capex_stages || [],
        project.start_date || '2026-01-01',
        horizonYears,
        capexMult,
        assumptions.reinvestment_programs || [],
        reinvestmentMult,
        reinvestmentsEnabled
    );

    // 2. Debt schedule
    const debtSchedule = calculateDebtSchedule(
        project.debt_facility,
        depSchedule.initialCapex,
        horizonYears,
        overrides?.repaymentTypeOverride
    );

    // 3. Equity initial contribution
    const initialEquity1 = Number(project.financing_structure?.investor1_equity || 0);
    const initialEquity2 = Number(project.financing_structure?.investor2_equity || 0);
    const initialEquity = initialEquity1 + initialEquity2 > 0
        ? initialEquity1 + initialEquity2
        : Math.max(0, depSchedule.initialCapex - debtSchedule.initialPrincipal);

    // 4. Commercial operation offset
    const projectStartDate = new Date(project.start_date || '2026-01-01');
    const codDate = project.commercial_operation_date
        ? new Date(project.commercial_operation_date)
        : new Date(projectStartDate.getFullYear(), projectStartDate.getMonth() + 12, 1);

    const startYear = projectStartDate.getFullYear() || 2026;
    const startMonth = projectStartDate.getMonth() || 0;
    const codYear = codDate.getFullYear() || startYear + 1;
    const codMonth = codDate.getMonth() || startMonth;

    const codMonthOffset = Math.max(0, (codYear - startYear) * 12 + (codMonth - startMonth));
    const firstCommercialMonth = codMonthOffset + 1;

    // 5. Operating baseline parameters
    let annualRevenueBase = Number(assumptions.annual_revenue_base || 0);
    if (!annualRevenueBase && assumptions.revenue_lines && assumptions.revenue_lines.length > 0) {
        annualRevenueBase = assumptions.revenue_lines.reduce(
            (sum, line) => sum + (Number(line.annual_volume) * Number(line.unit_price)),
            0
        );
    }
    if (!annualRevenueBase) {
        annualRevenueBase = 12000000; // default 12M PLN
    }

    const revGrowthRate = Number(assumptions.revenue_growth_rate_percent ?? 3.5) / 100.0;
    const varCostPercent = Number(assumptions.variable_cost_percent ?? 38.0) / 100.0;
    const annualFixedCostsBase = Number(assumptions.annual_fixed_costs_base ?? 1400000);
    const fixedCostGrowthRate = Number(assumptions.fixed_cost_growth_rate_percent ?? 2.5) / 100.0;

    let annualPayrollBase = Number(assumptions.annual_payroll_base || 0);
    if (!annualPayrollBase && assumptions.headcount_matrix && assumptions.headcount_matrix.length > 0) {
        annualPayrollBase = assumptions.headcount_matrix.reduce((sum, role) => {
            const multiplier = Number(role.employer_cost_multiplier ?? 1.2048);
            return sum + (Number(role.headcount) * Number(role.monthly_gross_salary) * 12 * multiplier);
        }, 0);
    }
    if (!annualPayrollBase) {
        annualPayrollBase = 2200000; // default 2.2M PLN
    }
    const payrollGrowthRate = Number(assumptions.payroll_growth_rate_percent ?? 4.0) / 100.0;

    // Ramp-up percentages
    const rampY1 = Number(assumptions.capacity_ramp_up?.year1_percent ?? 70.0) / 100.0;
    const rampY2 = Number(assumptions.capacity_ramp_up?.year2_percent ?? 90.0) / 100.0;
    const rampY3 = Number(assumptions.capacity_ramp_up?.year3_percent ?? 100.0) / 100.0;

    // Taxes
    const citRate = Number(assumptions.cit_rate_percent ?? 19.0) / 100.0;
    const taxLossEnabled = assumptions.tax_loss_carry_forward_enabled ?? true;
    const taxLossOffsetCap = Number(assumptions.tax_loss_offset_cap_percent ?? 50.0) / 100.0;

    // NWC rotation days
    const dso = Number(assumptions.dso ?? 45.0);
    const dpo = Number(assumptions.dpo ?? 30.0);
    const dio = Number(assumptions.dio ?? 20.0);

    const monthlyPeriods: MonthlyStatementPeriod[] = [];
    let taxLossPool = 0;
    let cashBalance = initialEquity;
    let prevNwc = 0;

    for (let m = 1; m <= totalMonths; m++) {
        const year = Math.ceil(m / 12);
        const monthInYear = ((m - 1) % 12) + 1;
        const isCommercial = m >= firstCommercialMonth;

        let monthRev = 0;
        let monthVarCost = 0;
        let monthFixedCost = 0;
        let monthPayroll = 0;

        if (isCommercial) {
            const operatingMonthIndex = m - firstCommercialMonth + 1;
            const operatingYear = Math.ceil(operatingMonthIndex / 12);

            // Ramp-up factor
            let rampFactor = rampY3;
            if (operatingYear === 1) rampFactor = rampY1;
            else if (operatingYear === 2) rampFactor = rampY2;

            // Inflated annual revenue
            const revGrowthFactor = Math.pow(1.0 + revGrowthRate, operatingYear - 1);
            const inflatedAnnualRev = annualRevenueBase * revMult * revGrowthFactor * rampFactor;
            monthRev = inflatedAnnualRev / 12.0;

            // Variable costs
            monthVarCost = monthRev * varCostPercent * varCostMult;

            // Fixed costs
            const fixedGrowthFactor = Math.pow(1.0 + fixedCostGrowthRate, operatingYear - 1);
            monthFixedCost = (annualFixedCostsBase * fixedCostMult * fixedGrowthFactor) / 12.0;

            // Payroll costs
            const payrollGrowthFactor = Math.pow(1.0 + payrollGrowthRate, operatingYear - 1);
            monthPayroll = (annualPayrollBase * payrollMult * payrollGrowthFactor) / 12.0;
        }

        const totalOpex = monthVarCost + monthFixedCost + monthPayroll;
        const ebitda = monthRev - totalOpex;

        const depreciation = depSchedule.monthlyDepreciation[m] || 0;
        const ebit = ebitda - depreciation;

        // Interest
        let interestExpense = debtSchedule.monthlyInterest[m] || 0;
        if (m === 1 && debtSchedule.upfrontFee > 0) {
            interestExpense += debtSchedule.upfrontFee;
        }

        const ebt = ebit - interestExpense;

        // CIT & Tax Loss Carry-Forward
        let cit = 0;
        let netIncome = ebt;

        if (ebt < 0) {
            if (taxLossEnabled) {
                taxLossPool += Math.abs(ebt);
            }
            netIncome = ebt;
        } else {
            let taxableIncome = ebt;
            if (taxLossEnabled && taxLossPool > 0) {
                const maxLossOffset = ebt * taxLossOffsetCap;
                const lossUsed = Math.min(taxLossPool, maxLossOffset);
                taxLossPool -= lossUsed;
                taxableIncome = ebt - lossUsed;
            }
            cit = Math.max(0, taxableIncome * citRate);
            netIncome = ebt - cit;
        }

        // Working Capital calculation (DSO, DIO, DPO)
        const receivables = monthRev * (dso / 30.0);
        const inventory = monthVarCost * (dio / 30.0);
        const payables = totalOpex * (dpo / 30.0);
        const currentNwc = receivables + inventory - payables;
        const changeInNwc = prevNwc - currentNwc; // Positive = cash inflow, negative = cash outflow
        prevNwc = currentNwc;

        // Cash flow components
        const debtDrawdown = debtSchedule.monthlyDrawdown[m] || 0;
        const debtRepaid = debtSchedule.monthlyPrincipalRepaid[m] || 0;
        const upfrontFee = m === 1 ? debtSchedule.upfrontFee : 0;

        // Upfront fee was expensed in interestExpense (netIncome), so add it back to OCF
        // to reclassify it as financing cash flow (FCF) and avoid double-deduction.
        const ocf = netIncome + depreciation + upfrontFee + changeInNwc;
        const capex = depSchedule.monthlyCapex[m] || 0;
        const icf = -capex;
        const fcf = debtDrawdown - debtRepaid - upfrontFee;

        const netCashFlow = ocf + icf + fcf;
        cashBalance += netCashFlow;

        const periodDate = new Date(startYear, startMonth + m - 1, 1);
        const dateStr = `${periodDate.getFullYear()}-${String(periodDate.getMonth() + 1).padStart(2, '0')}`;

        monthlyPeriods.push({
            period: m,
            year,
            monthInYear,
            date: dateStr,
            isCommercial,
            revenue: monthRev,
            variableCosts: monthVarCost,
            fixedCosts: monthFixedCost,
            payrollCosts: monthPayroll,
            totalOpex,
            ebitda,
            depreciation,
            ebit,
            interestExpense,
            ebt,
            cit,
            netIncome,
            capex,
            debtDrawdown,
            debtPrincipalRepaid: debtRepaid,
            vatLoanDrawdown: 0,
            vatLoanRepaid: 0,
            grantReceived: 0,
            changeInNwc,
            receivables,
            inventory,
            payables,
            operatingCashFlow: ocf,
            investingCashFlow: icf,
            financingCashFlow: fcf,
            netCashFlow,
            closingCash: cashBalance,
            closingDebt: debtSchedule.monthlyClosingDebt[m] || 0
        });
    }

    // 6. Aggregate to 15 Annual Periods
    const annualPeriods: AnnualStatementPeriod[] = [];

    for (let y = 1; y <= horizonYears; y++) {
        const startIdx = (y - 1) * 12;
        const endIdx = y * 12;
        const slice = monthlyPeriods.slice(startIdx, endIdx);

        const revenue = slice.reduce((sum, p) => sum + p.revenue, 0);
        const variableCosts = slice.reduce((sum, p) => sum + p.variableCosts, 0);
        const fixedCosts = slice.reduce((sum, p) => sum + p.fixedCosts, 0);
        const payrollCosts = slice.reduce((sum, p) => sum + p.payrollCosts, 0);
        const totalOpex = slice.reduce((sum, p) => sum + p.totalOpex, 0);
        const ebitda = slice.reduce((sum, p) => sum + p.ebitda, 0);
        const depreciation = slice.reduce((sum, p) => sum + p.depreciation, 0);
        const ebit = slice.reduce((sum, p) => sum + p.ebit, 0);
        const interestExpense = slice.reduce((sum, p) => sum + p.interestExpense, 0);
        const ebt = slice.reduce((sum, p) => sum + p.ebt, 0);
        const cit = slice.reduce((sum, p) => sum + p.cit, 0);
        const netIncome = slice.reduce((sum, p) => sum + p.netIncome, 0);
        const capex = slice.reduce((sum, p) => sum + p.capex, 0);
        const changeInNwc = slice.reduce((sum, p) => sum + p.changeInNwc, 0);
        const operatingCashFlow = slice.reduce((sum, p) => sum + p.operatingCashFlow, 0);
        const investingCashFlow = slice.reduce((sum, p) => sum + p.investingCashFlow, 0);
        const financingCashFlow = slice.reduce((sum, p) => sum + p.financingCashFlow, 0);
        const netCashFlow = slice.reduce((sum, p) => sum + p.netCashFlow, 0);

        const lastMonth = slice[slice.length - 1];
        const closingCash = lastMonth ? lastMonth.closingCash : 0;
        const closingDebt = lastMonth ? lastMonth.closingDebt : 0;
        const closingReceivables = lastMonth ? lastMonth.receivables : 0;
        const closingInventory = lastMonth ? lastMonth.inventory : 0;
        const closingPayables = lastMonth ? lastMonth.payables : 0;

        // FCFF = NOPAT + Depr - Capex + ChangeInNWC
        const nopat = ebit > 0 ? ebit * (1.0 - citRate) : ebit;
        const fcff = nopat + depreciation - capex + changeInNwc;

        // FCFE = NetIncome + Depr - Capex + ChangeInNWC + NetBorrowing
        const debtRepaidAnnual = slice.reduce((sum, p) => sum + p.debtPrincipalRepaid, 0);
        const debtDrawdownAnnual = slice.reduce((sum, p) => sum + p.debtDrawdown, 0);
        const netBorrowing = debtDrawdownAnnual - debtRepaidAnnual;
        const fcfe = netIncome + depreciation - capex + changeInNwc + netBorrowing;

        // Covenants: DSCR = CFADS / (Principal + Interest) during commercial operations
        const isCommercialYear = slice.some(p => p.isCommercial);
        const cfads = Math.max(0, ebitda - cit + changeInNwc);
        const totalDebtService = debtRepaidAnnual + interestExpense;
        const dscr = (isCommercialYear && totalDebtService > 0) ? Math.round((cfads / totalDebtService) * 100) / 100 : null;
        const icr = (isCommercialYear && interestExpense > 0) ? Math.round((ebit / interestExpense) * 100) / 100 : null;

        annualPeriods.push({
            year: y,
            revenue,
            variableCosts,
            fixedCosts,
            payrollCosts,
            totalOpex,
            ebitda,
            ebitdaMarginPercent: revenue > 0 ? Math.round((ebitda / revenue) * 10000) / 100 : 0,
            depreciation,
            ebit,
            interestExpense,
            ebt,
            cit,
            netIncome,
            netMarginPercent: revenue > 0 ? Math.round((netIncome / revenue) * 10000) / 100 : 0,
            capex,
            changeInNwc,
            operatingCashFlow,
            investingCashFlow,
            financingCashFlow,
            netCashFlow,
            closingCash,
            closingDebt,
            closingReceivables,
            closingInventory,
            closingPayables,
            fcff,
            fcfe,
            dscr,
            interestCoverageRatio: icr
        });
    }

    return {
        monthlyPeriods,
        annualPeriods,
        totalCapex: depSchedule.totalCapex,
        initialCapex: depSchedule.initialCapex,
        totalReinvestmentCapex: depSchedule.totalReinvestmentCapex,
        initialDebt: debtSchedule.initialPrincipal,
        initialEquity,
        depreciationSchedule: depSchedule,
        debtSchedule
    };
}

/**
 * Numerical Newton-Raphson & Bisection Hybrid IRR Solver
 */
export function calculateIrr(cashFlows: number[]): number | null {
    if (!cashFlows || cashFlows.length < 2) return null;

    let hasPos = false;
    let hasNeg = false;
    for (const val of cashFlows) {
        if (val > 0.001) hasPos = true;
        if (val < -0.001) hasNeg = true;
    }
    if (!hasPos || !hasNeg) return null;

    const npvAt = (r: number): number => {
        let sum = 0;
        for (let t = 0; t < cashFlows.length; t++) {
            sum += cashFlows[t] / Math.pow(1.0 + r, t);
        }
        return sum;
    };

    const dNpvAt = (r: number): number => {
        let sum = 0;
        for (let t = 1; t < cashFlows.length; t++) {
            sum -= (t * cashFlows[t]) / Math.pow(1.0 + r, t + 1);
        }
        return sum;
    };

    // 1. Try Newton-Raphson from r = 0.10 (10%)
    let r = 0.10;
    for (let iter = 0; iter < 50; iter++) {
        const val = npvAt(r);
        const deriv = dNpvAt(r);
        if (Math.abs(deriv) < 1e-9) break;

        const nextR = r - val / deriv;
        if (isNaN(nextR) || nextR <= -0.99 || nextR > 10.0) break;
        if (Math.abs(nextR - r) < 1e-7) {
            return Math.round(nextR * 10000) / 100; // Return % (e.g. 14.52)
        }
        r = nextR;
    }

    // 2. Fallback to bracketed bisection search (-90% to +300%)
    let low = -0.90;
    let high = 3.00;
    let fLow = npvAt(low);
    let fHigh = npvAt(high);

    // If no sign change between -90% and +300%, scan in steps
    if (fLow * fHigh > 0) {
        let foundBracket = false;
        for (let scan = -0.90; scan <= 3.00; scan += 0.10) {
            const f1 = npvAt(scan);
            const f2 = npvAt(scan + 0.10);
            if (f1 * f2 <= 0) {
                low = scan;
                high = scan + 0.10;
                fLow = f1;
                fHigh = f2;
                foundBracket = true;
                break;
            }
        }
        if (!foundBracket) return null;
    }

    for (let bIter = 0; bIter < 60; bIter++) {
        const mid = (low + high) / 2.0;
        const fMid = npvAt(mid);
        if (Math.abs(fMid) < 1e-6 || (high - low) < 1e-6) {
            return Math.round(mid * 10000) / 100;
        }
        if (fLow * fMid <= 0) {
            high = mid;
        } else {
            low = mid;
            fLow = fMid;
        }
    }

    return Math.round(((low + high) / 2.0) * 10000) / 100;
}

/**
 * Exact Linear Fractional Payback Period
 */
export function calculatePaybackPeriod(cashFlows: number[]): number | null {
    if (!cashFlows || cashFlows.length === 0) return null;

    let cumulative = 0;
    let startFound = false;

    for (let t = 0; t < cashFlows.length; t++) {
        const flow = cashFlows[t];
        if (!startFound) {
            if (flow < 0) {
                cumulative = flow;
                startFound = true;
            }
            continue;
        }

        const nextCumulative = cumulative + flow;
        if (cumulative < 0 && nextCumulative >= 0 && flow > 0) {
            // Linear fraction: fraction of period needed to reach 0
            const fraction = Math.abs(cumulative) / flow;
            return Math.round((t - 1 + fraction) * 100) / 100;
        }
        cumulative = nextCumulative;
    }

    return null; // Not recovered within horizon
}

/**
 * Calculate Comprehensive Appraisal Metrics (NPV, IRR, TV, MoIC, DSCR)
 */
export function calculateAppraisalMetrics(
    project: InvestmentProjectInput,
    annualPeriods: AnnualStatementPeriod[],
    initialCapex: number,
    initialEquity: number,
    overrides?: WhatIfOverrides
): AppraisalMetrics {
    const horizon = annualPeriods.length;
    const currency = project.currency || 'PLN';

    // 1. Determine Effective WACC
    let effectiveWacc = 8.50; // default 8.50%
    if (overrides?.waccOverridePercent !== undefined && overrides.waccOverridePercent !== null) {
        effectiveWacc = Number(overrides.waccOverridePercent);
    } else if (project.wacc_parameters) {
        const rf = Number(project.wacc_parameters.risk_free_rate_percent ?? 5.50);
        const erp = Number(project.wacc_parameters.equity_risk_premium_percent ?? 6.00);
        const beta = Number(project.wacc_parameters.levered_beta ?? 1.10);
        const ke = Number(project.wacc_parameters.cost_of_equity_percent ?? (rf + beta * erp));
        const debtRatio = Number(project.wacc_parameters.target_debt_ratio_percent ?? 60.0) / 100.0;
        const equityRatio = 1.0 - debtRatio;
        const kd = 7.50 / 100.0; // cost of debt
        const cit = 0.19;
        effectiveWacc = Math.round((equityRatio * ke + debtRatio * (kd * (1.0 - cit) * 100)) * 100) / 100;
    }

    const waccDecimal = effectiveWacc / 100.0;
    const costOfEquity = 12.10; // default 12.10%
    const costOfEquityDecimal = costOfEquity / 100.0;

    // 2. Terminal Value
    const lastYear = annualPeriods[horizon - 1];
    const lastEbitda = lastYear ? lastYear.ebitda : 0;
    const exitMultiple = overrides?.exitMultipleOverride ?? project.valuation_multiple?.multiple ?? 7.5;
    const undiscountedTv = Math.max(0, lastEbitda * exitMultiple);

    // Discount TV to t=0
    const tvDiscountFactor = Math.pow(1.0 + waccDecimal, -horizon);
    const discountedTv = undiscountedTv * tvDiscountFactor;

    // 3. Discounted FCFF & Project NPV
    let sumDiscountedFcff = 0;
    let sumPvCapex = 0;
    const projectNominalFlows: number[] = [ -initialCapex ];
    const projectDiscountedFlows: number[] = [ -initialCapex ];

    for (let y = 1; y <= horizon; y++) {
        const period = annualPeriods[y - 1];
        const df = Math.pow(1.0 + waccDecimal, -y);

        let fcff = period.fcff;
        let discFcff = fcff * df;

        sumDiscountedFcff += discFcff;
        sumPvCapex += period.capex * df;

        let totalFlow = fcff;
        let totalDiscFlow = discFcff;
        if (y === horizon) {
            totalFlow += undiscountedTv;
            totalDiscFlow += discountedTv;
        }
        projectNominalFlows.push(totalFlow);
        projectDiscountedFlows.push(totalDiscFlow);
    }

    const projectNpv = Math.round(sumDiscountedFcff + discountedTv);
    const enterpriseValue = Math.round(projectNpv + initialCapex);
    const projectIrr = calculateIrr(projectNominalFlows);
    const simplePayback = calculatePaybackPeriod(projectNominalFlows);
    const discountedPayback = calculatePaybackPeriod(projectDiscountedFlows);

    // 4. Discounted FCFE & Equity NPV
    let sumDiscountedFcfe = 0;
    const equityTvDiscountFactor = Math.pow(1.0 + costOfEquityDecimal, -horizon);
    const lastDebt = lastYear ? lastYear.closingDebt : 0;
    const equityUndiscountedTv = Math.max(0, undiscountedTv - lastDebt);
    const equityDiscountedTv = equityUndiscountedTv * equityTvDiscountFactor;

    const equityNominalFlows: number[] = [ -initialEquity ];
    const equityDiscountedFlows: number[] = [ -initialEquity ];
    let totalEquityInflows = 0;

    for (let y = 1; y <= horizon; y++) {
        const period = annualPeriods[y - 1];
        const dfEquity = Math.pow(1.0 + costOfEquityDecimal, -y);

        let fcfe = period.fcfe;
        let discFcfe = fcfe * dfEquity;
        sumDiscountedFcfe += discFcfe;

        let totalEqFlow = fcfe;
        let totalDiscEqFlow = discFcfe;
        if (y === horizon) {
            totalEqFlow += equityUndiscountedTv;
            totalDiscEqFlow += equityDiscountedTv;
        }

        if (totalEqFlow > 0) {
            totalEquityInflows += totalEqFlow;
        }

        equityNominalFlows.push(totalEqFlow);
        equityDiscountedFlows.push(totalDiscEqFlow);
    }

    const equityNpv = Math.round(sumDiscountedFcfe + equityDiscountedTv - initialEquity);
    const equityIrr = calculateIrr(equityNominalFlows);
    const equityMoic = initialEquity > 0
        ? Math.round((totalEquityInflows / initialEquity) * 100) / 100
        : 0;

    // 5. DSCR Covenants
    const validDscrList = annualPeriods
        .map(p => p.dscr)
        .filter((d): d is number => d !== null && !isNaN(d) && d > 0);

    const minDscr = validDscrList.length > 0 ? Math.min(...validDscrList) : null;
    const avgDscr = validDscrList.length > 0
        ? Math.round((validDscrList.reduce((a, b) => a + b, 0) / validDscrList.length) * 100) / 100
        : null;

    const isBankable = (avgDscr !== null ? avgDscr >= 1.20 : true) && (projectIrr === null || projectIrr > effectiveWacc);

    return {
        currency,
        horizonYears: horizon,
        waccPercent: effectiveWacc,
        costOfEquityPercent: costOfEquity,
        terminalValueMethod: 'exit_multiple',
        terminalValueMultiple: exitMultiple,
        undiscountedTerminalValue: Math.round(undiscountedTv),
        discountedTerminalValue: Math.round(discountedTv),
        enterpriseValue,
        projectNpv,
        projectIrrPercent: projectIrr,
        simplePaybackYears: simplePayback,
        discountedPaybackYears: discountedPayback,
        initialEquity: Math.round(initialEquity),
        equityNpv,
        equityIrrPercent: equityIrr,
        equityMoic,
        minDscr,
        avgDscr,
        isBankable
    };
}

/**
 * Execute Complete 15-Year Simulation
 */
export function runSimulation(
    project: InvestmentProjectInput,
    assumptions?: OperatingAssumptionsInput,
    overrides?: WhatIfOverrides,
    horizonYears: number = 15
): SimulationResult {
    const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();

    const statements = calculate15YearStatements(project, assumptions, overrides, horizonYears);
    const appraisal = calculateAppraisalMetrics(
        project,
        statements.annualPeriods,
        statements.initialCapex,
        statements.initialEquity,
        overrides
    );

    const totalRevenue15Y = statements.annualPeriods.reduce((sum, p) => sum + p.revenue, 0);
    const totalEbitda15Y = statements.annualPeriods.reduce((sum, p) => sum + p.ebitda, 0);
    const totalNetIncome15Y = statements.annualPeriods.reduce((sum, p) => sum + p.netIncome, 0);
    const totalInterest15Y = statements.annualPeriods.reduce((sum, p) => sum + p.interestExpense, 0);

    const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const executionTimeMs = Math.round((t1 - t0) * 100) / 100;

    return {
        summary: {
            totalCapex: Math.round(statements.totalCapex),
            initialCapex: Math.round(statements.initialCapex),
            totalReinvestmentCapex: Math.round(statements.totalReinvestmentCapex),
            initialDebt: Math.round(statements.initialDebt),
            initialEquity: Math.round(statements.initialEquity),
            totalRevenue15Y: Math.round(totalRevenue15Y),
            totalEbitda15Y: Math.round(totalEbitda15Y),
            totalNetIncome15Y: Math.round(totalNetIncome15Y),
            totalInterest15Y: Math.round(totalInterest15Y),
            projectNpv: appraisal.projectNpv,
            projectIrrPercent: appraisal.projectIrrPercent,
            simplePaybackYears: appraisal.simplePaybackYears,
            discountedPaybackYears: appraisal.discountedPaybackYears,
            equityNpv: appraisal.equityNpv,
            equityIrrPercent: appraisal.equityIrrPercent,
            equityMoic: appraisal.equityMoic,
            minDscr: appraisal.minDscr,
            avgDscr: appraisal.avgDscr
        },
        appraisal,
        annualPeriods: statements.annualPeriods,
        monthlyPeriods: statements.monthlyPeriods,
        monthlyPeriodsCount: statements.monthlyPeriods.length,
        executionTimeMs
    };
}
