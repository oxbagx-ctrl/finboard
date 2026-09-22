<?php

declare(strict_types=1);

namespace Tests\Unit\InvestmentProject;

use App\Contexts\Finance\Domain\ValueObjects\Currency;
use App\Contexts\Finance\Domain\ValueObjects\Money;
use App\Contexts\InvestmentProject\Domain\Entities\CapexStage;
use App\Contexts\InvestmentProject\Domain\Entities\DebtFacility;
use App\Contexts\InvestmentProject\Domain\Entities\FinancingStructure;
use App\Contexts\InvestmentProject\Domain\Model\InvestmentProject;
use App\Contexts\InvestmentProject\Domain\Services\BalanceSheetService;
use App\Contexts\InvestmentProject\Domain\Services\CashFlowService;
use App\Contexts\InvestmentProject\Domain\Services\DebtAmortizationService;
use App\Contexts\InvestmentProject\Domain\Services\DepreciationScheduleService;
use App\Contexts\InvestmentProject\Domain\Services\GrantAllocationService;
use App\Contexts\InvestmentProject\Domain\Services\IncomeStatementService;
use App\Contexts\InvestmentProject\Domain\Services\VatBridgeLoanService;
use App\Contexts\InvestmentProject\Domain\ValueObjects\AmortizationType;
use App\Contexts\InvestmentProject\Domain\ValueObjects\AnnualBalanceSheet;
use App\Contexts\InvestmentProject\Domain\ValueObjects\AnnualCashFlowStatement;
use App\Contexts\InvestmentProject\Domain\ValueObjects\BalanceSheet;
use App\Contexts\InvestmentProject\Domain\ValueObjects\BalanceSheetPeriod;
use App\Contexts\InvestmentProject\Domain\ValueObjects\CapexStageId;
use App\Contexts\InvestmentProject\Domain\ValueObjects\CashFlowPeriod;
use App\Contexts\InvestmentProject\Domain\ValueObjects\CashFlowStatement;
use App\Contexts\InvestmentProject\Domain\ValueObjects\DebtFacilityId;
use App\Contexts\InvestmentProject\Domain\ValueObjects\InterestMargin;
use App\Contexts\InvestmentProject\Domain\ValueObjects\InvestmentProjectId;
use App\Contexts\InvestmentProject\Domain\ValueObjects\KstClassification;
use App\Contexts\InvestmentProject\Domain\ValueObjects\LoanTenor;
use App\Contexts\InvestmentProject\Domain\ValueObjects\OperatingAssumptions;
use DateTimeImmutable;
use PHPUnit\Framework\TestCase;

final class BalanceSheetAndCashFlowServiceTest extends TestCase
{
    private CashFlowService $cashFlowService;
    private BalanceSheetService $balanceSheetService;
    private IncomeStatementService $incomeStatementService;
    private DebtAmortizationService $debtService;
    private VatBridgeLoanService $vatService;
    private DepreciationScheduleService $depreciationService;
    private GrantAllocationService $grantService;

    protected function setUp(): void
    {
        parent::setUp();

        $this->depreciationService = new DepreciationScheduleService();
        $this->debtService = new DebtAmortizationService();
        $this->vatService = new VatBridgeLoanService();
        $this->grantService = new GrantAllocationService();
        $this->incomeStatementService = new IncomeStatementService(
            $this->depreciationService,
            $this->debtService,
            $this->vatService
        );
        $this->cashFlowService = new CashFlowService();
        $this->balanceSheetService = new BalanceSheetService(
            $this->cashFlowService,
            $this->incomeStatementService,
            $this->depreciationService,
            $this->debtService,
            $this->vatService,
            $this->grantService
        );
    }

    public function test_cash_flow_statement_generation_and_aggregation(): void
    {
        $project = $this->createBaseProject();
        $assumptions = $this->createBaseOperatingAssumptions();

        $cashFlow = $this->cashFlowService->generateStatement($project, $assumptions, horizonYears: 15);

        $this->assertInstanceOf(CashFlowStatement::class, $cashFlow);
        $this->assertEquals(180, $cashFlow->monthlyPeriodCount());
        $this->assertCount(15, $cashFlow->annualStatements());

        // Month 1: Equity injected (1.2M), Bank debt drawn (1.2M), Capex incurred (400k across 6 months)
        // Upfront fee: 1.0% on 1.2M = 12,000 PLN paid in month 1
        $p1 = $cashFlow->monthlyPeriod(1);
        $this->assertNotNull($p1);
        $this->assertEquals('1200000.0000', $p1->equityInjected()->amount());
        $this->assertEquals('1200000.0000', $p1->debtDrawdown()->amount());
        $this->assertEquals('400000.0000', $p1->capexIncurred()->amount());
        $this->assertEquals('-492000.0000', $p1->investingCashFlow()->amount());
        $this->assertEquals('12000.0000', $p1->upfrontFees()->amount());

        // Closing cash must equal Opening (0) + NCF
        $this->assertEquals(
            $p1->openingCashBalance()->add($p1->netCashFlow())->amount(),
            $p1->closingCashBalance()->amount()
        );

        // Annual statements must properly aggregate closing cash
        $y1 = $cashFlow->annualStatement(1);
        $this->assertNotNull($y1);
        $this->assertEquals($cashFlow->monthlyPeriod(12)->closingCashBalance()->amount(), $y1->closingCashBalance()->amount());
        $this->assertEquals($cashFlow->monthlyPeriod(1)->openingCashBalance()->amount(), $y1->openingCashBalance()->amount());

        // Test helper methods
        $this->assertEquals('-2400000.0000', $cashFlow->totalInvestingCashFlow()->amount());
    }

    public function test_balance_sheet_perfect_zero_variance_closed_over_15_years(): void
    {
        $project = $this->createBaseProject();
        $assumptions = $this->createBaseOperatingAssumptions();

        $balanceSheet = $this->balanceSheetService->generateStatement(
            $project,
            $assumptions,
            horizonYears: 15
        );

        $this->assertInstanceOf(BalanceSheet::class, $balanceSheet);
        $this->assertEquals(180, $balanceSheet->monthlyPeriodCount());
        $this->assertCount(15, $balanceSheet->annualStatements());

        // Check month 1 explicitly
        $m1 = $balanceSheet->monthlyPeriod(1);
        $this->assertNotNull($m1);
        $this->assertEquals(
            '0.0000',
            $m1->variance()->amount(),
            sprintf(
                'Month 1 mismatch: Assets=%s (Cash=%s, Fixed=%s) != Liab+Eq=%s (Equity=%s, RetEarn=%s, NetInc=%s, LT=%s, ST=%s, Grant=%s, Pay=%s)',
                $m1->totalAssets()->amount(),
                $m1->cashAndEquivalents()->amount(),
                $m1->totalFixedAssets()->amount(),
                $m1->totalEquityAndLiabilities()->amount(),
                $m1->shareCapital()->amount(),
                $m1->retainedEarnings()->amount(),
                $m1->currentPeriodNetIncome()->amount(),
                $m1->longTermDebt()->amount(),
                $m1->shortTermDebt()->amount(),
                $m1->deferredGrantRevenue()->amount(),
                $m1->tradePayables()->amount()
            )
        );

        // Individual month check
        for ($m = 1; $m <= 180; $m++) {
            $period = $balanceSheet->monthlyPeriod($m);
            $this->assertNotNull($period);
            $this->assertTrue(
                $period->isBalanced(),
                "Month {$m} is not balanced: Assets={$period->totalAssets()->amount()} != Liabilities+Equity={$period->totalEquityAndLiabilities()->amount()}, diff={$period->variance()->amount()}"
            );
            $this->assertEquals('0.0000', $period->variance()->amount());
        }

        // Individual annual check
        for ($y = 1; $y <= 15; $y++) {
            $annual = $balanceSheet->annualStatement($y);
            $this->assertNotNull($annual);
            $this->assertTrue(
                $annual->isBalanced(),
                "Year {$y} is not balanced: Assets={$annual->totalAssets()->amount()} != Liabilities+Equity={$annual->totalEquityAndLiabilities()->amount()}"
            );
            $this->assertEquals('0.0000', $annual->variance()->amount());
        }
    }

    public function test_balance_sheet_with_vat_loan_and_grant_subsidy(): void
    {
        $startDate = new DateTimeImmutable('2026-01-01');

        $stage = CapexStage::create(
            CapexStageId::generate(),
            'Hala produkcyjna z fotowoltaiką',
            Money::fromDecimal('5000000.0000', Currency::PLN),
            $startDate,
            6,
            KstClassification::fromCode('KST_1') // 2.5% rate
        );

        $financing = FinancingStructure::create(
            investor1Equity: Money::fromDecimal('2000000.0000', Currency::PLN),
            grantAmount: Money::fromDecimal('1000000.0000', Currency::PLN),
            grantIntensityPercent: 20.0,
            vatBridgeLoanAmount: Money::fromDecimal('1150000.0000', Currency::PLN)
        );

        $debt = DebtFacility::create(
            DebtFacilityId::generate(),
            'Kredyt Bankowy',
            Money::fromDecimal('2000000.0000', Currency::PLN),
            InterestMargin::fromPercentage(2.2),
            5.5,
            LoanTenor::fromMonths(84, 6),
            AmortizationType::LINEAR,
            1.5 // upfrontFeeRate
        );

        $project = InvestmentProject::create(
            InvestmentProjectId::generate(),
            'comp-advanced',
            'Fabryka Przyszłości',
            'Opis',
            $startDate,
            $financing,
            $debt
        );

        $project->addCapexStage($stage);

        $assumptions = new OperatingAssumptions(
            annualRevenueBase: Money::fromDecimal('6000000.0000', Currency::PLN),
            revenueGrowthRatePercent: 3.0,
            variableCostPercent: 30.0,
            annualFixedCostsBase: Money::fromDecimal('360000.0000', Currency::PLN),
            fixedCostGrowthRatePercent: 2.0,
            annualPayrollBase: Money::fromDecimal('600000.0000', Currency::PLN),
            payrollGrowthRatePercent: 3.0,
            capacityRampUp: [1 => 70.0, 2 => 90.0, 3 => 100.0],
            citRatePercent: 19.0,
            taxLossCarryForwardEnabled: true
        );

        $balanceSheet = $this->balanceSheetService->generateStatement(
            $project,
            $assumptions,
            horizonYears: 15
        );

        // Verify balance equality holds with complex financing structure
        $this->assertTrue(
            $balanceSheet->isBalancedOverHorizon(),
            'Balance sheet must stay balanced with VAT loan and Grant subsidy.'
        );

        // Verification of debt split (short-term vs long-term)
        $p12 = $balanceSheet->monthlyPeriod(12);
        $this->assertNotNull($p12);
        $this->assertTrue($p12->shortTermDebt()->isPositive());
        $this->assertTrue($p12->longTermDebt()->isPositive());
        $totalBankDebt = $p12->shortTermDebt()->add($p12->longTermDebt());
        $this->assertTrue($totalBankDebt->isPositive());
    }

    public function test_value_objects_equality_and_serialization(): void
    {
        $project = $this->createBaseProject();
        $assumptions = $this->createBaseOperatingAssumptions();

        $cashFlow = $this->cashFlowService->generateStatement($project, $assumptions, horizonYears: 15);
        $balanceSheet = $this->balanceSheetService->generateStatement($project, $assumptions, horizonYears: 15);

        $cf1 = $cashFlow->monthlyPeriod(1);
        $this->assertNotNull($cf1);
        $cf1Copy = clone $cf1;
        $this->assertTrue($cf1->equals($cf1Copy));

        $bs1 = $balanceSheet->monthlyPeriod(1);
        $this->assertNotNull($bs1);
        $bs1Copy = clone $bs1;
        $this->assertTrue($bs1->equals($bs1Copy));

        $this->assertIsArray($cf1->toArray());
        $this->assertIsArray($bs1->toArray());

        $acf1 = $cashFlow->annualStatement(1);
        $this->assertNotNull($acf1);
        $acf1Copy = clone $acf1;
        $this->assertTrue($acf1->equals($acf1Copy));

        $abs1 = $balanceSheet->annualStatement(1);
        $this->assertNotNull($abs1);
        $abs1Copy = clone $abs1;
        $this->assertTrue($abs1->equals($abs1Copy));

        $this->assertTrue($cashFlow->equals($cashFlow));
        $this->assertTrue($balanceSheet->equals($balanceSheet));
    }

    private function createBaseProject(): InvestmentProject
    {
        $startDate = new DateTimeImmutable('2026-01-01');

        $stage = CapexStage::create(
            CapexStageId::generate(),
            'Budowa instalacji przetwórczej',
            Money::fromDecimal('2400000.0000', Currency::PLN),
            $startDate,
            6,
            KstClassification::fromCode('KST_4') // 10% rate
        );

        $project = InvestmentProject::create(
            InvestmentProjectId::generate(),
            'comp-test',
            'Fabryka Biomasy',
            'Opis',
            $startDate,
            FinancingStructure::create(Money::fromDecimal('1200000.0000', Currency::PLN)),
            DebtFacility::create(
                DebtFacilityId::generate(),
                'Kredyt Inwestycyjny',
                Money::fromDecimal('1200000.0000', Currency::PLN),
                InterestMargin::fromPercentage(2.0),
                6.0,
                LoanTenor::fromMonths(60, 6),
                AmortizationType::ANNUITY,
                1.0 // upfrontFeeRate
            )
        );

        $project->addCapexStage($stage);

        return $project;
    }

    private function createBaseOperatingAssumptions(): OperatingAssumptions
    {
        return new OperatingAssumptions(
            annualRevenueBase: Money::fromDecimal('4000000.0000', Currency::PLN),
            revenueGrowthRatePercent: 2.5,
            variableCostPercent: 35.0,
            annualFixedCostsBase: Money::fromDecimal('240000.0000', Currency::PLN),
            fixedCostGrowthRatePercent: 2.0,
            annualPayrollBase: Money::fromDecimal('480000.0000', Currency::PLN),
            payrollGrowthRatePercent: 3.0,
            capacityRampUp: [1 => 60.0, 2 => 85.0, 3 => 100.0],
            citRatePercent: 19.0,
            taxLossCarryForwardEnabled: true
        );
    }
}
