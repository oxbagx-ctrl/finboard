<?php

declare(strict_types=1);

namespace App\Contexts\InvestmentProject\Domain\Services;

use App\Contexts\Finance\Domain\ValueObjects\Currency;
use App\Contexts\Finance\Domain\ValueObjects\Money;
use App\Contexts\InvestmentProject\Domain\Model\InvestmentProject;
use App\Contexts\InvestmentProject\Domain\ValueObjects\AmortizationSchedule;
use App\Contexts\InvestmentProject\Domain\ValueObjects\AnnualIncomeStatement;
use App\Contexts\InvestmentProject\Domain\ValueObjects\DepreciationSchedule;
use App\Contexts\InvestmentProject\Domain\ValueObjects\IncomeStatement;
use App\Contexts\InvestmentProject\Domain\ValueObjects\IncomeStatementPeriod;
use App\Contexts\InvestmentProject\Domain\ValueObjects\OperatingAssumptions;
use App\Contexts\InvestmentProject\Domain\ValueObjects\TaxLossPool;
use App\Contexts\InvestmentProject\Domain\ValueObjects\VatBridgeSchedule;
use DateTimeImmutable;
use InvalidArgumentException;

final class IncomeStatementService
{
    public function __construct(
        private readonly ?DepreciationScheduleService $depreciationService = null,
        private readonly ?DebtAmortizationService $debtService = null,
        private readonly ?VatBridgeLoanService $vatService = null
    ) {
    }

    /**
     * Generates complete 15-year monthly and annual Income Statement (P&L) projection.
     */
    public function generateStatement(
        InvestmentProject $project,
        OperatingAssumptions $assumptions,
        int $horizonYears = 15,
        ?DepreciationSchedule $depreciationSchedule = null,
        ?AmortizationSchedule $debtSchedule = null,
        ?VatBridgeSchedule $vatSchedule = null
    ): IncomeStatement {
        if ($horizonYears < 1 || $horizonYears > 30) {
            throw new InvalidArgumentException(
                sprintf('Horizon years must be between 1 and 30, %d given.', $horizonYears)
            );
        }

        $currency = $assumptions->currency();
        $totalMonths = $horizonYears * 12;

        // Resolve or generate sub-schedules
        $depSchedule = $depreciationSchedule ?? $this->getDepreciationService()->generateSchedule($project, $horizonYears);
        $amortSchedule = $debtSchedule ?? $this->getDebtService()->generateSchedule($project->debtFacility());
        $vatBridgeSchedule = $vatSchedule ?? $this->getVatService()->generateSchedule($project);

        // Determine timeline and Commercial Operations Date (COD)
        $projectStartDate = new DateTimeImmutable($project->startDate()->format('Y-m-01'));
        $codDate = new DateTimeImmutable($project->commercialOperationStartDate()->format('Y-m-01'));

        $diff = $projectStartDate->diff($codDate);
        $codMonthOffset = ($diff->y * 12) + $diff->m;

        if ($codDate < $projectStartDate) {
            $codMonthOffset = 0;
        }

        // First month of commercial operation (1-based index)
        $firstCommercialMonth = $codMonthOffset + 1;

        $monthlyPeriods = [];
        $annualStatements = [];

        $taxLossPool = TaxLossPool::empty($currency);
        $taxLossCarryForwardEnabled = $assumptions->taxLossCarryForwardEnabled();
        $settlementMode = $assumptions->taxLossSettlementMode();
        $offsetCapPercent = $assumptions->taxLossOffsetCapPercent();
        $oneOffCapAmount = $assumptions->taxLossOneOffCapAmount();
        $citRatePercent = $assumptions->citRatePercent();
        $citRateFactor = (string) round($citRatePercent / 100.0, 6);

        for ($year = 1; $year <= $horizonYears; $year++) {
            // 1. Annual pool opening balance and statutory expirations (5-year expiry under art. 7 ust. 5 CIT)
            $openingPoolForYear = $taxLossPool->openingBalance($year);
            $expiredThisYear = Money::zero($currency);

            if ($taxLossCarryForwardEnabled) {
                // Settle with zero income to trigger statutory expirations (T+5) at the start of the tax year
                $initSettlement = $taxLossPool->settle(
                    currentYear: $year,
                    taxableIncome: Money::zero($currency),
                    mode: $settlementMode,
                    annualCapPercent: $offsetCapPercent,
                    oneOffCap: $oneOffCapAmount
                );
                $poolAtYearStart = $initSettlement['pool'];
                $expiredThisYear = $initSettlement['result']->lossExpired();
            } else {
                $poolAtYearStart = $taxLossPool;
            }

            // Year-To-Date (YTD) cumulative trackers for the current tax year
            $ytdEbt = Money::zero($currency);
            $cumulativeIntraYearLoss = Money::zero($currency);
            $cumulativePriorLossUsedThisYear = Money::zero($currency);
            $cumulativeCitPaidThisYear = Money::zero($currency);

            // Annual P&L item accumulators
            $annualRev = Money::zero($currency);
            $annualVar = Money::zero($currency);
            $annualFix = Money::zero($currency);
            $annualPay = Money::zero($currency);
            $annualDep = Money::zero($currency);
            $annualInterest = Money::zero($currency);

            for ($monthInYear = 1; $monthInYear <= 12; $monthInYear++) {
                $m = (($year - 1) * 12) + $monthInYear;
                if ($m > $totalMonths) {
                    break;
                }

                $periodDate = $projectStartDate->modify(sprintf('+%d months', $m - 1));
                $isCommercial = $m >= $firstCommercialMonth;

                // Operating items (Revenues & OPEX)
                if ($isCommercial) {
                    $operatingMonthIndex = $m - $firstCommercialMonth + 1;
                    $operatingYear = (int) ceil($operatingMonthIndex / 12);

                    // Revenue calculation with growth and capacity ramp-up
                    $revGrowthFactor = (1.0 + ($assumptions->revenueGrowthRatePercent() / 100.0)) ** ($operatingYear - 1);
                    $inflatedAnnualRev = $assumptions->annualRevenueBase()->multiply((string) round($revGrowthFactor, 6));

                    $capacityFactor = $assumptions->capacityUtilizationAtOperatingYear($operatingYear) / 100.0;
                    $effectiveAnnualRev = $inflatedAnnualRev->multiply((string) round($capacityFactor, 6));
                    $monthRevenue = $effectiveAnnualRev->divide(12);

                    // Variable costs (percentage of revenue)
                    $varCostFactor = (string) round($assumptions->variableCostPercent() / 100.0, 6);
                    $monthVariableCosts = $monthRevenue->multiply($varCostFactor);

                    // Fixed costs with inflation indexation
                    $fixedGrowthFactor = (1.0 + ($assumptions->fixedCostGrowthRatePercent() / 100.0)) ** ($operatingYear - 1);
                    $inflatedFixedAnnual = $assumptions->annualFixedCostsBase()->multiply((string) round($fixedGrowthFactor, 6));
                    $monthFixedCosts = $inflatedFixedAnnual->divide(12);

                    // Payroll costs with annual growth
                    $payrollGrowthFactor = (1.0 + ($assumptions->payrollGrowthRatePercent() / 100.0)) ** ($operatingYear - 1);
                    $inflatedPayrollAnnual = $assumptions->annualPayrollBase()->multiply((string) round($payrollGrowthFactor, 6));
                    $monthPayrollCosts = $inflatedPayrollAnnual->divide(12);
                } else {
                    // Construction / Pre-operating period
                    $monthRevenue = Money::zero($currency);
                    $monthVariableCosts = Money::zero($currency);
                    $monthFixedCosts = Money::zero($currency);
                    $monthPayrollCosts = Money::zero($currency);
                }

                $monthTotalOpex = $monthVariableCosts->add($monthFixedCosts)->add($monthPayrollCosts);
                $monthEbitda = $monthRevenue->subtract($monthTotalOpex);

                // Depreciation
                $depPeriod = $depSchedule->monthlyPeriod($m);
                $monthDepreciation = $depPeriod !== null
                    ? $depPeriod->depreciationCharge()
                    : Money::zero($currency);

                $monthEbit = $monthEbitda->subtract($monthDepreciation);

                // Financial Costs (Interest expense from senior debt and VAT facility)
                $debtPeriod = $amortSchedule->period($m);
                $debtInterest = $debtPeriod !== null
                    ? $debtPeriod->interestPayment()
                    : Money::zero($currency);

                $vatPeriod = $vatBridgeSchedule->period($m);
                $vatInterest = $vatPeriod !== null
                    ? $vatPeriod->interestPayment()
                    : Money::zero($currency);

                $monthInterestExpense = $debtInterest->add($vatInterest);
                if ($m === 1 && $amortSchedule->upfrontFee()->isPositive()) {
                    $monthInterestExpense = $monthInterestExpense->add($amortSchedule->upfrontFee());
                }
                $monthEbt = $monthEbit->subtract($monthInterestExpense);

                // Accumulate annual aggregates
                $annualRev = $annualRev->add($monthRevenue);
                $annualVar = $annualVar->add($monthVariableCosts);
                $annualFix = $annualFix->add($monthFixedCosts);
                $annualPay = $annualPay->add($monthPayrollCosts);
                $annualDep = $annualDep->add($monthDepreciation);
                $annualInterest = $annualInterest->add($monthInterestExpense);

                // CIT Advances & Tax Loss Carry-Forward (Annual YTD Model per art. 25 CIT)
                if ($monthEbt->isNegative()) {
                    if ($taxLossCarryForwardEnabled) {
                        $cumulativeIntraYearLoss = $cumulativeIntraYearLoss->add($monthEbt->multiply(-1));
                    }
                    $intraYearLossUsedThisMonth = Money::zero($currency);
                } else {
                    if ($taxLossCarryForwardEnabled && $cumulativeIntraYearLoss->isPositive()) {
                        $intraYearLossUsedThisMonth = $cumulativeIntraYearLoss->lessThan($monthEbt)
                            ? $cumulativeIntraYearLoss
                            : $monthEbt;
                        $cumulativeIntraYearLoss = $cumulativeIntraYearLoss->subtract($intraYearLossUsedThisMonth);
                    } else {
                        $intraYearLossUsedThisMonth = Money::zero($currency);
                    }
                }

                $ytdEbt = $ytdEbt->add($monthEbt);

                if ($ytdEbt->isPositive()) {
                    if ($taxLossCarryForwardEnabled && $poolAtYearStart->closingBalance($year)->isPositive()) {
                        $settleAttempt = $poolAtYearStart->settle(
                            currentYear: $year,
                            taxableIncome: $ytdEbt,
                            mode: $settlementMode,
                            annualCapPercent: $offsetCapPercent,
                            oneOffCap: $oneOffCapAmount
                        );
                        $currentYtdPriorLossUsed = $settleAttempt['result']->lossDeducted();
                        $currentYtdTaxableIncome = $settleAttempt['result']->taxableIncomeAfterDeduction();
                        $poolClosingAtThisYtd = $settleAttempt['result']->closingPoolBalance();
                    } else {
                        $currentYtdPriorLossUsed = Money::zero($currency);
                        $currentYtdTaxableIncome = $ytdEbt;
                        $poolClosingAtThisYtd = $poolAtYearStart->closingBalance($year);
                    }

                    $monthPriorLossUsed = $currentYtdPriorLossUsed->greaterThan($cumulativePriorLossUsedThisYear)
                        ? $currentYtdPriorLossUsed->subtract($cumulativePriorLossUsedThisYear)
                        : Money::zero($currency);
                    $cumulativePriorLossUsedThisYear = $cumulativePriorLossUsedThisYear->add($monthPriorLossUsed);

                    if ($citRatePercent > 0.0) {
                        $currentYtdCitDue = $currentYtdTaxableIncome->multiply($citRateFactor);
                    } else {
                        $currentYtdCitDue = Money::zero($currency);
                    }

                    $monthCit = $currentYtdCitDue->greaterThan($cumulativeCitPaidThisYear)
                        ? $currentYtdCitDue->subtract($cumulativeCitPaidThisYear)
                        : Money::zero($currency);
                    $cumulativeCitPaidThisYear = $cumulativeCitPaidThisYear->add($monthCit);

                    $monthTaxLossUsed = $intraYearLossUsedThisMonth->add($monthPriorLossUsed);
                    $monthTaxableIncome = $monthEbt->greaterThan($monthTaxLossUsed)
                        ? $monthEbt->subtract($monthTaxLossUsed)
                        : Money::zero($currency);
                    $monthLossClosing = $taxLossCarryForwardEnabled ? $poolClosingAtThisYtd : Money::zero($currency);
                } else {
                    $monthPriorLossUsed = Money::zero($currency);
                    $monthCit = Money::zero($currency);
                    $monthTaxLossUsed = $intraYearLossUsedThisMonth;
                    $monthTaxableIncome = Money::zero($currency);
                    $monthLossClosing = $taxLossCarryForwardEnabled
                        ? $poolAtYearStart->closingBalance($year)->add($cumulativeIntraYearLoss)
                        : Money::zero($currency);
                }

                $monthNetIncome = $monthEbt->subtract($monthCit);

                $monthlyPeriods[] = new IncomeStatementPeriod(
                    periodNumber: $m,
                    year: $year,
                    monthInYear: $monthInYear,
                    date: $periodDate,
                    isCommercialOperation: $isCommercial,
                    revenue: $monthRevenue,
                    variableCosts: $monthVariableCosts,
                    fixedCosts: $monthFixedCosts,
                    payrollCosts: $monthPayrollCosts,
                    totalOpex: $monthTotalOpex,
                    ebitda: $monthEbitda,
                    depreciation: $monthDepreciation,
                    ebit: $monthEbit,
                    interestExpense: $monthInterestExpense,
                    ebt: $monthEbt,
                    taxLossUsed: $monthTaxLossUsed,
                    taxableIncome: $monthTaxableIncome,
                    incomeTax: $monthCit,
                    netIncome: $monthNetIncome,
                    taxLossCarryForwardClosing: $monthLossClosing,
                    taxLossExpired: $monthInYear === 1 ? $expiredThisYear : Money::zero($currency),
                    taxLossCarryForwardOpening: $monthInYear === 1 ? $openingPoolForYear : $poolAtYearStart->closingBalance($year)
                );
            }

            // Final Annual Settlement & Pool Rollover to Year + 1
            $annualOpex = $annualVar->add($annualFix)->add($annualPay);
            $annualEbitda = $annualRev->subtract($annualOpex);
            $annualEbit = $annualEbitda->subtract($annualDep);
            $annualEbt = $ytdEbt;

            if ($taxLossCarryForwardEnabled) {
                if ($annualEbt->isNegative()) {
                    $taxLossPool = $poolAtYearStart->addLoss($year, $annualEbt->multiply(-1));
                    $annualPriorLossUsed = Money::zero($currency);
                    $annualTaxableIncome = Money::zero($currency);
                } elseif ($annualEbt->isPositive()) {
                    $finalSettlement = $poolAtYearStart->settle(
                        currentYear: $year,
                        taxableIncome: $annualEbt,
                        mode: $settlementMode,
                        annualCapPercent: $offsetCapPercent,
                        oneOffCap: $oneOffCapAmount
                    );
                    $taxLossPool = $finalSettlement['pool'];
                    $annualPriorLossUsed = $finalSettlement['result']->lossDeducted();
                    $annualTaxableIncome = $finalSettlement['result']->taxableIncomeAfterDeduction();
                } else {
                    $taxLossPool = $poolAtYearStart;
                    $annualPriorLossUsed = Money::zero($currency);
                    $annualTaxableIncome = Money::zero($currency);
                }
            } else {
                $taxLossPool = TaxLossPool::empty($currency);
                $annualPriorLossUsed = Money::zero($currency);
                $annualTaxableIncome = $annualEbt->isPositive() ? $annualEbt : Money::zero($currency);
            }

            $annualCit = $cumulativeCitPaidThisYear;
            $annualNetIncome = $annualEbt->subtract($annualCit);

            $annualStatements[$year] = new AnnualIncomeStatement(
                year: $year,
                revenue: $annualRev,
                variableCosts: $annualVar,
                fixedCosts: $annualFix,
                payrollCosts: $annualPay,
                totalOpex: $annualOpex,
                ebitda: $annualEbitda,
                depreciation: $annualDep,
                ebit: $annualEbit,
                interestExpense: $annualInterest,
                ebt: $annualEbt,
                taxLossUsed: $annualPriorLossUsed,
                taxableIncome: $annualTaxableIncome,
                incomeTax: $annualCit,
                netIncome: $annualNetIncome,
                taxLossCarryForwardClosing: $taxLossPool->closingBalance($year),
                taxLossExpired: $expiredThisYear,
                taxLossCarryForwardOpening: $openingPoolForYear
            );
        }

        return new IncomeStatement(
            currency: $currency,
            horizonYears: $horizonYears,
            assumptions: $assumptions,
            monthlyPeriods: $monthlyPeriods,
            annualStatements: $annualStatements
        );
    }

    private function getDepreciationService(): DepreciationScheduleService
    {
        return $this->depreciationService ?? new DepreciationScheduleService();
    }

    private function getDebtService(): DebtAmortizationService
    {
        return $this->debtService ?? new DebtAmortizationService();
    }

    private function getVatService(): VatBridgeLoanService
    {
        return $this->vatService ?? new VatBridgeLoanService();
    }
}
