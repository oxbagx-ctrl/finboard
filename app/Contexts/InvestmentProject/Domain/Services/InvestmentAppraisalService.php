<?php

declare(strict_types=1);

namespace App\Contexts\InvestmentProject\Domain\Services;

use App\Contexts\Finance\Domain\ValueObjects\Currency;
use App\Contexts\Finance\Domain\ValueObjects\Money;
use App\Contexts\InvestmentProject\Domain\Model\InvestmentProject;
use App\Contexts\InvestmentProject\Domain\ValueObjects\AnnualAppraisalPeriod;
use App\Contexts\InvestmentProject\Domain\ValueObjects\AppraisalResult;
use App\Contexts\InvestmentProject\Domain\ValueObjects\BalanceSheet;
use App\Contexts\InvestmentProject\Domain\ValueObjects\CashFlowStatement;
use App\Contexts\InvestmentProject\Domain\ValueObjects\DynamicWaccSchedule;
use App\Contexts\InvestmentProject\Domain\ValueObjects\IncomeStatement;
use App\Contexts\InvestmentProject\Domain\ValueObjects\OperatingAssumptions;
use App\Contexts\InvestmentProject\Domain\ValueObjects\TerminalValue;
use App\Contexts\InvestmentProject\Domain\ValueObjects\TerminalValueMethod;
use App\Contexts\InvestmentProject\Domain\ValueObjects\WaccParameters;
use App\Contexts\InvestmentProject\Domain\ValueObjects\WaccResult;
use InvalidArgumentException;

final class InvestmentAppraisalService
{
    public function __construct(
        private readonly WaccCalculatorService $waccService
    ) {}

    /**
     * Perform full discounted cash flow (DCF) valuation and project/equity appraisal.
     */
    public function appraise(
        InvestmentProject $project,
        IncomeStatement $incomeStatement,
        CashFlowStatement $cashFlowStatement,
        BalanceSheet $balanceSheet,
        ?WaccResult $wacc = null,
        ?DynamicWaccSchedule $dynamicWacc = null,
        ?TerminalValueMethod $tvMethod = null,
        ?float $tvParameter = null,
        ?OperatingAssumptions $assumptions = null
    ): AppraisalResult {
        $currency = $project->financingStructure()->totalEquity()->currency();
        $horizon = $project->planningHorizonYears();

        $citRatePercent = $assumptions?->citRatePercent()
            ?? $incomeStatement->assumptions()->citRatePercent()
            ?? 19.0;
        $defaultParams = WaccParameters::defaultForPoland(null, $citRatePercent);

        // 1. Resolve WACC and Dynamic WACC if not provided
        $effectiveWacc = $wacc ?? $this->waccService->calculateFromProject($project, $defaultParams);
        $effectiveDynamicWacc = $dynamicWacc ?? $this->waccService->calculateDynamicSchedule($project, $balanceSheet, $defaultParams);

        // 2. Prepare Terminal Value method and parameter defaults
        $method = $tvMethod ?? TerminalValueMethod::EXIT_MULTIPLE;
        $parameter = $tvParameter ?? match ($method) {
            TerminalValueMethod::EXIT_MULTIPLE => $project->valuationMultiple()->multiple(),
            TerminalValueMethod::GORDON_GROWTH => 2.0, // Standard 2.0% perpetual growth
            TerminalValueMethod::BOOK_VALUE => 0.0,
        };

        // 3. Discount factors lookup
        $dynamicFactors = $effectiveDynamicWacc->cumulativeDiscountFactors(false);
        $costOfEquityDecimal = $effectiveWacc->costOfEquityPercent() / 100.0;

        // 4. Calculate Annual Appraisal Periods (FCFF & FCFE)
        /** @var array<int, AnnualAppraisalPeriod> $annualPeriods */
        $annualPeriods = [];
        $cumDiscountedFcff = Money::zero($currency);
        $cumDiscountedFcfe = Money::zero($currency);
        $sumPvCapex = Money::zero($currency);

        $citRateDecimal = $citRatePercent / 100.0;

        for ($y = 1; $y <= $horizon; $y++) {
            $is = $incomeStatement->annualStatement($y);
            $cfs = $cashFlowStatement->annualStatement($y);

            // Enterprise / Operating Items
            $ebit = $is ? $is->ebit() : Money::zero($currency);
            // NOPAT = EBIT * (1 - CIT) if EBIT > 0
            $nopat = $ebit->isPositive()
                ? $ebit->multiply(1.0 - $citRateDecimal)
                : $ebit;

            $depreciation = $cfs ? $cfs->depreciation() : Money::zero($currency);
            $capex = $cfs ? $cfs->capexIncurred() : Money::zero($currency);
            $wcChange = $cfs ? $cfs->workingCapitalChange() : Money::zero($currency);

            // FCFF = NOPAT + Depreciation - CAPEX + WorkingCapitalChange (cash impact)
            $fcff = $nopat->add($depreciation)->subtract($capex)->add($wcChange);

            // FCFF Discount Factor
            $dfFcff = $dynamicFactors[$y] ?? $effectiveWacc->discountFactor($y);
            $waccRatePercent = $effectiveDynamicWacc->annualWacc($y)?->nominalWaccPercent()
                ?? $effectiveWacc->nominalWaccPercent();

            $discountedFcff = $fcff->multiply($dfFcff);
            $cumDiscountedFcff = $cumDiscountedFcff->add($discountedFcff);

            // CAPEX present value for Profitability Index
            $discountedCapex = $capex->multiply($dfFcff);
            $sumPvCapex = $sumPvCapex->add($discountedCapex);

            // Equity Items
            $netIncome = $cfs ? $cfs->netIncome() : Money::zero($currency);
            $debtDrawdown = $cfs ? $cfs->debtDrawdown() : Money::zero($currency);
            $debtRepaid = $cfs ? $cfs->debtPrincipalRepaid() : Money::zero($currency);
            $upfrontFees = $cfs ? $cfs->upfrontFees() : Money::zero($currency);
            $vatDrawdown = $cfs ? $cfs->vatLoanDrawdown() : Money::zero($currency);
            $vatRepaid = $cfs ? $cfs->vatLoanRepaid() : Money::zero($currency);
            $grantReceived = $cfs ? $cfs->grantReceived() : Money::zero($currency);

            $netBorrowing = $debtDrawdown
                ->subtract($debtRepaid)
                ->subtract($upfrontFees)
                ->add($vatDrawdown)
                ->subtract($vatRepaid)
                ->add($grantReceived);

            // FCFE = NetIncome + Depreciation - CAPEX + WorkingCapitalChange + NetBorrowing
            $fcfe = $netIncome->add($depreciation)->subtract($capex)->add($wcChange)->add($netBorrowing);

            // Equity Discount Factor: DF_e = 1 / (1 + Ke)^y
            $dfEquity = round(1.0 / pow(1.0 + $costOfEquityDecimal, $y), 6);
            $discountedFcfe = $fcfe->multiply($dfEquity);
            $cumDiscountedFcfe = $cumDiscountedFcfe->add($discountedFcfe);

            $annualPeriods[$y] = new AnnualAppraisalPeriod(
                year: $y,
                ebit: $ebit,
                nopat: $nopat,
                depreciation: $depreciation,
                capex: $capex,
                workingCapitalChange: $wcChange,
                fcff: $fcff,
                discountRatePercent: $waccRatePercent,
                discountFactor: $dfFcff,
                discountedFcff: $discountedFcff,
                cumulativeDiscountedFcff: $cumDiscountedFcff,
                netIncome: $netIncome,
                debtDrawdown: $debtDrawdown,
                debtPrincipalRepaid: $debtRepaid,
                fcfe: $fcfe,
                costOfEquityPercent: $effectiveWacc->costOfEquityPercent(),
                discountFactorEquity: $dfEquity,
                discountedFcfe: $discountedFcfe,
                cumulativeDiscountedFcfe: $cumDiscountedFcfe
            );
        }

        // 5. Calculate Terminal Value (TV)
        $terminalValue = $this->calculateTerminalValue(
            project: $project,
            incomeStatement: $incomeStatement,
            balanceSheet: $balanceSheet,
            annualPeriods: $annualPeriods,
            method: $method,
            parameter: $parameter,
            wacc: $effectiveWacc,
            dynamicWacc: $effectiveDynamicWacc,
            currency: $currency,
            horizon: $horizon
        );

        // 6. Project / Enterprise Level Metrics
        $sumDiscountedFcff = $cumDiscountedFcff;
        $discountedTerminalValue = $terminalValue->discountedEnterpriseValue();
        $projectNpv = $sumDiscountedFcff->add($discountedTerminalValue);
        $enterpriseValue = $projectNpv->add($sumPvCapex);

        $pvCapexDec = $sumPvCapex->toDecimal();
        $profitabilityIndex = $pvCapexDec > 0.0
            ? round($enterpriseValue->toDecimal() / $pvCapexDec, 4)
            : 1.0;

        // Cash flow streams for IRR and Payback
        $projectCashFlows = [];
        $discountedProjectCashFlows = [];
        foreach ($annualPeriods as $y => $period) {
            $nomFlow = $period->fcff()->toDecimal();
            $discFlow = $period->discountedFcff()->toDecimal();
            if ($y === $horizon) {
                $nomFlow += $terminalValue->enterpriseValue()->toDecimal();
                $discFlow += $terminalValue->discountedEnterpriseValue()->toDecimal();
            }
            $projectCashFlows[$y] = $nomFlow;
            $discountedProjectCashFlows[$y] = $discFlow;
        }

        $projectIrr = $this->calculateIrr($projectCashFlows);
        $simplePaybackYears = $this->calculatePaybackPeriod($projectCashFlows);
        $discountedPaybackYears = $this->calculateDiscountedPaybackPeriod($discountedProjectCashFlows);

        // 7. Equity Level Metrics
        $initialEquity = $project->financingStructure()->totalEquity();
        $sumDiscountedFcfe = $cumDiscountedFcfe;
        $discountedEquityTv = $terminalValue->discountedEquityValue();

        // Equity NPV = -InitialEquity + SumDiscountedFCFE + DiscountedEquityTV
        $equityNpv = $sumDiscountedFcfe->add($discountedEquityTv)->subtract($initialEquity);

        // Equity Cash Flow vector for IRR & MoIC:
        // t = 0: -InitialEquity
        // t = 1..H: Operational distributions (FCFE + initial equity offset in Year 1)
        $equityCashFlows = [0 => -1.0 * $initialEquity->toDecimal()];
        $discountedEquityCashFlows = [0 => -1.0 * $initialEquity->toDecimal()];
        $totalEquityInflows = 0.0;

        foreach ($annualPeriods as $y => $period) {
            $nomEqFlow = $period->fcfe()->toDecimal();
            // In year 1, add back initial equity injection that was accounted in netBorrowing
            if ($y === 1) {
                $nomEqFlow += $initialEquity->toDecimal();
            }

            if ($y === $horizon) {
                $nomEqFlow += $terminalValue->equityValue()->toDecimal();
            }

            $equityCashFlows[$y] = $nomEqFlow;
            if ($nomEqFlow > 0.0) {
                $totalEquityInflows += $nomEqFlow;
            }

            $dfEq = $period->discountFactorEquity();
            $discountedEquityCashFlows[$y] = $nomEqFlow * $dfEq;
        }

        $equityIrr = $this->calculateIrr($equityCashFlows);
        $equitySimplePayback = $this->calculatePaybackPeriod($equityCashFlows);
        $equityDiscountedPayback = $this->calculateDiscountedPaybackPeriod($discountedEquityCashFlows);

        $initialEquityDec = $initialEquity->toDecimal();
        $equityMoic = $initialEquityDec > 0.0
            ? round($totalEquityInflows / $initialEquityDec, 2)
            : 0.0;

        return new AppraisalResult(
            currency: $currency,
            horizonYears: $horizon,
            wacc: $effectiveWacc,
            dynamicWacc: $effectiveDynamicWacc,
            terminalValue: $terminalValue,
            annualPeriods: $annualPeriods,
            sumDiscountedFcff: $sumDiscountedFcff,
            discountedTerminalValue: $discountedTerminalValue,
            enterpriseValue: $enterpriseValue,
            pvCapex: $sumPvCapex,
            projectNpv: $projectNpv,
            projectIrr: $projectIrr,
            simplePaybackYears: $simplePaybackYears,
            discountedPaybackYears: $discountedPaybackYears,
            profitabilityIndex: $profitabilityIndex,
            initialEquity: $initialEquity,
            sumDiscountedFcfe: $sumDiscountedFcfe,
            discountedEquityTerminalValue: $discountedEquityTv,
            equityNpv: $equityNpv,
            equityIrr: $equityIrr,
            equityMoic: $equityMoic,
            equitySimplePaybackYears: $equitySimplePayback,
            equityDiscountedPaybackYears: $equityDiscountedPayback
        );
    }

    /**
     * Calculate Terminal Value for Enterprise and Equity.
     *
     * @param  array<int, AnnualAppraisalPeriod>  $annualPeriods
     */
    public function calculateTerminalValue(
        InvestmentProject $project,
        IncomeStatement $incomeStatement,
        BalanceSheet $balanceSheet,
        array $annualPeriods,
        TerminalValueMethod $method,
        float $parameter,
        WaccResult $wacc,
        DynamicWaccSchedule $dynamicWacc,
        Currency $currency,
        int $horizon
    ): TerminalValue {
        $lastIs = $incomeStatement->annualStatement($horizon);
        $lastBs = $balanceSheet->annualStatement($horizon);
        $lastPeriod = $annualPeriods[$horizon] ?? null;

        $lastEbitda = $lastIs ? $lastIs->ebitda() : Money::zero($currency);
        $lastFcff = $lastPeriod ? $lastPeriod->fcff() : Money::zero($currency);

        $dfFcffLast = $dynamicWacc->cumulativeDiscountFactors(false)[$horizon]
            ?? $wacc->discountFactor($horizon);
        $dfEquityLast = round(1.0 / pow(1.0 + ($wacc->costOfEquityPercent() / 100.0), $horizon), 6);

        // 1. Enterprise Terminal Value
        $nomTvEnterprise = match ($method) {
            TerminalValueMethod::GORDON_GROWTH => (function () use ($lastFcff, $parameter, $dynamicWacc, $wacc, $horizon): Money {
                $g = $parameter / 100.0;
                $terminalWacc = ($dynamicWacc->annualWacc($horizon)?->nominalWaccPercent() ?? $wacc->nominalWaccPercent()) / 100.0;

                if ($terminalWacc <= $g) {
                    throw new InvalidArgumentException(
                        sprintf(
                            'WACC (%.2f%%) must be strictly greater than perpetual growth rate (%.2f%%) for Gordon Growth model.',
                            $terminalWacc * 100.0,
                            $g * 100.0
                        )
                    );
                }

                $nextYearFcff = $lastFcff->multiply(1.0 + $g);
                $spread = $terminalWacc - $g;

                return $nextYearFcff->divide($spread);
            })(),

            TerminalValueMethod::EXIT_MULTIPLE => $lastEbitda->multiply($parameter),

            TerminalValueMethod::BOOK_VALUE => (function () use ($lastBs, $currency): Money {
                if (! $lastBs) {
                    return Money::zero($currency);
                }
                $nbv = $lastBs->netBookValue();
                $rec = $lastBs->tradeReceivables();
                $inv = $lastBs->inventories();
                $pay = $lastBs->tradePayables();

                return $nbv->add($rec)->add($inv)->subtract($pay);
            })(),
        };

        if ($nomTvEnterprise->isNegative()) {
            $nomTvEnterprise = Money::zero($currency);
        }

        $discountedTvEnterprise = $nomTvEnterprise->multiply($dfFcffLast);

        // 2. Terminal Net Debt at Horizon Year H
        $ltDebt = $lastBs ? $lastBs->longTermDebt() : Money::zero($currency);
        $stDebt = $lastBs ? $lastBs->shortTermDebt() : Money::zero($currency);
        $vatDebt = $lastBs ? $lastBs->vatBridgeLoan() : Money::zero($currency);
        $cash = $lastBs ? $lastBs->cashAndEquivalents() : Money::zero($currency);

        $totalDebt = $ltDebt->add($stDebt)->add($vatDebt);
        $netDebt = $totalDebt->subtract($cash);

        // 3. Equity Terminal Value = Enterprise TV - Net Debt (clamped at zero)
        $nomTvEquity = $nomTvEnterprise->subtract($netDebt);
        if ($nomTvEquity->isNegative()) {
            $nomTvEquity = Money::zero($currency);
        }

        $discountedTvEquity = $nomTvEquity->multiply($dfEquityLast);

        return new TerminalValue(
            method: $method,
            parameter: $parameter,
            enterpriseValue: $nomTvEnterprise,
            discountedEnterpriseValue: $discountedTvEnterprise,
            equityValue: $nomTvEquity,
            discountedEquityValue: $discountedTvEquity
        );
    }

    /**
     * Production-grade numerical Internal Rate of Return (IRR) solver.
     * Uses Newton-Raphson with bracketed Bisection fallback, bounded within [-99.9%, +1000%].
     *
     * @param  array<int, float>  $cashFlows  Period index (0..N or 1..N) => Cash flow amount
     * @param  float  $guess  Initial discount rate guess (default 0.10 for 10%)
     * @return ?float Annual IRR in percent (e.g. 14.85 for 14.85%), or null if no valid root
     */
    public function calculateIrr(array $cashFlows, float $guess = 0.10): ?float
    {
        // 1. Sanity check: must have at least one positive and one negative cash flow
        $hasPositive = false;
        $hasNegative = false;
        foreach ($cashFlows as $cf) {
            if ($cf > 0.001) {
                $hasPositive = true;
            } elseif ($cf < -0.001) {
                $hasNegative = true;
            }
        }

        if (! $hasPositive || ! $hasNegative) {
            return null;
        }

        // Objective function: NPV(r)
        $f = static function (float $r) use ($cashFlows): float {
            $npv = 0.0;
            foreach ($cashFlows as $t => $cf) {
                if (abs($cf) < 1e-9) {
                    continue;
                }
                if ($t === 0) {
                    $npv += $cf;
                } else {
                    $denom = pow(1.0 + $r, (float) $t);
                    if (is_nan($denom) || is_infinite($denom) || abs($denom) < 1e-15) {
                        return INF;
                    }
                    $npv += $cf / $denom;
                }
            }

            return $npv;
        };

        // First derivative: dNPV(r)/dr
        $fPrime = static function (float $r) use ($cashFlows): float {
            $deriv = 0.0;
            foreach ($cashFlows as $t => $cf) {
                if (abs($cf) < 1e-9 || $t === 0) {
                    continue;
                }
                $denom = pow(1.0 + $r, (float) ($t + 1));
                if (is_nan($denom) || is_infinite($denom) || abs($denom) < 1e-15) {
                    return INF;
                }
                $deriv += (-1.0 * (float) $t * $cf) / $denom;
            }

            return $deriv;
        };

        // 2. Newton-Raphson method
        $r = $guess;
        $maxIterations = 60;
        $tolerance = 1e-7;

        for ($iter = 0; $iter < $maxIterations; $iter++) {
            $val = $f($r);
            if (abs($val) < $tolerance) {
                return round($r * 100.0, 4);
            }

            $prime = $fPrime($r);
            if (abs($prime) < 1e-12 || is_infinite($prime) || is_nan($prime)) {
                break; // Fall back to bisection
            }

            $step = $val / $prime;
            $rNext = $r - $step;

            if ($rNext <= -0.999 || $rNext > 10.0 || is_nan($rNext)) {
                break; // Overshoot, fall back to bisection
            }

            if (abs($rNext - $r) < 1e-8) {
                return round($rNext * 100.0, 4);
            }

            $r = $rNext;
        }

        // 3. Fallback: Bracketed Bisection search
        $bracketA = null;
        $bracketB = null;

        // Scan potential brackets from -90% to +500% in 5% increments
        for ($scan = -0.90; $scan <= 5.00; $scan += 0.05) {
            $fScan1 = $f($scan);
            $fScan2 = $f($scan + 0.05);

            if (is_finite($fScan1) && is_finite($fScan2) && ($fScan1 * $fScan2 <= 0.0)) {
                $bracketA = $scan;
                $bracketB = $scan + 0.05;
                break;
            }
        }

        if ($bracketA === null || $bracketB === null) {
            return null;
        }

        $low = $bracketA;
        $high = $bracketB;
        $fLow = $f($low);

        for ($bIter = 0; $bIter < 100; $bIter++) {
            $mid = ($low + $high) / 2.0;
            $fMid = $f($mid);

            if (abs($fMid) < $tolerance || ($high - $low) < 1e-8) {
                return round($mid * 100.0, 4);
            }

            if ($fLow * $fMid <= 0.0) {
                $high = $mid;
            } else {
                $low = $mid;
                $fLow = $fMid;
            }
        }

        return round((($low + $high) / 2.0) * 100.0, 4);
    }

    /**
     * Calculate Simple Payback Period using exact linear fractional interpolation.
     *
     * @param  array<int, float>  $cashFlows  Year => Cash flow amount
     * @param  float  $initialOutlay  Optional upfront investment outlay at t = 0
     * @return ?float Payback period in years, or null if not recovered within horizon
     */
    public function calculatePaybackPeriod(array $cashFlows, float $initialOutlay = 0.0): ?float
    {
        ksort($cashFlows);

        $cum = $initialOutlay > 0.0 ? -1.0 * $initialOutlay : 0.0;
        $hasStarted = $initialOutlay > 0.0;

        foreach ($cashFlows as $t => $flow) {
            if ($t === 0 && abs($flow) > 1e-6) {
                $cum = $flow;
                $hasStarted = true;

                continue;
            }

            if (! $hasStarted) {
                if ($flow < -1e-6) {
                    $cum = $flow;
                    $hasStarted = true;
                }

                continue;
            }

            $priorCum = $cum;
            $cum += $flow;

            if ($cum >= 0.0) {
                // Recovered in period t
                if ($flow <= 0.0) {
                    return (float) $t;
                }

                $fraction = abs($priorCum) / $flow;

                return round(($t - 1) + $fraction, 2);
            }
        }

        return null;
    }

    /**
     * Calculate Discounted Payback Period using discounted cash flows.
     *
     * @param  array<int, float>  $discountedCashFlows  Year => Discounted cash flow
     * @param  float  $initialOutlay  Optional upfront investment outlay at t = 0
     * @return ?float Discounted payback period in years, or null if not recovered
     */
    public function calculateDiscountedPaybackPeriod(array $discountedCashFlows, float $initialOutlay = 0.0): ?float
    {
        return $this->calculatePaybackPeriod($discountedCashFlows, $initialOutlay);
    }
}
