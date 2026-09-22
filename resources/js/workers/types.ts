/**
 * FinBoard Project Finance & Valuation Engine - Type Definitions
 * Phase 43 Commit 212: Real-time 15-Year Web Worker Simulation Engine
 */

export interface CapexStageInput {
    id?: string | number;
    stage_name?: string;
    name?: string;
    net_amount: number | string;
    currency?: string;
    start_date?: string;
    duration_months?: number | string;
    kst_code?: string;
    kst_annual_rate?: number;
    is_grant_eligible?: boolean;
    grant_eligible_amount?: number | string | null;
    stage_order?: number;
    order_index?: number;
}

export interface DebtFacilityInput {
    id?: string | number;
    facility_name?: string;
    facility_type?: 'senior' | 'subordinated' | 'mezzanine';
    principal_amount: number | string;
    currency?: string;
    base_interest_rate_percent?: number | string;
    margin_percent?: number | string;
    upfront_fee_percent?: number | string;
    tenor_months?: number | string;
    grace_period_months?: number | string;
    repayment_type?: 'annuity' | 'linear' | 'bullet';
}

export interface FinancingStructureInput {
    investor1_equity?: number | string;
    investor2_equity?: number | string;
    debt_facility_amount?: number | string;
    vat_bridge_loan_amount?: number | string;
    grant_amount?: number | string;
    currency?: string;
}

export interface RevenueLineInput {
    id?: string | number;
    name: string;
    unit?: string;
    annual_volume: number;
    unit_price: number;
}

export interface HeadcountRoleInput {
    id?: string | number;
    role_name: string;
    headcount: number;
    monthly_gross_salary: number;
    employer_cost_multiplier?: number;
}

export interface ReinvestmentProgramInput {
    id?: string;
    code: 'A' | 'B' | 'C' | string;
    name: string;
    net_amount: number | string;
    frequency_years: number;
    first_occurrence_year: number;
    specific_years?: number[];
    kst_code?: string;
    kst_annual_rate?: number;
    enabled: boolean;
}

export interface OperatingAssumptionsInput {
    annual_revenue_base?: number | string;
    revenue_growth_rate_percent?: number | string;
    variable_cost_percent?: number | string;
    annual_fixed_costs_base?: number | string;
    fixed_cost_growth_rate_percent?: number | string;
    annual_payroll_base?: number | string;
    payroll_growth_rate_percent?: number | string;
    revenue_lines?: RevenueLineInput[];
    headcount_matrix?: HeadcountRoleInput[];
    reinvestment_programs?: ReinvestmentProgramInput[];
    capacity_ramp_up?: {
        year1_percent?: number | string;
        year2_percent?: number | string;
        year3_percent?: number | string;
    };
    cit_rate_percent?: number | string;
    tax_loss_carry_forward_enabled?: boolean;
    tax_loss_offset_cap_percent?: number | string;
    dso?: number | string;
    dpo?: number | string;
    dio?: number | string;
    currency?: string;
}

export interface InvestmentProjectInput {
    id?: string | number;
    name?: string;
    currency?: string;
    start_date?: string;
    commercial_operation_date?: string;
    planning_horizon_years?: number;
    capex_stages?: CapexStageInput[];
    debt_facility?: DebtFacilityInput | null;
    financing_structure?: FinancingStructureInput | null;
    operating_assumptions?: OperatingAssumptionsInput | null;
    wacc_parameters?: {
        risk_free_rate_percent?: number;
        equity_risk_premium_percent?: number;
        levered_beta?: number;
        cost_of_equity_percent?: number;
        target_debt_ratio_percent?: number;
    };
    valuation_multiple?: {
        multiple?: number;
        multiple_type?: 'ev_ebitda' | 'p_e';
    };
}

export interface WhatIfOverrides {
    capexMultiplier?: number;           // e.g. 1.05 = +5% CAPEX
    revenueMultiplier?: number;         // e.g. 0.90 = -10% Revenue
    variableCostMultiplier?: number;    // e.g. 1.10 = +10% Variable Costs
    fixedCostMultiplier?: number;       // e.g. 1.05 = +5% Fixed OPEX
    payrollMultiplier?: number;         // e.g. 1.08 = +8% Payroll
    reinvestmentMultiplier?: number;    // e.g. 1.00 = 100% reinvestment CAPEX
    reinvestmentsEnabled?: boolean;     // Toggle cyclical reinvestment on/off
    waccOverridePercent?: number | null;// Override WACC rate in %
    exitMultipleOverride?: number | null;// Override EV/EBITDA multiple
    repaymentTypeOverride?: 'annuity' | 'linear' | 'bullet' | null;
    capacityRampUpMultiplier?: number;  // Scale ramp-up speed
}

export interface MonthlyStatementPeriod {
    period: number;         // 1..180
    year: number;           // 1..15
    monthInYear: number;    // 1..12
    date: string;           // YYYY-MM
    isCommercial: boolean;
    revenue: number;
    variableCosts: number;
    fixedCosts: number;
    payrollCosts: number;
    totalOpex: number;
    ebitda: number;
    depreciation: number;
    ebit: number;
    interestExpense: number;
    ebt: number;
    cit: number;
    netIncome: number;
    capex: number;
    debtDrawdown: number;
    debtPrincipalRepaid: number;
    vatLoanDrawdown: number;
    vatLoanRepaid: number;
    grantReceived: number;
    changeInNwc: number;
    operatingCashFlow: number;
    investingCashFlow: number;
    financingCashFlow: number;
    netCashFlow: number;
    closingCash: number;
    closingDebt: number;
    receivables: number;
    inventory: number;
    payables: number;
}

export interface AnnualStatementPeriod {
    year: number;           // 1..15
    revenue: number;
    variableCosts: number;
    fixedCosts: number;
    payrollCosts: number;
    totalOpex: number;
    ebitda: number;
    ebitdaMarginPercent: number;
    depreciation: number;
    ebit: number;
    interestExpense: number;
    ebt: number;
    cit: number;
    netIncome: number;
    netMarginPercent: number;
    capex: number;
    changeInNwc: number;
    operatingCashFlow: number;
    investingCashFlow: number;
    financingCashFlow: number;
    netCashFlow: number;
    closingCash: number;
    closingDebt: number;
    closingReceivables: number;
    closingInventory: number;
    closingPayables: number;
    fcff: number;
    fcfe: number;
    dscr: number | null;
    interestCoverageRatio: number | null;
    debtPrincipalRepaid?: number;
    debtDrawdown?: number;
}

export interface AppraisalMetrics {
    currency: string;
    horizonYears: number;
    waccPercent: number;
    costOfEquityPercent: number;
    terminalValueMethod: 'exit_multiple' | 'gordon_growth';
    terminalValueMultiple: number;
    undiscountedTerminalValue: number;
    discountedTerminalValue: number;
    enterpriseValue: number;
    projectNpv: number;
    projectIrrPercent: number | null;
    simplePaybackYears: number | null;
    discountedPaybackYears: number | null;
    initialEquity: number;
    equityNpv: number;
    equityIrrPercent: number | null;
    equityMoic: number;
    minDscr: number | null;
    avgDscr: number | null;
    isBankable: boolean;
}

export interface SimulationResult {
    summary: {
        totalCapex: number;
        initialCapex?: number;
        totalReinvestmentCapex?: number;
        initialDebt: number;
        initialEquity: number;
        totalRevenue15Y: number;
        totalEbitda15Y: number;
        totalNetIncome15Y: number;
        totalInterest15Y?: number;
        projectNpv: number;
        projectIrrPercent: number | null;
        simplePaybackYears: number | null;
        discountedPaybackYears: number | null;
        equityNpv: number;
        equityIrrPercent: number | null;
        equityMoic: number;
        minDscr: number | null;
        avgDscr: number | null;
    };
    appraisal: AppraisalMetrics;
    annualPeriods: AnnualStatementPeriod[];
    monthlyPeriods?: MonthlyStatementPeriod[];
    monthlyPeriodsCount: number;
    executionTimeMs: number;
    exitValuation?: ExitValuationResult;
    covenants?: BankingCovenantsResult;
}

export interface ExitValuationParams {
    exitYear?: number;
    exitMultiple?: number;
    tvMethod?: 'exit_multiple' | 'gordon_growth' | 'book_value';
    perpetualGrowthRatePercent?: number;
    waccPercent?: number;
}

export interface ExitSensitivityCell {
    year: number;
    multiple: number;
    enterpriseValue: number;
    equityValue: number;
    equityMoic: number;
    equityIrrPercent: number | null;
    buyerEbitdaYieldPercent: number;
}

export interface ExitValuationResult {
    exitYear: number;
    horizonYears: number;
    currency: string;
    exitEbitda: number;
    exitRevenue: number;
    exitFcff: number;
    exitFcfe: number;
    grossDebtAtExit: number;
    cashAtExit: number;
    netDebtAtExit: number;
    enterpriseValue: number;
    equityValue: number;
    method: 'exit_multiple' | 'gordon_growth' | 'book_value';
    exitMultiple: number;
    perpetualGrowthRatePercent: number;

    // Buyer Yield metrics
    buyerEbitdaYieldPercent: number;
    buyerFcffYieldPercent: number;
    buyerFcfeYieldPercent: number;
    buyerYieldSpreadPercent: number;
    buyerImpliedPaybackYears: number;

    // Existing Investor Returns up to Exit
    initialEquity: number;
    cumulativeDividendsUpToExit: number;
    totalInvestorInflows: number;
    equityMoic: number;
    equityIrrPercent: number | null;
    netCapitalGain: number;

    // Sensitivity Matrix
    sensitivityMultiples: number[];
    sensitivityYears: number[];
    sensitivityGrid: ExitSensitivityCell[][];
}

export interface WaterfallInvestorMetrics {
    investorIndex: number;
    name: string;
    initialEquity: number;
    sharePercent: number;
    preExitDistributions: number;
    exitProceeds: number;
    totalProceeds: number;
    netGain: number;
    moic: number;
    irrPercent: number | null;
}

export interface ExitWaterfallParams {
    exitYear?: number;
    exitMultiple?: number;
    structure?: 'pari_passu' | 'two_tier_hurdle';
    sponsorSharePercent?: number;
    hurdleRatePercent?: number;
    carrySharePercent?: number;
}

export interface ExitWaterfallResult {
    exitYear: number;
    exitMultiple: number;
    currency: string;
    structure: 'pari_passu' | 'two_tier_hurdle';
    hurdleRatePercent: number;
    carrySharePercent: number;

    // EV to Equity Bridge
    enterpriseValue: number;
    grossDebt: number;
    cash: number;
    netDebt: number;
    exitEquityValue: number;

    // Total Equity Overview
    initialEquityTotal: number;
    preExitDistributionsTotal: number;
    exitProceedsTotal: number;
    totalProceedsTotal: number;
    netGainTotal: number;
    totalMoic: number;
    totalIrrPercent: number | null;

    // Investor Breakdown
    investor1: WaterfallInvestorMetrics;
    investor2: WaterfallInvestorMetrics;

    // Waterfall Chart Steps
    waterfallSteps: {
        id: string;
        label: string;
        amount: number;
        runningBalance: number;
        category: 'ev' | 'debt' | 'cash' | 'equity' | 'sponsor' | 'partner';
    }[];
}

export interface CovenantThresholds {
    minDscr: number;           // Standard: 1.20x
    minIcr: number;            // Standard: 2.50x
    maxLeverage: number;       // Standard: 3.50x (Net Debt / EBITDA)
    minCurrentRatio: number;   // Standard: 1.10x
    minDsrfMonths: number;     // Standard: 6 months
}

export interface YearlyCovenantMetric {
    year: number;
    isCommercial: boolean;
    hasDebtService: boolean;
    revenue: number;
    ebitda: number;
    ebit: number;
    interestExpense: number;
    principalRepaid: number;
    totalDebtService: number;
    cfads: number;
    closingCash: number;
    closingDebt: number;
    netDebt: number;
    currentAssets: number;
    currentLiabilities: number;
    dscr: number | null;
    dscrStatus: 'compliant' | 'warning' | 'breach' | 'na';
    dscrHeadroom: number | null; // e.g. +0.25 (DSCR - minDscr)
    dscrHeadroomPercent: number | null; // e.g. +20.8%
    icr: number | null;
    icrStatus: 'compliant' | 'warning' | 'breach' | 'na';
    icrHeadroom: number | null;
    currentRatio: number | null;
    currentRatioStatus: 'compliant' | 'warning' | 'breach' | 'na';
    quickRatio: number | null;
    leverageRatio: number | null; // Net Debt / EBITDA
    leverageStatus: 'compliant' | 'warning' | 'breach' | 'na';
    dsrfMonths: number | null; // Cash / (DebtService / 12)
    dsrfStatus: 'compliant' | 'warning' | 'breach' | 'na';
    isCompliant: boolean;
    breaches: string[];
}

export interface BankingCovenantsResult {
    currency: string;
    thresholds: CovenantThresholds;
    summary: {
        minDscr: number | null;
        avgDscr: number | null;
        minIcr: number | null;
        avgIcr: number | null;
        peakLeverage: number | null;
        minCurrentRatio: number | null;
        avgCurrentRatio: number | null;
        minDsrfMonths: number | null;
        isBankable: boolean;
        bankabilityStatus: 'compliant' | 'warning' | 'breach';
        totalBreachesCount: number;
        yearsWithBreachCount: number;
        commercialYearsCount: number;
        debtServiceYearsCount: number;
        pinchYear: number | null;
        pinchDscr: number | null;
        pinchHeadroomPercent: number | null;
    };
    yearlyMetrics: YearlyCovenantMetric[];
}

export interface WorkerRequestMessage {
    type: 'CALCULATE_SIMULATION';
    requestId: string | number;
    payload: {
        project: InvestmentProjectInput;
        assumptions?: OperatingAssumptionsInput;
        overrides?: WhatIfOverrides;
        horizonYears?: number;
    };
}

export interface WorkerResponseMessage {
    type: 'SIMULATION_SUCCESS' | 'SIMULATION_ERROR';
    requestId: string | number;
    data?: SimulationResult;
    error?: string;
    executionTimeMs?: number;
}
