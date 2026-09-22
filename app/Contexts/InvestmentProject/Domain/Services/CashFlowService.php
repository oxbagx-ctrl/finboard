<?php

declare(strict_types=1);

namespace App\Contexts\InvestmentProject\Domain\Services;

use App\Contexts\Finance\Domain\ValueObjects\Currency;
use App\Contexts\Finance\Domain\ValueObjects\Money;
use App\Contexts\InvestmentProject\Domain\Model\InvestmentProject;
use App\Contexts\InvestmentProject\Domain\ValueObjects\AmortizationSchedule;
use App\Contexts\InvestmentProject\Domain\ValueObjects\AnnualCashFlowStatement;
use App\Contexts\InvestmentProject\Domain\ValueObjects\CashFlowPeriod;
use App\Contexts\InvestmentProject\Domain\ValueObjects\CashFlowStatement;
use App\Contexts\InvestmentProject\Domain\ValueObjects\DepreciationSchedule;
use App\Contexts\InvestmentProject\Domain\ValueObjects\GrantCalculationResult;
use App\Contexts\InvestmentProject\Domain\ValueObjects\IncomeStatement;
use App\Contexts\InvestmentProject\Domain\ValueObjects\OperatingAssumptions;
use App\Contexts\InvestmentProject\Domain\ValueObjects\VatBridgeSchedule;
use DateTimeImmutable;
use InvalidArgumentException;

final class CashFlowService
{
    public function __construct(
        private readonly ?IncomeStatementService $incomeStatementService = null,
        private readonly ?DepreciationScheduleService $depreciationService = null,
        private readonly ?DebtAmortizationService $debtService = null,
        private readonly ?VatBridgeLoanService $vatService = null,
        private readonly ?GrantAllocationService $grantService = null
    ) {
    }

    /**
     * Generates a complete 15-year monthly and annual Cash Flow Statement (indirect method).
     */
    public function generateStatement(
        InvestmentProject $project,
        OperatingAssumptions $assumptions,
        int $horizonYears = 15,
        ?IncomeStatement $incomeStatement = null,
        ?DepreciationSchedule $depreciationSchedule = null,
        ?AmortizationSchedule $debtSchedule = null,
        ?VatBridgeSchedule $vatSchedule = null,
        ?GrantCalculationResult $grantResult = null
    ): CashFlowStatement {
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

        $workingCapitalDays = $project->workingCapitalDays();
        $projectStartDate = new DateTimeImmutable($project->startDate()->format('Y-m-01'));

        $monthlyPeriods = [];
        $openingCash = Money::zero($currency);
        $priorNwc = Money::zero($currency);

        for ($m = 1; $m <= $totalMonths; $m++) {
            $year = (int) ceil($m / 12);
            $monthInYear = (($m - 1) % 12) + 1;
            $periodDate = $projectStartDate->modify(sprintf('+%d months', $m - 1));

            $pnlPeriod = $pnl->monthlyPeriod($m);
            $netIncome = $pnlPeriod ? $pnlPeriod->netIncome() : Money::zero($currency);
            $depreciation = $pnlPeriod ? $pnlPeriod->depreciation() : Money::zero($currency);

            // 1. Working Capital change (NWC)
            $monthRev = $pnlPeriod ? $pnlPeriod->revenue() : Money::zero($currency);
            $monthVar = $pnlPeriod ? $pnlPeriod->variableCosts() : Money::zero($currency);
            $monthFix = $pnlPeriod ? $pnlPeriod->fixedCosts() : Money::zero($currency);

            // Monthly working capital balances
            $receivables = $monthRev->multiply($workingCapitalDays->dso())->divide(30);
            $inventory = $monthVar->multiply($workingCapitalDays->dio())->divide(30);
            $payables = $monthVar->add($monthFix)->multiply($workingCapitalDays->dpo())->divide(30);

            $currentNwc = $receivables->add($inventory)->subtract($payables);
            $workingCapitalDelta = $currentNwc->subtract($priorNwc);
            // Cash impact is negative of NWC increase
            $workingCapitalChange = Money::zero($currency)->subtract($workingCapitalDelta);
            $priorNwc = $currentNwc;

            // Upfront fees on bank facilities paid in month 1
            $upfrontFees = ($m === 1)
                ? $amortSchedule->upfrontFee()
                : Money::zero($currency);

            // Operating Cash Flow (CFO)
            // Add back upfront fee in CFO because it is recognized in P&L Net Income as a financing cost,
            // and is categorized under Financing Cash Flow (CFF).
            $cfo = $netIncome->add($depreciation)->add($workingCapitalChange)->add($upfrontFees);

            // 2. Investing Cash Flow (CFI)
            $depPeriod = $depSchedule->monthlyPeriod($m);
            $capexIncurred = $depPeriod ? $depPeriod->capexIncurred() : Money::zero($currency);

            $vatPeriod = $vatBridgeSchedule->period($m);
            $vatIncurred = $vatPeriod ? $vatPeriod->vatIncurred() : Money::zero($currency);
            $vatRefunded = $vatPeriod ? $vatPeriod->vatRefunded() : Money::zero($currency);

            $cfi = Money::zero($currency)
                ->subtract($capexIncurred)
                ->subtract($vatIncurred)
                ->add($vatRefunded);

            // 3. Financing Cash Flow (CFF)
            // Month 1 equity injection and bank debt drawdown
            $equityInjected = ($m === 1)
                ? $project->financingStructure()->totalEquity()
                : Money::zero($currency);

            $debtDrawdown = ($m === 1)
                ? $project->debtFacility()->committedAmount()
                : Money::zero($currency);

            $debtPeriod = $amortSchedule->period($m);
            $debtPrincipalRepaid = $debtPeriod ? $debtPeriod->principalPayment() : Money::zero($currency);

            $vatLoanDrawdown = $vatPeriod ? $vatPeriod->drawdown() : Money::zero($currency);
            $vatLoanRepaid = $vatPeriod ? $vatPeriod->repayment() : Money::zero($currency);

            $grantReceived = $grantCalcResult->disbursementAtMonth($m);

            $cff = $equityInjected
                ->add($debtDrawdown)
                ->subtract($debtPrincipalRepaid)
                ->subtract($upfrontFees)
                ->add($vatLoanDrawdown)
                ->subtract($vatLoanRepaid)
                ->add($grantReceived);

            // Net Cash Flow & Roll-forward
            $ncf = $cfo->add($cfi)->add($cff);
            $closingCash = $openingCash->add($ncf);

            $monthlyPeriods[] = new CashFlowPeriod(
                periodNumber: $m,
                year: $year,
                monthInYear: $monthInYear,
                date: $periodDate,
                netIncome: $netIncome,
                depreciation: $depreciation,
                workingCapitalChange: $workingCapitalChange,
                operatingCashFlow: $cfo,
                capexIncurred: $capexIncurred,
                investingCashFlow: $cfi,
                equityInjected: $equityInjected,
                debtDrawdown: $debtDrawdown,
                debtPrincipalRepaid: $debtPrincipalRepaid,
                upfrontFees: $upfrontFees,
                vatLoanDrawdown: $vatLoanDrawdown,
                vatLoanRepaid: $vatLoanRepaid,
                grantReceived: $grantReceived,
                financingCashFlow: $cff,
                netCashFlow: $ncf,
                openingCashBalance: $openingCash,
                closingCashBalance: $closingCash
            );

            $openingCash = $closingCash;
        }

        $annualStatements = $this->aggregateAnnualStatements($monthlyPeriods, $horizonYears, $currency);

        return new CashFlowStatement(
            currency: $currency,
            horizonYears: $horizonYears,
            monthlyPeriods: $monthlyPeriods,
            annualStatements: $annualStatements
        );
    }

    /**
     * @param array<CashFlowPeriod> $periods
     * @return array<int, AnnualCashFlowStatement>
     */
    private function aggregateAnnualStatements(array $periods, int $horizonYears, Currency $currency): array
    {
        $annual = [];

        for ($year = 1; $year <= $horizonYears; $year++) {
            $startIdx = ($year - 1) * 12;
            $endIdx = min(count($periods) - 1, ($year * 12) - 1);

            $netIncome = Money::zero($currency);
            $dep = Money::zero($currency);
            $wc = Money::zero($currency);
            $cfo = Money::zero($currency);
            $capex = Money::zero($currency);
            $cfi = Money::zero($currency);
            $equity = Money::zero($currency);
            $drawdown = Money::zero($currency);
            $repaid = Money::zero($currency);
            $fees = Money::zero($currency);
            $vatDrawdown = Money::zero($currency);
            $vatRepaid = Money::zero($currency);
            $grant = Money::zero($currency);
            $cff = Money::zero($currency);
            $ncf = Money::zero($currency);

            for ($idx = $startIdx; $idx <= $endIdx; $idx++) {
                $p = $periods[$idx];
                $netIncome = $netIncome->add($p->netIncome());
                $dep = $dep->add($p->depreciation());
                $wc = $wc->add($p->workingCapitalChange());
                $cfo = $cfo->add($p->operatingCashFlow());
                $capex = $capex->add($p->capexIncurred());
                $cfi = $cfi->add($p->investingCashFlow());
                $equity = $equity->add($p->equityInjected());
                $drawdown = $drawdown->add($p->debtDrawdown());
                $repaid = $repaid->add($p->debtPrincipalRepaid());
                $fees = $fees->add($p->upfrontFees());
                $vatDrawdown = $vatDrawdown->add($p->vatLoanDrawdown());
                $vatRepaid = $vatRepaid->add($p->vatLoanRepaid());
                $grant = $grant->add($p->grantReceived());
                $cff = $cff->add($p->financingCashFlow());
                $ncf = $ncf->add($p->netCashFlow());
            }

            $startPeriod = $periods[$startIdx];
            $endPeriod = $periods[$endIdx];

            $annual[$year] = new AnnualCashFlowStatement(
                year: $year,
                netIncome: $netIncome,
                depreciation: $dep,
                workingCapitalChange: $wc,
                operatingCashFlow: $cfo,
                capexIncurred: $capex,
                investingCashFlow: $cfi,
                equityInjected: $equity,
                debtDrawdown: $drawdown,
                debtPrincipalRepaid: $repaid,
                upfrontFees: $fees,
                vatLoanDrawdown: $vatDrawdown,
                vatLoanRepaid: $vatRepaid,
                grantReceived: $grant,
                financingCashFlow: $cff,
                netCashFlow: $ncf,
                openingCashBalance: $startPeriod->openingCashBalance(),
                closingCashBalance: $endPeriod->closingCashBalance()
            );
        }

        return $annual;
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
