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
use App\Contexts\InvestmentProject\Domain\ValueObjects\TaxLossSettlementMode;
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

    public function test_one_off_five_million_cap_settlement_mode_allows_full_offset_up_to_five_million(): void
    {
        $startDate = new DateTimeImmutable('2026-01-01');

        // 12 months construction period -> entire Year 1 is pre-operating
        $stage = CapexStage::create(
            CapexStageId::generate(),
            'Elektrownia Słoneczna 10MW',
            Money::fromDecimal('30000000.0000', Currency::PLN),
            $startDate,
            12
        );

        // Substantial debt incurring interest during construction
        $debt = DebtFacility::create(
            DebtFacilityId::generate(),
            'Kredyt Budowlany',
            Money::fromDecimal('20000000.0000', Currency::PLN),
            InterestMargin::fromPercentage(3.0),
            7.0, // Total 10% interest -> ~2,000,000 PLN interest in Year 1
            LoanTenor::fromMonths(120, 12)
        );

        $project = InvestmentProject::create(
            InvestmentProjectId::generate(),
            'c-pv-oneoff',
            'Farma PV Duża Tarcza',
            'Opis',
            $startDate,
            FinancingStructure::create(Money::fromDecimal('10000000.0000', Currency::PLN)),
            $debt
        );
        $project->addCapexStage($stage);

        // Simulation A: ONE_OFF_5M mode (art. 7 ust. 5 pkt 2 CIT: up to 5,000,000 PLN one-off)
        $assumptionsOneOff = new OperatingAssumptions(
            annualRevenueBase: Money::fromDecimal('8000000.0000', Currency::PLN),
            variableCostPercent: 10.0,
            annualFixedCostsBase: Money::fromDecimal('300000.0000', Currency::PLN),
            annualPayrollBase: Money::fromDecimal('200000.0000', Currency::PLN),
            citRatePercent: 19.0,
            taxLossCarryForwardEnabled: true,
            taxLossOffsetCapPercent: 50.0,
            taxLossSettlementMode: TaxLossSettlementMode::ONE_OFF_5M
        );

        $stmtOneOff = $this->service->generateStatement($project, $assumptionsOneOff, horizonYears: 3);

        $y1OneOff = $stmtOneOff->annualStatement(1);
        $y2OneOff = $stmtOneOff->annualStatement(2);

        // Year 1 ends in a substantial tax loss
        $this->assertTrue($y1OneOff->ebt()->isNegative());
        $year1Loss = $y1OneOff->ebt()->multiply(-1);
        $this->assertTrue($year1Loss->isPositive());
        // Year 1 loss is approximately 2,000,000 PLN (which is <= 5,000,000 PLN)
        $this->assertTrue($year1Loss->lessThan(Money::fromDecimal('5000000.0000', Currency::PLN)));
        $this->assertTrue($y1OneOff->taxLossCarryForwardClosing()->equals($year1Loss));

        // Year 2 under ONE_OFF_5M: Entire Year 1 loss should be deducted in Year 2!
        $this->assertTrue($y2OneOff->taxLossCarryForwardOpening()->equals($year1Loss));
        $this->assertTrue($y2OneOff->taxLossUsed()->equals($year1Loss));
        $this->assertTrue($y2OneOff->taxLossCarryForwardClosing()->isZero());

        // Simulation B: STANDARD_LOSS_CAP mode (art. 7 ust. 5 pkt 1 CIT: max 50% of vintage loss per year)
        $assumptionsStandard = new OperatingAssumptions(
            annualRevenueBase: Money::fromDecimal('8000000.0000', Currency::PLN),
            variableCostPercent: 10.0,
            annualFixedCostsBase: Money::fromDecimal('300000.0000', Currency::PLN),
            annualPayrollBase: Money::fromDecimal('200000.0000', Currency::PLN),
            citRatePercent: 19.0,
            taxLossCarryForwardEnabled: true,
            taxLossOffsetCapPercent: 50.0,
            taxLossSettlementMode: TaxLossSettlementMode::STANDARD_LOSS_CAP
        );

        $stmtStandard = $this->service->generateStatement($project, $assumptionsStandard, horizonYears: 3);
        $y2Standard = $stmtStandard->annualStatement(2);

        // In Year 2 under standard 50% cap, exactly 50% of Year 1 loss is deducted
        $expectedStandardDeduction = $year1Loss->multiply('0.500000');
        $this->assertTrue($y2Standard->taxLossUsed()->equals($expectedStandardDeduction));
        $this->assertTrue($y2Standard->taxLossCarryForwardClosing()->equals($expectedStandardDeduction));

        // Taxable income and CIT in Year 2 are strictly lower under ONE_OFF_5M than under STANDARD_LOSS_CAP
        $this->assertTrue($y2OneOff->taxableIncome()->lessThan($y2Standard->taxableIncome()));
        $this->assertTrue($y2OneOff->incomeTax()->lessThan($y2Standard->incomeTax()));

        // The tax savings difference equals exactly 50% of the loss * 19% CIT rate
        $diffTaxable = $y2Standard->taxableIncome()->subtract($y2OneOff->taxableIncome());
        $this->assertTrue($diffTaxable->equals($expectedStandardDeduction));
    }

    public function test_annual_cit_advances_follow_ytd_cumulative_model(): void
    {
        $startDate = new DateTimeImmutable('2026-01-01');

        $stage = CapexStage::create(
            CapexStageId::generate(),
            'Zakład Produkcyjny',
            Money::fromDecimal('5000000.0000', Currency::PLN),
            $startDate,
            6
        );

        $debt = DebtFacility::create(
            DebtFacilityId::generate(),
            'Kredyt',
            Money::fromDecimal('3000000.0000', Currency::PLN),
            InterestMargin::fromPercentage(2.0),
            6.0,
            LoanTenor::fromMonths(60, 6)
        );

        $project = InvestmentProject::create(
            InvestmentProjectId::generate(),
            'c-ytd',
            'Projekt YTD CIT',
            'Opis',
            $startDate,
            FinancingStructure::create(Money::fromDecimal('2000000.0000', Currency::PLN)),
            $debt
        );
        $project->addCapexStage($stage);

        $assumptions = new OperatingAssumptions(
            annualRevenueBase: Money::fromDecimal('6000000.0000', Currency::PLN),
            variableCostPercent: 40.0,
            annualFixedCostsBase: Money::fromDecimal('300000.0000', Currency::PLN),
            annualPayrollBase: Money::fromDecimal('600000.0000', Currency::PLN),
            citRatePercent: 19.0,
            taxLossCarryForwardEnabled: true
        );

        $statement = $this->service->generateStatement($project, $assumptions, horizonYears: 3);

        for ($year = 1; $year <= 3; $year++) {
            $annual = $statement->annualStatement($year);
            $sumMonthlyCit = Money::zero(Currency::PLN);
            $sumMonthlyTaxable = Money::zero(Currency::PLN);

            for ($m = 1; $m <= 12; $m++) {
                $globalMonth = (($year - 1) * 12) + $m;
                $period = $statement->monthlyPeriod($globalMonth);

                $this->assertFalse($period->incomeTax()->isNegative(), "Month {$globalMonth} CIT advance must not be negative");
                $sumMonthlyCit = $sumMonthlyCit->add($period->incomeTax());
                $sumMonthlyTaxable = $sumMonthlyTaxable->add($period->taxableIncome());
            }

            // Sum of monthly CIT advances strictly equals the annual CIT due on the annual statement
            $this->assertTrue(
                $annual->incomeTax()->equals($sumMonthlyCit),
                "Year {$year}: Annual CIT {$annual->incomeTax()->amount()} must equal sum of 12 monthly advances {$sumMonthlyCit->amount()}"
            );
        }
    }

    public function test_five_year_statutory_tax_loss_expiration(): void
    {
        $startDate = new DateTimeImmutable('2026-01-01');

        // Year 1: High capex and debt incurring substantial pre-operating loss
        $stage = CapexStage::create(
            CapexStageId::generate(),
            'Instalacja',
            Money::fromDecimal('10000000.0000', Currency::PLN),
            $startDate,
            12
        );

        $debt = DebtFacility::create(
            DebtFacilityId::generate(),
            'Kredyt',
            Money::fromDecimal('8000000.0000', Currency::PLN),
            InterestMargin::fromPercentage(3.0),
            7.0, // 10% interest -> 800,000 PLN loss in Year 1
            LoanTenor::fromMonths(120, 12)
        );

        $project = InvestmentProject::create(
            InvestmentProjectId::generate(),
            'c-expiry',
            'Projekt Wygasanie Straty',
            'Opis',
            $startDate,
            FinancingStructure::create(Money::fromDecimal('2000000.0000', Currency::PLN)),
            $debt
        );
        $project->addCapexStage($stage);

        // Operating assumptions with ZERO revenue in Years 2 through 7 (idle / preservation mode)
        $assumptions = new OperatingAssumptions(
            annualRevenueBase: Money::zero(Currency::PLN),
            annualFixedCostsBase: Money::zero(Currency::PLN),
            annualPayrollBase: Money::zero(Currency::PLN),
            citRatePercent: 19.0,
            taxLossCarryForwardEnabled: true,
            taxLossSettlementMode: TaxLossSettlementMode::STANDARD_LOSS_CAP
        );

        $statement = $this->service->generateStatement($project, $assumptions, horizonYears: 8);

        $y1 = $statement->annualStatement(1);
        $this->assertTrue($y1->ebt()->isNegative());
        $year1Loss = $y1->ebt()->multiply(-1);
        $this->assertTrue($year1Loss->isPositive());

        // Loss originating in Year 1 is legally available in Years 2 through 6 (1 + 5 years)
        for ($y = 2; $y <= 6; $y++) {
            $stmt = $statement->annualStatement($y);
            $this->assertTrue($stmt->taxLossExpired()->isZero(), "In Year {$y}, loss must not be expired yet");
            $this->assertTrue($stmt->taxLossCarryForwardOpening()->isPositive());
        }

        // In Year 7 (7 > 1 + 5), Year 1 loss has expired under art. 7 ust. 5 CIT!
        $y7 = $statement->annualStatement(7);
        $this->assertTrue(
            $y7->taxLossExpired()->greaterThanOrEqual($year1Loss),
            "Year 7 must record expiration of Year 1 tax loss ({$year1Loss->amount()}), got {$y7->taxLossExpired()->amount()}"
        );
        $this->assertTrue($y7->taxLossCarryForwardOpening()->greaterThanOrEqual($year1Loss));
    }

    public function test_annual_income_statement_metadata_opening_closing_and_expired(): void
    {
        $startDate = new DateTimeImmutable('2026-01-01');

        $stage = CapexStage::create(
            CapexStageId::generate(),
            'Hala',
            Money::fromDecimal('1000000.0000', Currency::PLN),
            $startDate,
            6
        );

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
            'c-meta',
            'Projekt Metadane CIT',
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
            taxLossCarryForwardEnabled: true
        );

        $statement = $this->service->generateStatement($project, $assumptions, horizonYears: 5);

        for ($y = 1; $y <= 5; $y++) {
            $annual = $statement->annualStatement($y);
            $this->assertNotNull($annual->taxLossCarryForwardOpening());
            $this->assertNotNull($annual->taxLossExpired());
            $this->assertNotNull($annual->taxLossUsed());
            $this->assertNotNull($annual->taxLossCarryForwardClosing());

            $this->assertFalse($annual->taxLossCarryForwardOpening()->isNegative());
            $this->assertFalse($annual->taxLossExpired()->isNegative());
            $this->assertFalse($annual->taxLossUsed()->isNegative());
            $this->assertFalse($annual->taxLossCarryForwardClosing()->isNegative());
        }
    }
}
