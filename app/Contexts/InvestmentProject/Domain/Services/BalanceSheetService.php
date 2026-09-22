<?php

declare(strict_types=1);

namespace App\Contexts\InvestmentProject\Domain\Services;

use App\Contexts\Finance\Domain\ValueObjects\Currency;
use App\Contexts\Finance\Domain\ValueObjects\Money;
use App\Contexts\InvestmentProject\Domain\Model\InvestmentProject;
use App\Contexts\InvestmentProject\Domain\ValueObjects\AmortizationSchedule;
use App\Contexts\InvestmentProject\Domain\ValueObjects\AnnualBalanceSheet;
use App\Contexts\InvestmentProject\Domain\ValueObjects\BalanceSheet;
use App\Contexts\InvestmentProject\Domain\ValueObjects\BalanceSheetPeriod;
use App\Contexts\InvestmentProject\Domain\ValueObjects\CashFlowStatement;
use App\Contexts\InvestmentProject\Domain\ValueObjects\DepreciationSchedule;
use App\Contexts\InvestmentProject\Domain\ValueObjects\GrantCalculationResult;
use App\Contexts\InvestmentProject\Domain\ValueObjects\IncomeStatement;
use App\Contexts\InvestmentProject\Domain\ValueObjects\OperatingAssumptions;
use App\Contexts\InvestmentProject\Domain\ValueObjects\VatBridgeSchedule;
use DateTimeImmutable;
use InvalidArgumentException;

final class BalanceSheetService
{
    public function __construct(
        private readonly ?CashFlowService $cashFlowService = null,
        private readonly ?IncomeStatementService $incomeStatementService = null,
        private readonly ?DepreciationScheduleService $depreciationService = null,
        private readonly ?DebtAmortizationService $debtService = null,
        private readonly ?VatBridgeLoanService $vatService = null,
        private readonly ?GrantAllocationService $grantService = null
    ) {
    }

    /**
     * Generates a complete 15-year monthly and annual Balance Sheet with zero-variance validation.
     */
    public function generateStatement(
        InvestmentProject $project,
        OperatingAssumptions $assumptions,
        int $horizonYears = 15,
        ?CashFlowStatement $cashFlowStatement = null,
        ?IncomeStatement $incomeStatement = null,
        ?DepreciationSchedule $depreciationSchedule = null,
        ?AmortizationSchedule $debtSchedule = null,
        ?VatBridgeSchedule $vatSchedule = null,
        ?GrantCalculationResult $grantResult = null
    ): BalanceSheet {
        if ($horizonYears < 1 || $horizonYears > 30) {
            throw new InvalidArgumentException(
                sprintf('Horizon years must be between 1 and 30, %d given.', $horizonYears)
            );
        }

        $currency = $assumptions->currency();
        $totalMonths = $horizonYears * 12;

        // Resolve or generate all collaborating financial schedules
        $depSchedule = $depreciationSchedule ?? $this->getDepreciationService()->generateSchedule($project, $horizonYears);
        $amortSchedule = $debtSchedule ?? $this->getDebtService()->generateSchedule($project->debtFacility());
        $vatBridgeSchedule = $vatSchedule ?? $this->getVatService()->generateSchedule($project);
        $grantCalcResult = $grantResult ?? $this->getGrantService()->generateSchedule($project);
        $pnl = $incomeStatement ?? $this->getIncomeStatementService()->generateStatement(
            $project,
            $assumptions,
            $horizonYears,
            $depSchedule,
            $amortSchedule,
            $vatBridgeSchedule
        );
        $cashFlow = $cashFlowStatement ?? $this->getCashFlowService()->generateStatement(
            $project,
            $assumptions,
            $horizonYears,
            $pnl,
            $depSchedule,
            $amortSchedule,
            $vatBridgeSchedule,
            $grantCalcResult
        );

        $workingCapitalDays = $project->workingCapitalDays();
        $projectStartDate = new DateTimeImmutable($project->startDate()->format('Y-m-01'));

        $monthlyPeriods = [];
        $accumulatedRetainedEarnings = Money::zero($currency);
        $cumulativeGrantReceived = Money::zero($currency);
        $shareCapital = $project->financingStructure()->totalEquity();

        for ($m = 1; $m <= $totalMonths; $m++) {
            $year = (int) ceil($m / 12);
            $monthInYear = (($m - 1) % 12) + 1;
            $periodDate = $projectStartDate->modify(sprintf('+%d months', $m - 1));

            // 1. Non-current Assets
            $depPeriod = $depSchedule->monthlyPeriod($m);
            $netBookValue = $depPeriod ? $depPeriod->netBookValueClosing() : Money::zero($currency);
            $cip = $depPeriod ? $depPeriod->constructionInProgressClosing() : Money::zero($currency);
            $totalFixedAssets = $netBookValue->add($cip);

            // 2. Current Assets
            $pnlPeriod = $pnl->monthlyPeriod($m);
            $monthRev = $pnlPeriod ? $pnlPeriod->revenue() : Money::zero($currency);
            $monthVar = $pnlPeriod ? $pnlPeriod->variableCosts() : Money::zero($currency);
            $monthFix = $pnlPeriod ? $pnlPeriod->fixedCosts() : Money::zero($currency);

            $receivables = $monthRev->multiply($workingCapitalDays->dso())->divide(30);
            $inventories = $monthVar->multiply($workingCapitalDays->dio())->divide(30);

            $vatPeriod = $vatBridgeSchedule->period($m);
            $vatReceivable = $vatPeriod ? $vatPeriod->closingBalance() : Money::zero($currency);

            $cfPeriod = $cashFlow->monthlyPeriod($m);
            $cash = $cfPeriod ? $cfPeriod->closingCashBalance() : Money::zero($currency);

            $totalCurrentAssets = $receivables->add($inventories)->add($vatReceivable)->add($cash);
            $totalAssets = $totalFixedAssets->add($totalCurrentAssets);

            // 3. Equity
            $currentNetIncome = $pnlPeriod ? $pnlPeriod->netIncome() : Money::zero($currency);
            $totalEquity = $shareCapital->add($accumulatedRetainedEarnings)->add($currentNetIncome);

            // 4. Liabilities
            // Total Senior Debt Outstanding at month m
            $totalDebtOutstanding = $amortSchedule->outstandingBalanceAt($m);

            // Determine Short-Term Senior Debt (portion maturing within next 12 months)
            $shortTermDebt = Money::zero($currency);
            $maxFutureMonth = min($totalMonths, $m + 12);
            for ($futureM = $m + 1; $futureM <= $maxFutureMonth; $futureM++) {
                $futurePeriod = $amortSchedule->period($futureM);
                if ($futurePeriod !== null) {
                    $shortTermDebt = $shortTermDebt->add($futurePeriod->principalPayment());
                }
            }
            if ($shortTermDebt->greaterThan($totalDebtOutstanding)) {
                $shortTermDebt = $totalDebtOutstanding;
            }
            $longTermDebt = $totalDebtOutstanding->subtract($shortTermDebt);

            // VAT Bridge Loan (Current Liability)
            $vatBridgeLoan = $vatPeriod ? $vatPeriod->closingBalance() : Money::zero($currency);

            // Trade Payables
            $payables = $monthVar->add($monthFix)->multiply($workingCapitalDays->dpo())->divide(30);

            // Deferred Grant Revenue (RMP)
            $grantInPeriod = $grantCalcResult->disbursementAtMonth($m);
            $cumulativeGrantReceived = $cumulativeGrantReceived->add($grantInPeriod);
            $deferredGrantRevenue = $cumulativeGrantReceived;

            $totalLiabilities = $longTermDebt
                ->add($shortTermDebt)
                ->add($vatBridgeLoan)
                ->add($payables)
                ->add($deferredGrantRevenue);

            $totalEquityAndLiabilities = $totalEquity->add($totalLiabilities);

            // 5. Balance Reconciliation Check
            $variance = $totalAssets->subtract($totalEquityAndLiabilities);
            $isBalanced = $variance->isZero();

            $monthlyPeriods[] = new BalanceSheetPeriod(
                periodNumber: $m,
                year: $year,
                monthInYear: $monthInYear,
                date: $periodDate,
                netBookValue: $netBookValue,
                constructionInProgress: $cip,
                totalFixedAssets: $totalFixedAssets,
                tradeReceivables: $receivables,
                inventories: $inventories,
                vatReceivable: $vatReceivable,
                cashAndEquivalents: $cash,
                totalCurrentAssets: $totalCurrentAssets,
                totalAssets: $totalAssets,
                shareCapital: $shareCapital,
                retainedEarnings: $accumulatedRetainedEarnings,
                currentPeriodNetIncome: $currentNetIncome,
                totalEquity: $totalEquity,
                longTermDebt: $longTermDebt,
                shortTermDebt: $shortTermDebt,
                vatBridgeLoan: $vatBridgeLoan,
                tradePayables: $payables,
                deferredGrantRevenue: $deferredGrantRevenue,
                totalLiabilities: $totalLiabilities,
                totalEquityAndLiabilities: $totalEquityAndLiabilities,
                variance: $variance,
                isBalanced: $isBalanced
            );

            // Retained earnings rolls forward for next period
            $accumulatedRetainedEarnings = $accumulatedRetainedEarnings->add($currentNetIncome);
        }

        $annualStatements = $this->aggregateAnnualStatements($monthlyPeriods, $horizonYears, $currency);

        return new BalanceSheet(
            currency: $currency,
            horizonYears: $horizonYears,
            monthlyPeriods: $monthlyPeriods,
            annualStatements: $annualStatements
        );
    }

    /**
     * @param array<BalanceSheetPeriod> $periods
     * @return array<int, AnnualBalanceSheet>
     */
    private function aggregateAnnualStatements(array $periods, int $horizonYears, Currency $currency): array
    {
        $annual = [];

        for ($year = 1; $year <= $horizonYears; $year++) {
            $endIdx = min(count($periods) - 1, ($year * 12) - 1);
            $endPeriod = $periods[$endIdx];

            $annual[$year] = new AnnualBalanceSheet(
                year: $year,
                netBookValue: $endPeriod->netBookValue(),
                constructionInProgress: $endPeriod->constructionInProgress(),
                totalFixedAssets: $endPeriod->totalFixedAssets(),
                tradeReceivables: $endPeriod->tradeReceivables(),
                inventories: $endPeriod->inventories(),
                vatReceivable: $endPeriod->vatReceivable(),
                cashAndEquivalents: $endPeriod->cashAndEquivalents(),
                totalCurrentAssets: $endPeriod->totalCurrentAssets(),
                totalAssets: $endPeriod->totalAssets(),
                shareCapital: $endPeriod->shareCapital(),
                retainedEarnings: $endPeriod->retainedEarnings(),
                currentPeriodNetIncome: $endPeriod->currentPeriodNetIncome(),
                totalEquity: $endPeriod->totalEquity(),
                longTermDebt: $endPeriod->longTermDebt(),
                shortTermDebt: $endPeriod->shortTermDebt(),
                vatBridgeLoan: $endPeriod->vatBridgeLoan(),
                tradePayables: $endPeriod->tradePayables(),
                deferredGrantRevenue: $endPeriod->deferredGrantRevenue(),
                totalLiabilities: $endPeriod->totalLiabilities(),
                totalEquityAndLiabilities: $endPeriod->totalEquityAndLiabilities(),
                variance: $endPeriod->variance(),
                isBalanced: $endPeriod->isBalanced()
            );
        }

        return $annual;
    }

    private function getCashFlowService(): CashFlowService
    {
        return $this->cashFlowService ?? new CashFlowService();
    }

    private function getIncomeStatementService(): IncomeStatementService
    {
        return $this->incomeStatementService ?? new IncomeStatementService();
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

    private function getGrantService(): GrantAllocationService
    {
        return $this->grantService ?? new GrantAllocationService();
    }
}
