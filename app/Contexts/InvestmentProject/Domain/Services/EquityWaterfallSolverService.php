<?php

declare(strict_types=1);

namespace App\Contexts\InvestmentProject\Domain\Services;

use App\Contexts\Finance\Domain\ValueObjects\Currency;
use App\Contexts\Finance\Domain\ValueObjects\Money;
use App\Contexts\InvestmentProject\Domain\Model\InvestmentProject;
use App\Contexts\InvestmentProject\Domain\ValueObjects\AppraisalResult;
use App\Contexts\InvestmentProject\Domain\ValueObjects\InvestorReturn;
use App\Contexts\InvestmentProject\Domain\ValueObjects\WaterfallAnnualPeriod;
use App\Contexts\InvestmentProject\Domain\ValueObjects\WaterfallResult;
use App\Contexts\InvestmentProject\Domain\ValueObjects\WaterfallStructure;
use InvalidArgumentException;

final class EquityWaterfallSolverService
{
    public function __construct(
        private readonly InvestmentAppraisalService $appraisalService
    ) {
    }

    /**
     * Solve and simulate the multi-tier equity waterfall distribution over project horizon.
     */
    public function solve(
        InvestmentProject $project,
        AppraisalResult $appraisal,
        ?WaterfallStructure $structure = null
    ): WaterfallResult {
        $currency = $project->financingStructure()->investor1Equity()->currency();
        $horizon = $project->planningHorizonYears();

        $equity1 = $project->financingStructure()->investor1Equity();
        $equity2 = $project->financingStructure()->investor2Equity();
        $totalEquity = $project->financingStructure()->totalEquity();

        $inv1Share = $project->financingStructure()->investor1Share();
        $inv2Share = $project->financingStructure()->investor2Share();

        // 1. Resolve waterfall structure (default to Pari Passu if not provided)
        $effectiveStructure = $structure ?? WaterfallStructure::pariPassu($inv1Share, $inv2Share);

        // 2. Prepare annual cash flows available to equity
        // Year 1..H: operational distributions, and in Year H: plus exit equity terminal value
        $availableCash = [];
        $totalCashAvailableOverHorizon = Money::zero($currency);

        for ($y = 1; $y <= $horizon; $y++) {
            $period = $appraisal->annualPeriod($y);
            $flowNominal = $period ? $period->fcfe() : Money::zero($currency);

            // In year 1, add back initial equity injection that was accounted in netBorrowing
            if ($y === 1) {
                $flowNominal = $flowNominal->add($totalEquity);
            }

            // In final year, add exit equity terminal value
            if ($y === $horizon) {
                $exitEquity = $appraisal->terminalValue()->equityValue();
                $flowNominal = $flowNominal->add($exitEquity);
            }

            // Non-negative distribution: if project produces cash, it is distributed
            $distributable = $flowNominal->isPositive() ? $flowNominal : Money::zero($currency);
            $availableCash[$y] = $distributable;
            $totalCashAvailableOverHorizon = $totalCashAvailableOverHorizon->add($distributable);
        }

        // 3. Multi-tier Waterfall Simulation
        $inv1Distributions = [];
        $inv2Distributions = [];
        $annualPeriods = [];

        $totalInv1Distributed = Money::zero($currency);
        $totalInv2Distributed = Money::zero($currency);

        $e1Float = $equity1->toDecimal();
        $e2Float = $equity2->toDecimal();

        $inv2HistoricalDists = [];

        for ($y = 1; $y <= $horizon; $y++) {
            $distributable = $availableCash[$y];
            $cashRemaining = $distributable->toDecimal();

            $inv1YearDist = 0.0;
            $inv2YearDist = 0.0;

            foreach ($effectiveStructure->tiers() as $tier) {
                if ($cashRemaining <= 1e-6) {
                    break;
                }

                $s1 = $tier->investor1SplitDecimal();
                $s2 = $tier->investor2SplitDecimal();

                if ($tier->isResidual() || $e2Float <= 0.0) {
                    // Residual tier absorbs all remaining cash
                    $inv1Part = $cashRemaining * $s1;
                    $inv2Part = $cashRemaining * $s2;

                    $inv1YearDist += $inv1Part;
                    $inv2YearDist += $inv2Part;
                    $cashRemaining = 0.0;
                    break;
                }

                // Hurdle tier: Calculate capacity needed to achieve hurdle rate r for Investor 2
                $r = ($tier->hurdleRatePercent() ?? 0.0) / 100.0;

                // Accrued requirement for Investor 2 at year y to reach hurdle r
                $accruedReq = $e2Float * pow(1.0 + $r, (float) $y);
                foreach ($inv2HistoricalDists as $pastYear => $pastDist) {
                    $accruedReq -= $pastDist * pow(1.0 + $r, (float) ($y - $pastYear));
                }

                // Remaining capacity for Investor 2 in this tier in current year
                $inv2Cap = max(0.0, $accruedReq - $inv2YearDist);

                if ($inv2Cap <= 1e-6 || $s2 <= 1e-6) {
                    // Hurdle already satisfied in previous tiers/years, skip to next tier
                    continue;
                }

                // Total project cash needed in this tier so that Investor 2 gets $inv2Cap
                $tierCashNeeded = $inv2Cap / $s2;

                if ($cashRemaining <= $tierCashNeeded) {
                    // Cash runs out in this tier
                    $inv1Part = $cashRemaining * $s1;
                    $inv2Part = $cashRemaining * $s2;

                    $inv1YearDist += $inv1Part;
                    $inv2YearDist += $inv2Part;
                    $cashRemaining = 0.0;
                    break;
                }

                // Tier is fully satisfied, cash overflows into next tier
                $inv1Part = $tierCashNeeded * $s1;
                $inv2Part = $tierCashNeeded * $s2;

                $inv1YearDist += $inv1Part;
                $inv2YearDist += $inv2Part;
                $cashRemaining -= $tierCashNeeded;
            }

            // Ensure exact decimal penny rounding conservation
            $inv1Money = Money::fromDecimal(sprintf('%.4f', $inv1YearDist), $currency);
            $inv2Money = $distributable->subtract($inv1Money); // Exact zero-leakage closure

            $inv1Distributions[$y] = $inv1Money;
            $inv2Distributions[$y] = $inv2Money;
            $inv2HistoricalDists[$y] = $inv2Money->toDecimal();

            $totalInv1Distributed = $totalInv1Distributed->add($inv1Money);
            $totalInv2Distributed = $totalInv2Distributed->add($inv2Money);

            $annualPeriods[$y] = new WaterfallAnnualPeriod(
                year: $y,
                totalCashAvailable: $distributable,
                investor1Distribution: $inv1Money,
                investor2Distribution: $inv2Money,
                isExitYear: ($y === $horizon)
            );
        }

        // 4. Calculate Investor Return Metrics
        $costOfEquityDecimal = $appraisal->wacc()->costOfEquityPercent() / 100.0;

        $inv1Return = $this->buildInvestorReturn(
            investorIndex: 1,
            investorName: 'Investor 1 (Sponsor)',
            initialEquity: $equity1,
            equitySharePercent: $inv1Share,
            annualDistributions: $inv1Distributions,
            exitYear: $horizon,
            discountRateDecimal: $costOfEquityDecimal,
            currency: $currency
        );

        $inv2Return = $this->buildInvestorReturn(
            investorIndex: 2,
            investorName: 'Investor 2 (Financial Partner)',
            initialEquity: $equity2,
            equitySharePercent: $inv2Share,
            annualDistributions: $inv2Distributions,
            exitYear: $horizon,
            discountRateDecimal: $costOfEquityDecimal,
            currency: $currency
        );

        return new WaterfallResult(
            currency: $currency,
            horizonYears: $horizon,
            totalEquityInvested: $totalEquity,
            totalCashDistributed: $totalCashAvailableOverHorizon,
            structure: $effectiveStructure,
            investor1Return: $inv1Return,
            investor2Return: $inv2Return,
            annualPeriods: $annualPeriods
        );
    }

    /**
     * Numerical root-finding solver: Solves for the Sponsor Promote percentage in Tier 2
     * that yields exactly Investor 2's target IRR.
     *
     * @param float $targetIrrInvestor2 Desired annual return % for Investor 2 (e.g. 12.0)
     * @param float $hurdle1 Preferred return % for Tier 1 (default 8.0)
     */
    public function solveForTargetIrr(
        InvestmentProject $project,
        AppraisalResult $appraisal,
        float $targetIrrInvestor2,
        float $hurdle1 = 8.0
    ): WaterfallResult {
        if ($targetIrrInvestor2 <= 0.0 || $targetIrrInvestor2 > 200.0) {
            throw new InvalidArgumentException(
                sprintf('Target IRR must be between 0.0%% and 200.0%%, %.2f%% given.', $targetIrrInvestor2)
            );
        }

        $inv1Share = $project->financingStructure()->investor1Share();
        $inv2Share = $project->financingStructure()->investor2Share();

        // Objective function: evaluate realized IRR for Investor 2 given promote percentage p
        $evaluatePromote = function (float $promote) use ($project, $appraisal, $hurdle1, $inv1Share, $inv2Share): WaterfallResult {
            $structure = WaterfallStructure::standardTwoTier(
                hurdleRatePercent: $hurdle1,
                sponsorPromotePercent: $promote,
                investor1SharePercent: $inv1Share,
                investor2SharePercent: $inv2Share
            );

            return $this->solve($project, $appraisal, $structure);
        };

        // Monotonic check at bounds p = 0.0% (min promote, max LP IRR) and p = 100.0% (max promote, min LP IRR)
        $resMinPromote = $evaluatePromote(0.0);
        $resMaxPromote = $evaluatePromote(100.0);

        $irrAtMinPromote = $resMinPromote->investor2Return()->irr() ?? 0.0;
        $irrAtMaxPromote = $resMaxPromote->investor2Return()->irr() ?? 0.0;

        if ($targetIrrInvestor2 >= $irrAtMinPromote) {
            // Even with 0% promote, Investor 2 cannot exceed $irrAtMinPromote
            $variance = round($irrAtMinPromote - $targetIrrInvestor2, 4);

            return new WaterfallResult(
                currency: $resMinPromote->currency(),
                horizonYears: $resMinPromote->horizonYears(),
                totalEquityInvested: $resMinPromote->totalEquityInvested(),
                totalCashDistributed: $resMinPromote->totalCashDistributed(),
                structure: $resMinPromote->structure(),
                investor1Return: $resMinPromote->investor1Return(),
                investor2Return: $resMinPromote->investor2Return(),
                annualPeriods: $resMinPromote->annualPeriods(),
                targetIrr: $targetIrrInvestor2,
                targetIrrVariance: $variance
            );
        }

        if ($targetIrrInvestor2 <= $irrAtMaxPromote) {
            // Even with 100% promote, Investor 2 still gets at least $irrAtMaxPromote
            $variance = round($irrAtMaxPromote - $targetIrrInvestor2, 4);

            return new WaterfallResult(
                currency: $resMaxPromote->currency(),
                horizonYears: $resMaxPromote->horizonYears(),
                totalEquityInvested: $resMaxPromote->totalEquityInvested(),
                totalCashDistributed: $resMaxPromote->totalCashDistributed(),
                structure: $resMaxPromote->structure(),
                investor1Return: $resMaxPromote->investor1Return(),
                investor2Return: $resMaxPromote->investor2Return(),
                annualPeriods: $resMaxPromote->annualPeriods(),
                targetIrr: $targetIrrInvestor2,
                targetIrrVariance: $variance
            );
        }

        // Binary Search / Bisection for Promote p in [0.0, 100.0]
        $lowP = 0.0;
        $highP = 100.0;
        $bestResult = $resMinPromote;
        $tolerance = 1e-4; // 0.01% IRR accuracy

        for ($iter = 0; $iter < 35; $iter++) {
            $midP = ($lowP + $highP) / 2.0;
            $currentResult = $evaluatePromote($midP);
            $currentIrr = $currentResult->investor2Return()->irr() ?? 0.0;

            $diff = $currentIrr - $targetIrrInvestor2;
            $bestResult = $currentResult;

            if (abs($diff) < $tolerance || ($highP - $lowP) < 1e-5) {
                break;
            }

            // Realized IRR is decreasing with respect to promote percentage
            if ($diff > 0.0) {
                // Current IRR is higher than target -> Increase promote to reduce LP return
                $lowP = $midP;
            } else {
                // Current IRR is lower than target -> Decrease promote to increase LP return
                $highP = $midP;
            }
        }

        $finalIrr = $bestResult->investor2Return()->irr() ?? 0.0;
        $finalVariance = round($finalIrr - $targetIrrInvestor2, 4);

        return new WaterfallResult(
            currency: $bestResult->currency(),
            horizonYears: $bestResult->horizonYears(),
            totalEquityInvested: $bestResult->totalEquityInvested(),
            totalCashDistributed: $bestResult->totalCashDistributed(),
            structure: $bestResult->structure(),
            investor1Return: $bestResult->investor1Return(),
            investor2Return: $bestResult->investor2Return(),
            annualPeriods: $bestResult->annualPeriods(),
            targetIrr: $targetIrrInvestor2,
            targetIrrVariance: $finalVariance
        );
    }

    /**
     * Build comprehensive return metrics for an individual investor.
     *
     * @param array<int, Money> $annualDistributions
     */
    private function buildInvestorReturn(
        int $investorIndex,
        string $investorName,
        Money $initialEquity,
        float $equitySharePercent,
        array $annualDistributions,
        int $exitYear,
        float $discountRateDecimal,
        Currency $currency
    ): InvestorReturn {
        $totalDist = Money::zero($currency);
        $npv = Money::zero($currency)->subtract($initialEquity);

        $cashFlowsForIrr = [0 => -1.0 * $initialEquity->toDecimal()];
        $discountedCashFlows = [0 => -1.0 * $initialEquity->toDecimal()];

        $exitDist = $annualDistributions[$exitYear] ?? Money::zero($currency);

        foreach ($annualDistributions as $year => $dist) {
            $totalDist = $totalDist->add($dist);

            $distDec = $dist->toDecimal();
            $cashFlowsForIrr[$year] = $distDec;

            $df = 1.0 / pow(1.0 + $discountRateDecimal, (float) $year);
            $discDist = $dist->multiply($df);
            $npv = $npv->add($discDist);

            $discountedCashFlows[$year] = $distDec * $df;
        }

        $netProfit = $totalDist->subtract($initialEquity);

        $initialDec = $initialEquity->toDecimal();
        $moic = $initialDec > 0.0
            ? round($totalDist->toDecimal() / $initialDec, 2)
            : 0.0;

        $irr = $this->appraisalService->calculateIrr($cashFlowsForIrr);
        $simplePayback = $this->appraisalService->calculatePaybackPeriod($cashFlowsForIrr);
        $discountedPayback = $this->appraisalService->calculateDiscountedPaybackPeriod($discountedCashFlows);

        return new InvestorReturn(
            investorIndex: $investorIndex,
            investorName: $investorName,
            initialEquity: $initialEquity,
            equitySharePercent: $equitySharePercent,
            annualDistributions: $annualDistributions,
            exitDistribution: $exitDist,
            totalDistributions: $totalDist,
            netProfit: $netProfit,
            moic: $moic,
            irr: $irr,
            npv: $npv,
            simplePaybackYears: $simplePayback,
            discountedPaybackYears: $discountedPayback
        );
    }
}
