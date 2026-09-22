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
        $taxLossPool = Money::zero($currency);

        for ($m = 1; $m <= $totalMonths; $m++) {
            $year = (int) ceil($m / 12);
            $monthInYear = (($m - 1) % 12) + 1;
            $periodDate = $projectStartDate->modify(sprintf('+%d months', $m - 1));

            $isCommercial = $m >= $firstCommercialMonth;

            // 1. Operating items (Revenues & OPEX)
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

            // 2. Depreciation
            $depPeriod = $depSchedule->monthlyPeriod($m);
            $monthDepreciation = $depPeriod !== null
                ? $depPeriod->depreciationCharge()
                : Money::zero($currency);

            $monthEbit = $monthEbitda->subtract($monthDepreciation);

            // 3. Financial Costs (Interest expense from debt and VAT facility)
            $debtPeriod = $amortSchedule->period($m);
            $debtInterest = $debtPeriod !== null
                ? $debtPeriod->interestPayment()
                : Money::zero($currency);

            $vatPeriod = $vatBridgeSchedule->period($m);
            $vatInterest = $vatPeriod !== null
                ? $vatPeriod->interestPayment()
                : Money::zero($currency);

            $monthInterestExpense = $debtInterest->add($vatInterest);
            $monthEbt = $monthEbit->subtract($monthInterestExpense);

            // 4. CIT & Tax Loss Carry-Forward
            $taxLossUsed = Money::zero($currency);
            $taxableIncome = Money::zero($currency);
            $monthCit = Money::zero($currency);

            if ($monthEbt->isNegative()) {
                // Loss in period: No CIT, accumulate to tax loss pool if enabled
                if ($assumptions->taxLossCarryForwardEnabled()) {
                    $taxLossPool = $taxLossPool->add($monthEbt->multiply(-1));
                }
                $monthNetIncome = $monthEbt;
            } else {
                // Profit in period: offset against tax loss pool
                $profit = $monthEbt;
                if ($assumptions->taxLossCarryForwardEnabled() && $taxLossPool->isPositive()) {
                    $maxOffsetFactor = (string) round($assumptions->taxLossOffsetCapPercent() / 100.0, 6);
                    $maxOffsetAllowed = $profit->multiply($maxOffsetFactor);

                    $taxLossUsed = $taxLossPool->greaterThan($maxOffsetAllowed)
                        ? $maxOffsetAllowed
                        : $taxLossPool;

                    $taxLossPool = $taxLossPool->subtract($taxLossUsed);
                }

                $taxableIncome = $profit->subtract($taxLossUsed);
                if ($taxableIncome->isPositive() && $assumptions->citRatePercent() > 0.0) {
                    $citFactor = (string) round($assumptions->citRatePercent() / 100.0, 6);
                    $monthCit = $taxableIncome->multiply($citFactor);
                }

                $monthNetIncome = $monthEbt->subtract($monthCit);
            }

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
                taxLossUsed: $taxLossUsed,
                taxableIncome: $taxableIncome,
                incomeTax: $monthCit,
                netIncome: $monthNetIncome,
                taxLossCarryForwardClosing: $taxLossPool
            );
        }

        // 5. Aggregate Annual Statements (1..horizonYears)
        $annualStatements = $this->aggregateAnnualStatements($monthlyPeriods, $horizonYears, $currency);

        return new IncomeStatement(
            currency: $currency,
            horizonYears: $horizonYears,
            assumptions: $assumptions,
            monthlyPeriods: $monthlyPeriods,
            annualStatements: $annualStatements
        );
    }

    /**
     * Aggregates 12 monthly periods into each annual P&L statement.
     *
     * @param array<IncomeStatementPeriod> $periods
     * @return array<int, AnnualIncomeStatement>
     */
    private function aggregateAnnualStatements(array $periods, int $horizonYears, Currency $currency): array
    {
        $annual = [];

        for ($year = 1; $year <= $horizonYears; $year++) {
            $startIdx = ($year - 1) * 12;
            $endIdx = min(count($periods) - 1, ($year * 12) - 1);

            $rev = Money::zero($currency);
            $var = Money::zero($currency);
            $fix = Money::zero($currency);
            $pay = Money::zero($currency);
            $opex = Money::zero($currency);
            $ebitda = Money::zero($currency);
            $dep = Money::zero($currency);
            $ebit = Money::zero($currency);
            $interest = Money::zero($currency);
            $ebt = Money::zero($currency);
            $taxLossUsed = Money::zero($currency);
            $taxable = Money::zero($currency);
            $cit = Money::zero($currency);
            $net = Money::zero($currency);

            for ($idx = $startIdx; $idx <= $endIdx; $idx++) {
                $p = $periods[$idx];
                $rev = $rev->add($p->revenue());
                $var = $var->add($p->variableCosts());
                $fix = $fix->add($p->fixedCosts());
                $pay = $pay->add($p->payrollCosts());
                $opex = $opex->add($p->totalOpex());
                $ebitda = $ebitda->add($p->ebitda());
                $dep = $dep->add($p->depreciation());
                $ebit = $ebit->add($p->ebit());
                $interest = $interest->add($p->interestExpense());
                $ebt = $ebt->add($p->ebt());
                $taxLossUsed = $taxLossUsed->add($p->taxLossUsed());
                $taxable = $taxable->add($p->taxableIncome());
                $cit = $cit->add($p->incomeTax());
                $net = $net->add($p->netIncome());
            }

            $endPeriod = $periods[$endIdx];

            $annual[$year] = new AnnualIncomeStatement(
                year: $year,
                revenue: $rev,
                variableCosts: $var,
                fixedCosts: $fix,
                payrollCosts: $pay,
                totalOpex: $opex,
                ebitda: $ebitda,
                depreciation: $dep,
                ebit: $ebit,
                interestExpense: $interest,
                ebt: $ebt,
                taxLossUsed: $taxLossUsed,
                taxableIncome: $taxable,
                incomeTax: $cit,
                netIncome: $net,
                taxLossCarryForwardClosing: $endPeriod->taxLossCarryForwardClosing()
            );
        }

        return $annual;
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
