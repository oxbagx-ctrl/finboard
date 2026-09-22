<?php

declare(strict_types=1);

namespace Tests\Unit\InvestmentProject;

use App\Contexts\Finance\Domain\ValueObjects\Currency;
use App\Contexts\Finance\Domain\ValueObjects\Money;
use App\Contexts\InvestmentProject\Domain\Entities\CapexStage;
use App\Contexts\InvestmentProject\Domain\Entities\DebtFacility;
use App\Contexts\InvestmentProject\Domain\Entities\FinancingStructure;
use App\Contexts\InvestmentProject\Domain\Model\InvestmentProject;
use App\Contexts\InvestmentProject\Domain\Services\DebtAmortizationService;
use App\Contexts\InvestmentProject\Domain\Services\DepreciationScheduleService;
use App\Contexts\InvestmentProject\Domain\Services\IncomeStatementService;
use App\Contexts\InvestmentProject\Domain\Services\VatBridgeLoanService;
use App\Contexts\InvestmentProject\Domain\ValueObjects\AmortizationType;
use App\Contexts\InvestmentProject\Domain\ValueObjects\CapexStageId;
use App\Contexts\InvestmentProject\Domain\ValueObjects\DebtFacilityId;
use App\Contexts\InvestmentProject\Domain\ValueObjects\IncomeStatement;
use App\Contexts\InvestmentProject\Domain\ValueObjects\InterestMargin;
use App\Contexts\InvestmentProject\Domain\ValueObjects\InvestmentProjectId;
use App\Contexts\InvestmentProject\Domain\ValueObjects\KstClassification;
use App\Contexts\InvestmentProject\Domain\ValueObjects\LoanTenor;
use App\Contexts\InvestmentProject\Domain\ValueObjects\OperatingAssumptions;
use DateTimeImmutable;
use InvalidArgumentException;
use PHPUnit\Framework\TestCase;

final class IncomeStatementServiceTest extends TestCase
{
    private IncomeStatementService $service;

    protected function setUp(): void
    {
        parent::setUp();

        $depService = new DepreciationScheduleService();
        $debtService = new DebtAmortizationService();
        $vatService = new VatBridgeLoanService();

        $this->service = new IncomeStatementService($depService, $debtService, $vatService);
    }

    public function test_standard_15_year_income_statement_with_ramp_up_and_cit(): void
    {
        $startDate = new DateTimeImmutable('2026-01-01');

        // 6 months construction (Jan - Jun 2026) -> COD July 1, 2026 (month 7)
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
                LoanTenor::fromMonths(60, 6), // 6 months grace
                AmortizationType::ANNUITY
            )
        );

        $project->addCapexStage($stage);

        $assumptions = new OperatingAssumptions(
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

        $statement = $this->service->generateStatement($project, $assumptions, horizonYears: 15);

        $this->assertInstanceOf(IncomeStatement::class, $statement);
        $this->assertEquals(180, $statement->monthlyPeriodCount());
        $this->assertCount(15, $statement->annualStatements());

        // Pre-operations (Months 1-6): 0 revenue, negative EBT due to interest, no CIT
        for ($m = 1; $m <= 6; $m++) {
            $p = $statement->monthlyPeriod($m);
            $this->assertNotNull($p);
            $this->assertFalse($p->isCommercialOperation());
            $this->assertEquals('0.0000', $p->revenue()->amount());
            $this->assertEquals('0.0000', $p->variableCosts()->amount());
            $this->assertEquals('0.0000', $p->ebitda()->amount());
            $this->assertTrue($p->interestExpense()->isPositive()); // Bank debt interest is accruing
            $this->assertTrue($p->ebt()->isNegative());
            $this->assertEquals('0.0000', $p->incomeTax()->amount());
            $this->assertTrue($p->taxLossCarryForwardClosing()->isPositive());
        }

        // Month 7: First month of commercial operation (60% ramp-up of 4M = 2.4M/year -> 200,000/month)
        $p7 = $statement->monthlyPeriod(7);
        $this->assertNotNull($p7);
        $this->assertTrue($p7->isCommercialOperation());
        $this->assertEquals('200000.0000', $p7->revenue()->amount());
        $this->assertEquals('70000.0000', $p7->variableCosts()->amount()); // 35% of 200k = 70k
        $this->assertEquals('20000.0000', $p7->fixedCosts()->amount()); // 240k/12 = 20k
        $this->assertEquals('40000.0000', $p7->payrollCosts()->amount()); // 480k/12 = 40k
        $this->assertEquals('130000.0000', $p7->totalOpex()->amount()); // 70k + 20k + 40k = 130k
        $this->assertEquals('70000.0000', $p7->ebitda()->amount()); // 200k - 130k = 70k
        $this->assertEquals('20000.0000', $p7->depreciation()->amount()); // 10% on 2.4M / 12 = 20k
        $this->assertEquals('50000.0000', $p7->ebit()->amount()); // 70k - 20k = 50k

        // Year 1 Annual Summary (6 months of operations at 60% capacity: 6 * 200k = 1,200,000 PLN)
        $y1 = $statement->annualStatement(1);
        $this->assertNotNull($y1);
        $this->assertEquals('1200000.0000', $y1->revenue()->amount());
        $this->assertEquals('420000.0000', $y1->variableCosts()->amount());
        $this->assertEquals('420000.0000', $y1->ebitda()->amount());
        $this->assertEquals('120000.0000', $y1->depreciation()->amount()); // 6 months * 20k
        $this->assertEquals('300000.0000', $y1->ebit()->amount());
        $this->assertEquals(35.0, $y1->ebitdaMarginPercent());
        $this->assertEquals(25.0, $y1->ebitMarginPercent());

        // Total 15-year revenue must be strictly positive and substantial
        $this->assertTrue($statement->totalRevenuesOverHorizon()->greaterThan(Money::fromDecimal('50000000.0000', Currency::PLN)));
        $this->assertTrue($statement->totalNetIncomeOverHorizon()->isPositive());
    }

    public function test_tax_loss_carry_forward_shields_subsequent_profits(): void
    {
        $startDate = new DateTimeImmutable('2026-01-01');

        $stage = CapexStage::create(
            CapexStageId::generate(),
            'Hala',
            Money::fromDecimal('1000000.0000', Currency::PLN),
            $startDate,
            6
        );

        // Substantial debt incurring interest during construction
        $debt = DebtFacility::create(
            DebtFacilityId::generate(),
            'Kredyt',
            Money::fromDecimal('1000000.0000', Currency::PLN),
            InterestMargin::fromPercentage(3.0),
            7.0,
            LoanTenor::fromMonths(60, 6)
        );

        $project = InvestmentProject::create(
            InvestmentProjectId::generate(),
            'c-tax',
            'Projekt Tarcza Podatkowa',
            'Opis',
            $startDate,
            FinancingStructure::create(Money::fromDecimal('500000.0000', Currency::PLN)),
            $debt
        );

        $project->addCapexStage($stage);

        $assumptions = new OperatingAssumptions(
            annualRevenueBase: Money::fromDecimal('2000000.0000', Currency::PLN),
            variableCostPercent: 30.0,
            annualFixedCostsBase: Money::fromDecimal('100000.0000', Currency::PLN),
            annualPayrollBase: Money::fromDecimal('100000.0000', Currency::PLN),
            citRatePercent: 19.0,
            taxLossCarryForwardEnabled: true,
            taxLossOffsetCapPercent: 50.0
        );

        $statement = $this->service->generateStatement($project, $assumptions, horizonYears: 5);

        // Pre-operating loss was recorded in months 1-6
        $p6 = $statement->monthlyPeriod(6);
        $taxLossAtCod = $p6->taxLossCarryForwardClosing();
        $this->assertTrue($taxLossAtCod->isPositive());

        // In month 7, profit is generated and tax loss is partially utilized
        $p7 = $statement->monthlyPeriod(7);
        $this->assertTrue($p7->taxLossUsed()->isPositive());
        $this->assertTrue($p7->taxableIncome()->lessThan($p7->ebt()));
        $this->assertTrue($p7->taxLossCarryForwardClosing()->lessThan($taxLossAtCod));
    }

    public function test_margin_percentages_and_zero_revenue_project(): void
    {
        $startDate = new DateTimeImmutable('2026-01-01');

        $project = InvestmentProject::create(
            InvestmentProjectId::generate(),
            'c-zero',
            'Projekt Pusty',
            'Opis',
            $startDate,
            FinancingStructure::create(Money::fromDecimal('100000.0000', Currency::PLN)),
            DebtFacility::create(
                DebtFacilityId::generate(),
                'Kredyt',
                Money::zero(Currency::PLN),
                InterestMargin::fromPercentage(2.0),
                5.0,
                LoanTenor::fromMonths(12)
            )
        );

        $assumptions = new OperatingAssumptions(
            annualRevenueBase: Money::zero(Currency::PLN) // 0 revenue
        );

        $statement = $this->service->generateStatement($project, $assumptions, horizonYears: 5);
        $y1 = $statement->annualStatement(1);

        $this->assertEquals(0.0, $y1->ebitdaMarginPercent());
        $this->assertEquals(0.0, $y1->ebitMarginPercent());
        $this->assertEquals(0.0, $y1->netProfitMarginPercent());
    }

    public function test_invalid_horizon_years_throws_exception(): void
    {
        $this->expectException(InvalidArgumentException::class);

        $project = InvestmentProject::create(
            InvestmentProjectId::generate(),
            'c-err',
            'Test',
            'Opis',
            new DateTimeImmutable(),
            FinancingStructure::create(Money::fromDecimal('100000.0000', Currency::PLN)),
            DebtFacility::create(
                DebtFacilityId::generate(),
                'Kredyt',
                Money::zero(Currency::PLN),
                InterestMargin::fromPercentage(2.0),
                5.0,
                LoanTenor::fromMonths(12)
            )
        );

        $this->service->generateStatement($project, new OperatingAssumptions(Money::zero(Currency::PLN)), horizonYears: 40);
    }
}
