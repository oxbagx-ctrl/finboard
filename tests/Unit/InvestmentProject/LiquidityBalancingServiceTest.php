<?php

declare(strict_types=1);

namespace Tests\Unit\InvestmentProject;

use App\Contexts\Finance\Domain\ValueObjects\Currency;
use App\Contexts\Finance\Domain\ValueObjects\Money;
use App\Contexts\InvestmentProject\Domain\Entities\CapexStage;
use App\Contexts\InvestmentProject\Domain\Entities\DebtFacility;
use App\Contexts\InvestmentProject\Domain\Entities\FinancingStructure;
use App\Contexts\InvestmentProject\Domain\Model\InvestmentProject;
use App\Contexts\InvestmentProject\Domain\Services\CashFlowService;
use App\Contexts\InvestmentProject\Domain\Services\DebtAmortizationService;
use App\Contexts\InvestmentProject\Domain\Services\DepreciationScheduleService;
use App\Contexts\InvestmentProject\Domain\Services\IncomeStatementService;
use App\Contexts\InvestmentProject\Domain\Services\LiquidityBalancingService;
use App\Contexts\InvestmentProject\Domain\Services\VatBridgeLoanService;
use App\Contexts\InvestmentProject\Domain\ValueObjects\AmortizationType;
use App\Contexts\InvestmentProject\Domain\ValueObjects\CapexStageId;
use App\Contexts\InvestmentProject\Domain\ValueObjects\CashFlowPeriod;
use App\Contexts\InvestmentProject\Domain\ValueObjects\CashFlowStatement;
use App\Contexts\InvestmentProject\Domain\ValueObjects\DebtFacilityId;
use App\Contexts\InvestmentProject\Domain\ValueObjects\InterestMargin;
use App\Contexts\InvestmentProject\Domain\ValueObjects\InvestmentProjectId;
use App\Contexts\InvestmentProject\Domain\ValueObjects\KstClassification;
use App\Contexts\InvestmentProject\Domain\ValueObjects\LiquidityAlert;
use App\Contexts\InvestmentProject\Domain\ValueObjects\LiquidityPeriod;
use App\Contexts\InvestmentProject\Domain\ValueObjects\LiquiditySchedule;
use App\Contexts\InvestmentProject\Domain\ValueObjects\LoanTenor;
use App\Contexts\InvestmentProject\Domain\ValueObjects\OperatingAssumptions;
use DateTimeImmutable;
use InvalidArgumentException;
use PHPUnit\Framework\TestCase;

final class LiquidityBalancingServiceTest extends TestCase
{
    private LiquidityBalancingService $service;
    private CashFlowService $cashFlowService;
    private IncomeStatementService $incomeStatementService;

    protected function setUp(): void
    {
        parent::setUp();

        $depService = new DepreciationScheduleService();
        $debtService = new DebtAmortizationService();
        $vatService = new VatBridgeLoanService();

        $this->incomeStatementService = new IncomeStatementService($depService, $debtService, $vatService);
        $this->cashFlowService = new CashFlowService();
        $this->service = new LiquidityBalancingService();
    }

    public function test_normal_healthy_project_with_no_liquidity_deficit(): void
    {
        $project = $this->createFullyFundedProject();
        $assumptions = $this->createBaseOperatingAssumptions();

        $cashFlow = $this->cashFlowService->generateStatement($project, $assumptions, horizonYears: 15);

        $facilityLimit = Money::fromDecimal('500000.0000', Currency::PLN);
        $minBuffer = Money::fromDecimal('50000.0000', Currency::PLN);

        $schedule = $this->service->balanceLiquidity(
            $project,
            $cashFlow,
            $facilityLimit,
            $minBuffer,
            annualInterestRate: 7.00
        );

        $this->assertInstanceOf(LiquiditySchedule::class, $schedule);
        $this->assertEquals(180, $schedule->monthlyPeriodCount());
        $this->assertCount(15, $schedule->annualSummaries());

        $this->assertTrue($schedule->isLiquidOverHorizon());
        $this->assertFalse($schedule->hasUnfundedDeficit());
        $this->assertEmpty($schedule->criticalAlerts());
        $this->assertEquals('0.0000', $schedule->totalDrawdowns()->amount());
        $this->assertEquals('0.0000', $schedule->totalInterestPaid()->amount());
    }

    public function test_cash_deficit_covered_by_revolving_facility_and_subsequent_repayment(): void
    {
        $currency = Currency::PLN;
        $date = new DateTimeImmutable('2026-01-01');

        // Create a synthetic 12-month CashFlowStatement simulating deficit in months 2-4 and profit afterwards
        $monthlyPeriods = [];
        $cashBalances = [
            1 => '100000.0000',  // Healthy month 1
            2 => '20000.0000',   // Deficit of 30k (buffer 50k - 20k)
            3 => '-10000.0000',  // Deficit of 60k (buffer 50k - (-10k)) -> cum 90k drawdown
            4 => '10000.0000',   // Deficit of 40k -> cum 130k drawdown
            5 => '80000.0000',   // Excess of 30k (80k - 50k) -> repayment 30k
            6 => '120000.0000',  // Excess of 70k -> repayment 70k
            7 => '150000.0000',  // Excess of 100k -> pays remaining 30k debt
            8 => '200000.0000',  // Debt fully cleared
            9 => '250000.0000',
            10 => '300000.0000',
            11 => '350000.0000',
            12 => '400000.0000',
        ];

        for ($m = 1; $m <= 12; $m++) {
            $closingCash = Money::fromDecimal($cashBalances[$m], $currency);
            $monthlyPeriods[] = new CashFlowPeriod(
                periodNumber: $m,
                year: 1,
                monthInYear: $m,
                date: $date->modify(sprintf('+%d months', $m - 1)),
                netIncome: Money::zero($currency),
                depreciation: Money::zero($currency),
                workingCapitalChange: Money::zero($currency),
                operatingCashFlow: Money::zero($currency),
                capexIncurred: Money::zero($currency),
                investingCashFlow: Money::zero($currency),
                equityInjected: Money::zero($currency),
                debtDrawdown: Money::zero($currency),
                debtPrincipalRepaid: Money::zero($currency),
                upfrontFees: Money::zero($currency),
                vatLoanDrawdown: Money::zero($currency),
                vatLoanRepaid: Money::zero($currency),
                grantReceived: Money::zero($currency),
                financingCashFlow: Money::zero($currency),
                netCashFlow: Money::zero($currency),
                openingCashBalance: Money::zero($currency),
                closingCashBalance: $closingCash
            );
        }

        $cashFlowStatement = new CashFlowStatement($currency, 1, $monthlyPeriods, []);

        $facilityLimit = Money::fromDecimal('200000.0000', $currency);
        $minBuffer = Money::fromDecimal('50000.0000', $currency);

        $schedule = $this->service->balanceFromCashFlow(
            $cashFlowStatement,
            $facilityLimit,
            $minBuffer,
            annualInterestRate: 12.0 // 1% per month for easy math
        );

        $this->assertInstanceOf(LiquiditySchedule::class, $schedule);
        $this->assertTrue($schedule->isLiquidOverHorizon());
        $this->assertFalse($schedule->hasUnfundedDeficit());
        $this->assertEquals(3, $schedule->totalMonthsWithDeficit()); // months 2, 3, 4

        // Month 2 check: Deficit = 30k, Drawdown = 30k, Closing revolving = 30k
        $p2 = $schedule->monthlyPeriod(2);
        $this->assertNotNull($p2);
        $this->assertEquals('30000.0000', $p2->cashDeficit()->amount());
        $this->assertEquals('30000.0000', $p2->revolvingDrawdown()->amount());
        $this->assertEquals('30000.0000', $p2->revolvingFacilityClosing()->amount());
        $this->assertEquals('170000.0000', $p2->availableCreditLimit()->amount());
        $this->assertEquals('50000.0000', $p2->balancedCashClosing()->amount()); // 20k + 30k

        // Month 3 check: Deficit = 60k, Opening = 30k, Interest = 300 (1% of 30k), Drawdown = 60k, Closing = 90k
        $p3 = $schedule->monthlyPeriod(3);
        $this->assertNotNull($p3);
        $this->assertEquals('60000.0000', $p3->cashDeficit()->amount());
        $this->assertEquals('60000.0000', $p3->revolvingDrawdown()->amount());
        $this->assertEquals('300.0000', $p3->revolvingInterest()->amount());
        $this->assertEquals('90000.0000', $p3->revolvingFacilityClosing()->amount());

        // Month 4 check: Deficit = 40k, Opening = 90k, Drawdown = 40k, Closing = 130k
        $p4 = $schedule->monthlyPeriod(4);
        $this->assertNotNull($p4);
        $this->assertEquals('130000.0000', $p4->revolvingFacilityClosing()->amount());

        // Month 5 check: Excess = 30k (80k - 50k), Repayment = 30k, Closing = 100k
        $p5 = $schedule->monthlyPeriod(5);
        $this->assertNotNull($p5);
        $this->assertEquals('30000.0000', $p5->excessCash()->amount());
        $this->assertEquals('30000.0000', $p5->revolvingRepayment()->amount());
        $this->assertEquals('100000.0000', $p5->revolvingFacilityClosing()->amount());

        // Month 6 check: Excess = 70k, Repayment = 70k, Closing = 30k
        $p6 = $schedule->monthlyPeriod(6);
        $this->assertNotNull($p6);
        $this->assertEquals('70000.0000', $p6->revolvingRepayment()->amount());
        $this->assertEquals('30000.0000', $p6->revolvingFacilityClosing()->amount());

        // Month 7 check: Excess = 100k, Repayment = 30k (capped at balance), Closing = 0
        $p7 = $schedule->monthlyPeriod(7);
        $this->assertNotNull($p7);
        $this->assertEquals('30000.0000', $p7->revolvingRepayment()->amount());
        $this->assertEquals('0.0000', $p7->revolvingFacilityClosing()->amount());

        // Month 8 check: Facility completely repaid, 0 interest
        $p8 = $schedule->monthlyPeriod(8);
        $this->assertNotNull($p8);
        $this->assertEquals('0.0000', $p8->revolvingFacilityClosing()->amount());
        $this->assertEquals('0.0000', $p8->revolvingInterest()->amount());

        // Peak exposure must be 130k
        $this->assertEquals('130000.0000', $schedule->maxFacilityExposure()->amount());
        $this->assertEquals('130000.0000', $schedule->totalDrawdowns()->amount());
        $this->assertEquals('130000.0000', $schedule->totalRepayments()->amount());
        $this->assertTrue($schedule->totalInterestPaid()->isPositive());
    }

    public function test_severe_unfunded_deficit_triggers_critical_alerts(): void
    {
        $currency = Currency::PLN;
        $date = new DateTimeImmutable('2026-01-01');

        $monthlyPeriods = [];
        // Month 1 has cash of -200,000 PLN with buffer of 50,000 PLN -> Deficit = 250,000 PLN
        // But facility limit is only 100,000 PLN -> Drawdown = 100k, Unfunded = 150k
        $monthlyPeriods[] = new CashFlowPeriod(
            periodNumber: 1,
            year: 1,
            monthInYear: 1,
            date: $date,
            netIncome: Money::zero($currency),
            depreciation: Money::zero($currency),
            workingCapitalChange: Money::zero($currency),
            operatingCashFlow: Money::zero($currency),
            capexIncurred: Money::zero($currency),
            investingCashFlow: Money::zero($currency),
            equityInjected: Money::zero($currency),
            debtDrawdown: Money::zero($currency),
            debtPrincipalRepaid: Money::zero($currency),
            upfrontFees: Money::zero($currency),
            vatLoanDrawdown: Money::zero($currency),
            vatLoanRepaid: Money::zero($currency),
            grantReceived: Money::zero($currency),
            financingCashFlow: Money::zero($currency),
            netCashFlow: Money::zero($currency),
            openingCashBalance: Money::zero($currency),
            closingCashBalance: Money::fromDecimal('-200000.0000', $currency)
        );

        $cashFlowStatement = new CashFlowStatement($currency, 1, $monthlyPeriods, []);

        $facilityLimit = Money::fromDecimal('100000.0000', $currency);
        $minBuffer = Money::fromDecimal('50000.0000', $currency);

        $schedule = $this->service->balanceFromCashFlow(
            $cashFlowStatement,
            $facilityLimit,
            $minBuffer,
            annualInterestRate: 8.0
        );

        $this->assertFalse($schedule->isLiquidOverHorizon());
        $this->assertTrue($schedule->hasUnfundedDeficit());
        $this->assertEquals([1], $schedule->unfundedDeficitMonths());

        $critical = $schedule->criticalAlerts();
        $this->assertCount(1, $critical);
        $this->assertEquals('UNFUNDED_CASH_DEFICIT', $critical[0]->code());
        $this->assertTrue($critical[0]->isCritical());
        $this->assertEquals('250000.0000', $critical[0]->deficitAmount()->amount());

        $p1 = $schedule->monthlyPeriod(1);
        $this->assertNotNull($p1);
        $this->assertTrue($p1->isLimitExceeded());
        $this->assertEquals('150000.0000', $p1->unfundedDeficit()->amount());
        $this->assertEquals('100000.0000', $p1->revolvingDrawdown()->amount());
        $this->assertEquals('0.0000', $p1->availableCreditLimit()->amount());
    }

    public function test_currency_mismatch_and_invalid_arguments_throw_exceptions(): void
    {
        $project = $this->createBaseProject();
        $assumptions = $this->createBaseOperatingAssumptions();
        $cashFlow = $this->cashFlowService->generateStatement($project, $assumptions, horizonYears: 1);

        // Limit currency EUR vs Statement PLN
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('Revolving credit limit currency EUR does not match statement currency PLN');

        $this->service->balanceLiquidity(
            $project,
            $cashFlow,
            Money::fromDecimal('100000.0000', Currency::EUR),
            Money::fromDecimal('50000.0000', Currency::PLN)
        );
    }

    public function test_negative_interest_rate_throws_exception(): void
    {
        $project = $this->createBaseProject();
        $assumptions = $this->createBaseOperatingAssumptions();
        $cashFlow = $this->cashFlowService->generateStatement($project, $assumptions, horizonYears: 1);

        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('Annual interest rate must be between 0.0% and 50.0%');

        $this->service->balanceLiquidity(
            $project,
            $cashFlow,
            Money::fromDecimal('100000.0000', Currency::PLN),
            Money::fromDecimal('50000.0000', Currency::PLN),
            annualInterestRate: -5.0
        );
    }

    public function test_value_objects_serialization_and_equality(): void
    {
        $currency = Currency::PLN;
        $date = new DateTimeImmutable('2026-01-01');

        $alert = new LiquidityAlert(
            periodNumber: 2,
            year: 1,
            date: $date,
            severity: LiquidityAlert::SEVERITY_CRITICAL,
            code: 'UNFUNDED_CASH_DEFICIT',
            message: 'Krytyczny brak płynności',
            deficitAmount: Money::fromDecimal('50000.0000', $currency),
            facilityLimit: Money::fromDecimal('100000.0000', $currency),
            facilityBalance: Money::fromDecimal('100000.0000', $currency)
        );

        $this->assertTrue($alert->isCritical());
        $this->assertFalse($alert->isWarning());
        $this->assertIsArray($alert->toArray());
        $alertClone = clone $alert;
        $this->assertTrue($alert->equals($alertClone));

        $period = new LiquidityPeriod(
            periodNumber: 1,
            year: 1,
            monthInYear: 1,
            date: $date,
            cashBeforeBalancing: Money::fromDecimal('40000.0000', $currency),
            minimumCashBuffer: Money::fromDecimal('50000.0000', $currency),
            cashDeficit: Money::fromDecimal('10000.0000', $currency),
            excessCash: Money::zero($currency),
            revolvingFacilityOpening: Money::zero($currency),
            revolvingDrawdown: Money::fromDecimal('10000.0000', $currency),
            revolvingRepayment: Money::zero($currency),
            revolvingInterest: Money::zero($currency),
            revolvingFacilityClosing: Money::fromDecimal('10000.0000', $currency),
            availableCreditLimit: Money::fromDecimal('90000.0000', $currency),
            unfundedDeficit: Money::zero($currency),
            balancedCashClosing: Money::fromDecimal('50000.0000', $currency)
        );

        $this->assertTrue($period->hasDeficit());
        $this->assertFalse($period->hasExcessCash());
        $this->assertTrue($period->isFacilityUtilized());
        $this->assertFalse($period->isLimitExceeded());
        $this->assertIsArray($period->toArray());
        $periodClone = clone $period;
        $this->assertTrue($period->equals($periodClone));
    }

    private function createBaseProject(): InvestmentProject
    {
        $startDate = new DateTimeImmutable('2026-01-01');

        $stage = CapexStage::create(
            CapexStageId::generate(),
            'Budowa instalacji',
            Money::fromDecimal('2400000.0000', Currency::PLN),
            $startDate,
            6,
            KstClassification::fromCode('KST_4')
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
                1.0
            )
        );

        $project->addCapexStage($stage);

        return $project;
    }

    private function createFullyFundedProject(): InvestmentProject
    {
        $startDate = new DateTimeImmutable('2026-01-01');

        $stage = CapexStage::create(
            CapexStageId::generate(),
            'Budowa instalacji',
            Money::fromDecimal('2400000.0000', Currency::PLN),
            $startDate,
            6,
            KstClassification::fromCode('KST_4')
        );

        $project = InvestmentProject::create(
            InvestmentProjectId::generate(),
            'comp-funded',
            'Fabryka Biomasy',
            'Opis',
            $startDate,
            FinancingStructure::create(Money::fromDecimal('1800000.0000', Currency::PLN)),
            DebtFacility::create(
                DebtFacilityId::generate(),
                'Kredyt Inwestycyjny',
                Money::fromDecimal('1200000.0000', Currency::PLN),
                InterestMargin::fromPercentage(2.0),
                6.0,
                LoanTenor::fromMonths(60, 6),
                AmortizationType::ANNUITY,
                1.0
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
