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
use App\Contexts\InvestmentProject\Domain\Services\InvestmentAppraisalService;
use App\Contexts\InvestmentProject\Domain\Services\VatBridgeLoanService;
use App\Contexts\InvestmentProject\Domain\Services\WaccCalculatorService;
use App\Contexts\InvestmentProject\Domain\ValueObjects\AmortizationType;
use App\Contexts\InvestmentProject\Domain\ValueObjects\AppraisalResult;
use App\Contexts\InvestmentProject\Domain\ValueObjects\CapexStageId;
use App\Contexts\InvestmentProject\Domain\ValueObjects\DebtFacilityId;
use App\Contexts\InvestmentProject\Domain\ValueObjects\InterestMargin;
use App\Contexts\InvestmentProject\Domain\ValueObjects\InvestmentProjectId;
use App\Contexts\InvestmentProject\Domain\ValueObjects\KstClassification;
use App\Contexts\InvestmentProject\Domain\ValueObjects\LoanTenor;
use App\Contexts\InvestmentProject\Domain\ValueObjects\OperatingAssumptions;
use App\Contexts\InvestmentProject\Domain\ValueObjects\TerminalValueMethod;
use App\Contexts\InvestmentProject\Domain\ValueObjects\WaccParameters;
use DateTimeImmutable;
use InvalidArgumentException;
use PHPUnit\Framework\TestCase;

final class InvestmentAppraisalServiceTest extends TestCase
{
    private InvestmentAppraisalService $service;
    private WaccCalculatorService $waccService;
    private DepreciationScheduleService $depService;
    private IncomeStatementService $incomeService;
    private CashFlowService $cashFlowService;
    private BalanceSheetService $balanceSheetService;

    protected function setUp(): void
    {
        parent::setUp();

        $this->depService = new DepreciationScheduleService();
        $debtService = new DebtAmortizationService();
        $vatService = new VatBridgeLoanService();
        $grantService = new GrantAllocationService();
        $this->incomeService = new IncomeStatementService($this->depService, $debtService, $vatService);
        $this->cashFlowService = new CashFlowService();

        $this->balanceSheetService = new BalanceSheetService(
            $this->cashFlowService,
            $this->incomeService,
            $this->depService,
            $debtService,
            $vatService,
            $grantService
        );

        $this->waccService = new WaccCalculatorService();
        $this->service = new InvestmentAppraisalService($this->waccService);
    }

    public function test_irr_numerical_solver_matches_known_financial_benchmarks(): void
    {
        // 1. Simple 1-year doubling: -100 at t=0, +200 at t=1 -> IRR = 100.0%
        $irr1 = $this->service->calculateIrr([0 => -100.0, 1 => 200.0]);
        $this->assertNotNull($irr1);
        $this->assertEquals(100.0, $irr1);

        // 2. 1-year 10% return: 1-indexed [1 => -1000, 2 => 1100] -> IRR = 10.0%
        $irr2 = $this->service->calculateIrr([1 => -1000.0, 2 => 1100.0]);
        $this->assertNotNull($irr2);
        $this->assertEquals(10.0, $irr2);

        // 3. Multi-period standard project: -1000 at t=0, flows [300, 420, 680] at t=1,2,3
        // NPV at r: -1000 + 300/(1+r) + 420/(1+r)^2 + 680/(1+r)^3 = 0
        $irr3 = $this->service->calculateIrr([0 => -1000.0, 1 => 300.0, 2 => 420.0, 3 => 680.0]);
        $this->assertNotNull($irr3);
        $this->assertGreaterThan(16.0, $irr3);
        $this->assertLessThan(17.0, $irr3);

        // Verify that NPV at this calculated IRR is within 0.001 of zero
        $rDec = $irr3 / 100.0;
        $npv = -1000.0 + (300.0 / (1.0 + $rDec)) + (420.0 / pow(1.0 + $rDec, 2)) + (680.0 / pow(1.0 + $rDec, 3));
        $this->assertLessThan(0.001, abs($npv));

        // 4. Edge cases: No sign changes -> returns null
        $this->assertNull($this->service->calculateIrr([100.0, 200.0, 300.0]));
        $this->assertNull($this->service->calculateIrr([-100.0, -200.0, -300.0]));
    }

    public function test_payback_period_linear_fractional_interpolation(): void
    {
        // 1. Initial outlay 1000, uniform flows 400 per year:
        // Year 1: Cum = -600
        // Year 2: Cum = -200
        // Year 3: Cum = +200 -> Fraction = |-200| / 400 = 0.50 -> Payback = 2.50 years
        $flows = [1 => 400.0, 2 => 400.0, 3 => 400.0];
        $pp = $this->service->calculatePaybackPeriod($flows, initialOutlay: 1000.0);
        $this->assertEquals(2.50, $pp);

        // 2. Exact 1.0 year payback: Outlay 1000, Year 1 flow 1000
        $ppExact = $this->service->calculatePaybackPeriod([1 => 1000.0], initialOutlay: 1000.0);
        $this->assertEquals(1.00, $ppExact);

        // 3. Exact 3.0 year payback: Outlay 1000, flows [200, 300, 500] -> Cum at Y3 is 0
        $flows3 = [1 => 200.0, 2 => 300.0, 3 => 500.0];
        $pp3 = $this->service->calculatePaybackPeriod($flows3, initialOutlay: 1000.0);
        $this->assertEquals(3.00, $pp3);

        // 4. Embedded t=0 negative flow in cash flow vector:
        $flowsEmbedded = [0 => -1000.0, 1 => 400.0, 2 => 400.0, 3 => 400.0];
        $ppEmb = $this->service->calculatePaybackPeriod($flowsEmbedded);
        $this->assertEquals(2.50, $ppEmb);

        // 5. Unrecovered within horizon -> null
        $flowsUnrec = [1 => 100.0, 2 => 100.0];
        $ppUnrec = $this->service->calculatePaybackPeriod($flowsUnrec, initialOutlay: 1000.0);
        $this->assertNull($ppUnrec);
    }

    public function test_terminal_value_exit_multiple_and_net_debt_deduction(): void
    {
        $project = $this->createSampleProject();
        $assumptions = $this->createSampleAssumptions();
        $horizon = 15;

        $income = $this->incomeService->generateStatement($project, $assumptions, $horizon);
        $cashFlow = $this->cashFlowService->generateStatement($project, $assumptions, $horizon);
        $balanceSheet = $this->balanceSheetService->generateStatement($project, $assumptions, $horizon);

        $result = $this->service->appraise(
            project: $project,
            incomeStatement: $income,
            cashFlowStatement: $cashFlow,
            balanceSheet: $balanceSheet,
            tvMethod: TerminalValueMethod::EXIT_MULTIPLE,
            tvParameter: 8.0 // 8.0x EV/EBITDA
        );

        $tv = $result->terminalValue();
        $this->assertSame(TerminalValueMethod::EXIT_MULTIPLE, $tv->method());
        $this->assertEquals(8.0, $tv->parameter());

        $lastYearEbitda = $income->annualStatement($horizon)->ebitda();
        $expectedNominalEv = $lastYearEbitda->multiply(8.0);
        $this->assertTrue($tv->enterpriseValue()->equals($expectedNominalEv));

        // Verify Equity TV = Enterprise TV - Terminal Net Debt
        $lastBs = $balanceSheet->annualStatement($horizon);
        $terminalDebt = $lastBs->longTermDebt()->add($lastBs->shortTermDebt())->add($lastBs->vatBridgeLoan());
        $terminalCash = $lastBs->cashAndEquivalents();
        $terminalNetDebt = $terminalDebt->subtract($terminalCash);

        $expectedEquityTv = $expectedNominalEv->subtract($terminalNetDebt);
        if ($expectedEquityTv->isNegative()) {
            $expectedEquityTv = Money::zero(Currency::PLN);
        }
        $this->assertTrue($tv->equityValue()->equals($expectedEquityTv));
    }

    public function test_terminal_value_gordon_growth_formula_and_wacc_spread(): void
    {
        $project = $this->createSampleProject();
        $assumptions = $this->createSampleAssumptions();
        $horizon = 15;

        $income = $this->incomeService->generateStatement($project, $assumptions, $horizon);
        $cashFlow = $this->cashFlowService->generateStatement($project, $assumptions, $horizon);
        $balanceSheet = $this->balanceSheetService->generateStatement($project, $assumptions, $horizon);

        // Perpetual growth rate g = 2.0%
        $result = $this->service->appraise(
            project: $project,
            incomeStatement: $income,
            cashFlowStatement: $cashFlow,
            balanceSheet: $balanceSheet,
            tvMethod: TerminalValueMethod::GORDON_GROWTH,
            tvParameter: 2.0
        );

        $tv = $result->terminalValue();
        $this->assertSame(TerminalValueMethod::GORDON_GROWTH, $tv->method());
        $this->assertEquals(2.0, $tv->parameter());
        $this->assertTrue($tv->enterpriseValue()->isPositive());

        // Gordon Growth exception if growth rate >= WACC
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('strictly greater than perpetual growth rate');

        $this->service->appraise(
            project: $project,
            incomeStatement: $income,
            cashFlowStatement: $cashFlow,
            balanceSheet: $balanceSheet,
            tvMethod: TerminalValueMethod::GORDON_GROWTH,
            tvParameter: 25.0 // Unrealistically high 25% growth exceeding WACC (~10%)
        );
    }

    public function test_terminal_value_book_value_method(): void
    {
        $project = $this->createSampleProject();
        $assumptions = $this->createSampleAssumptions();
        $horizon = 15;

        $income = $this->incomeService->generateStatement($project, $assumptions, $horizon);
        $cashFlow = $this->cashFlowService->generateStatement($project, $assumptions, $horizon);
        $balanceSheet = $this->balanceSheetService->generateStatement($project, $assumptions, $horizon);

        $result = $this->service->appraise(
            project: $project,
            incomeStatement: $income,
            cashFlowStatement: $cashFlow,
            balanceSheet: $balanceSheet,
            tvMethod: TerminalValueMethod::BOOK_VALUE
        );

        $tv = $result->terminalValue();
        $this->assertSame(TerminalValueMethod::BOOK_VALUE, $tv->method());

        $lastBs = $balanceSheet->annualStatement($horizon);
        $expectedTv = $lastBs->netBookValue()
            ->add($lastBs->tradeReceivables())
            ->add($lastBs->inventories())
            ->subtract($lastBs->tradePayables());

        $this->assertTrue($tv->enterpriseValue()->equals($expectedTv));
    }

    public function test_end_to_end_15_year_project_appraisal_and_equity_metrics(): void
    {
        $project = $this->createSampleProject();
        $assumptions = $this->createSampleAssumptions();
        $horizon = 15;

        $income = $this->incomeService->generateStatement($project, $assumptions, $horizon);
        $cashFlow = $this->cashFlowService->generateStatement($project, $assumptions, $horizon);
        $balanceSheet = $this->balanceSheetService->generateStatement($project, $assumptions, $horizon);

        $result = $this->service->appraise(
            project: $project,
            incomeStatement: $income,
            cashFlowStatement: $cashFlow,
            balanceSheet: $balanceSheet
        );

        $this->assertInstanceOf(AppraisalResult::class, $result);
        $this->assertSame(Currency::PLN, $result->currency());
        $this->assertEquals(15, $result->horizonYears());

        // 1. Annual Periods Count & Integrity
        $periods = $result->annualPeriods();
        $this->assertCount(15, $periods);

        // Period 1: Construction year with 5M CAPEX -> FCFF must be negative
        $p1 = $result->annualPeriod(1);
        $this->assertNotNull($p1);
        $this->assertTrue($p1->capex()->isPositive());
        $this->assertTrue($p1->fcff()->isNegative());

        // Period 2+: Operational years with production ramp-up -> FCFF should be positive
        $p2 = $result->annualPeriod(2);
        $this->assertNotNull($p2);
        $this->assertTrue($p2->fcff()->isPositive());

        // 2. Enterprise Level Mathematical Consistency:
        // EV = Project NPV + PV(CAPEX)
        $expectedEv = $result->projectNpv()->add($result->pvCapex());
        $this->assertTrue($result->enterpriseValue()->equals($expectedEv));

        // Profitability Index (PI) = EV / PV(CAPEX)
        $expectedPi = round($result->enterpriseValue()->toDecimal() / $result->pvCapex()->toDecimal(), 4);
        $this->assertEquals($expectedPi, $result->profitabilityIndex());
        $this->assertGreaterThan(1.0, $result->profitabilityIndex());

        // Project NPV must be positive for this healthy plant
        $this->assertTrue($result->projectNpv()->isPositive());
        $this->assertTrue($result->isProjectProfitable());

        // Project IRR should be attractive (between 10% and 70%)
        $projectIrr = $result->projectIrr();
        $this->assertNotNull($projectIrr);
        $this->assertGreaterThan(10.0, $projectIrr);
        $this->assertLessThan(70.0, $projectIrr);

        // Simple and Discounted Payback Periods
        $simplePayback = $result->simplePaybackYears();
        $discountedPayback = $result->discountedPaybackYears();
        $this->assertNotNull($simplePayback);
        $this->assertNotNull($discountedPayback);
        $this->assertGreaterThan(1.0, $simplePayback);
        $this->assertLessThan(10.0, $simplePayback);
        $this->assertGreaterThan($simplePayback, $discountedPayback); // Discounted payback is always longer!

        // 3. Equity Level Metrics:
        $this->assertTrue($result->initialEquity()->equals(Money::fromDecimal('3000000.0000', Currency::PLN)));
        $this->assertTrue($result->equityNpv()->isPositive());
        $this->assertTrue($result->isEquityProfitable());

        // Equity IRR should be highly attractive (between 20% and 80%)
        $equityIrr = $result->equityIrr();
        $this->assertNotNull($equityIrr);
        $this->assertGreaterThan(20.0, $equityIrr);
        $this->assertLessThan(80.0, $equityIrr);

        // Equity MoIC should be > 2.0x
        $moic = $result->equityMoic();
        $this->assertGreaterThan(2.0, $moic);

        // Equity Payback Periods
        $this->assertNotNull($result->equitySimplePaybackYears());
        $this->assertNotNull($result->equityDiscountedPaybackYears());
        $this->assertGreaterThan($result->equitySimplePaybackYears(), $result->equityDiscountedPaybackYears());

        // 4. Serialization
        $data = $result->toArray();
        $this->assertArrayHasKey('enterprise_level', $data);
        $this->assertArrayHasKey('equity_level', $data);
        $this->assertArrayHasKey('terminal_value', $data);
        $this->assertArrayHasKey('wacc', $data);
        $this->assertArrayHasKey('annual_periods', $data);
        $this->assertCount(15, $data['annual_periods']);
    }

    private function createSampleProject(): InvestmentProject
    {
        $startDate = new DateTimeImmutable('2026-01-01');

        $stage = CapexStage::create(
            CapexStageId::generate(),
            'Budowa zakladu produkcyjnego',
            Money::fromDecimal('5000000.0000', Currency::PLN),
            $startDate,
            6,
            KstClassification::fromCode('KST_1')
        );

        $project = InvestmentProject::create(
            InvestmentProjectId::generate(),
            'comp-appraisal-test',
            'Fabryka Kompozytow',
            'Nowoczesna linia produkcyjna',
            $startDate,
            FinancingStructure::create(Money::fromDecimal('3000000.0000', Currency::PLN)),
            DebtFacility::create(
                DebtFacilityId::generate(),
                'Kredyt Inwestycyjny',
                Money::fromDecimal('2000000.0000', Currency::PLN),
                InterestMargin::fromPercentage(2.0),
                6.0,
                LoanTenor::fromMonths(60, 6),
                AmortizationType::LINEAR,
                1.0
            )
        );
        $project->addCapexStage($stage);

        return $project;
    }

    private function createSampleAssumptions(): OperatingAssumptions
    {
        return new OperatingAssumptions(
            annualRevenueBase: Money::fromDecimal('6000000.0000', Currency::PLN),
            revenueGrowthRatePercent: 3.0,
            variableCostPercent: 30.0,
            annualFixedCostsBase: Money::fromDecimal('400000.0000', Currency::PLN),
            fixedCostGrowthRatePercent: 2.0,
            annualPayrollBase: Money::fromDecimal('600000.0000', Currency::PLN),
            payrollGrowthRatePercent: 3.0,
            capacityRampUp: [1 => 60.0, 2 => 85.0, 3 => 100.0],
            citRatePercent: 19.0,
            taxLossCarryForwardEnabled: true
        );
    }
}
