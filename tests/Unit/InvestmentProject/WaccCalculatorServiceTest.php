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
use App\Contexts\InvestmentProject\Domain\Services\WaccCalculatorService;
use App\Contexts\InvestmentProject\Domain\ValueObjects\AmortizationType;
use App\Contexts\InvestmentProject\Domain\ValueObjects\CapexStageId;
use App\Contexts\InvestmentProject\Domain\ValueObjects\DebtFacilityId;
use App\Contexts\InvestmentProject\Domain\ValueObjects\DynamicWaccSchedule;
use App\Contexts\InvestmentProject\Domain\ValueObjects\InterestMargin;
use App\Contexts\InvestmentProject\Domain\ValueObjects\InvestmentProjectId;
use App\Contexts\InvestmentProject\Domain\ValueObjects\KstClassification;
use App\Contexts\InvestmentProject\Domain\ValueObjects\LoanTenor;
use App\Contexts\InvestmentProject\Domain\ValueObjects\OperatingAssumptions;
use App\Contexts\InvestmentProject\Domain\ValueObjects\WaccParameters;
use App\Contexts\InvestmentProject\Domain\ValueObjects\WaccResult;
use DateTimeImmutable;
use InvalidArgumentException;
use PHPUnit\Framework\TestCase;

final class WaccCalculatorServiceTest extends TestCase
{
    private WaccCalculatorService $service;

    private BalanceSheetService $balanceSheetService;

    protected function setUp(): void
    {
        parent::setUp();

        $depService = new DepreciationScheduleService;
        $debtService = new DebtAmortizationService;
        $vatService = new VatBridgeLoanService;
        $grantService = new GrantAllocationService;
        $incomeService = new IncomeStatementService($depService, $debtService, $vatService);
        $cashFlowService = new CashFlowService;

        $this->balanceSheetService = new BalanceSheetService(
            $cashFlowService,
            $incomeService,
            $depService,
            $debtService,
            $vatService,
            $grantService
        );

        $this->service = new WaccCalculatorService;
    }

    public function test_static_wacc_calculation_with_standard_polish_market_parameters(): void
    {
        // Setup: 60% Equity (600,000 PLN), 40% Debt (400,000 PLN)
        $equity = Money::fromDecimal('600000.0000', Currency::PLN);
        $debt = Money::fromDecimal('400000.0000', Currency::PLN);

        // Parameters:
        // Rf = 5.25%, ERP = 5.50%, Beta = 1.00, SizePremium = 1.50%
        // -> Ke = 5.25 + (1.0 * 5.50) + 1.50 = 12.25%
        // Pre-tax Kd = 8.00%, Tax rate = 19.0% -> Tax shield multiplier = 0.81
        // -> After-tax Kd = 8.00% * 0.81 = 6.48%
        // Inflation = 2.50%
        $params = new WaccParameters(
            riskFreeRatePercent: 5.25,
            equityRiskPremiumPercent: 5.50,
            beta: 1.00,
            sizeRiskPremiumPercent: 1.50,
            preTaxCostOfDebtPercent: 8.00,
            taxRatePercent: 19.0,
            inflationRatePercent: 2.50
        );

        $result = $this->service->calculateStaticWacc($params, $equity, $debt);

        $this->assertInstanceOf(WaccResult::class, $result);
        $this->assertEquals(60.0, $result->equityWeightPercent());
        $this->assertEquals(40.0, $result->debtWeightPercent());
        $this->assertEquals(12.25, $result->costOfEquityPercent());
        $this->assertEquals(8.00, $result->preTaxCostOfDebtPercent());
        $this->assertEquals(6.48, $result->afterTaxCostOfDebtPercent());

        // Nominal WACC = (0.60 * 12.25%) + (0.40 * 6.48%) = 7.35% + 2.592% = 9.942%
        $this->assertEquals(9.942, $result->nominalWaccPercent());

        // Real WACC = ((1 + 0.09942) / (1 + 0.025)) - 1 = (1.09942 / 1.025) - 1 = 7.2605%
        $this->assertEquals(7.2605, $result->realWaccPercent());

        // Discount factor for 1 year: 1 / (1 + 0.09942)^1 = 0.909571
        $this->assertEquals(0.909571, $result->discountFactor(1, false));

        // Discount factor for 5 years: 1 / (1 + 0.09942)^5 = 0.622561
        $this->assertEquals(0.622561, $result->discountFactor(5, false));
    }

    public function test_static_wacc_edge_cases(): void
    {
        $params = new WaccParameters(
            riskFreeRatePercent: 5.0,
            equityRiskPremiumPercent: 5.0,
            beta: 1.0,
            sizeRiskPremiumPercent: 0.0,
            preTaxCostOfDebtPercent: 10.0,
            taxRatePercent: 20.0,
            inflationRatePercent: 0.0 // Zero inflation
        );

        // Case 1: 100% Equity, 0% Debt -> WACC = Ke = 10.0%
        $equityOnly = $this->service->calculateStaticWacc(
            $params,
            Money::fromDecimal('1000000.0000', Currency::PLN),
            Money::zero(Currency::PLN)
        );
        $this->assertEquals(100.0, $equityOnly->equityWeightPercent());
        $this->assertEquals(0.0, $equityOnly->debtWeightPercent());
        $this->assertEquals(10.0, $equityOnly->nominalWaccPercent());
        $this->assertEquals(10.0, $equityOnly->realWaccPercent()); // With zero inflation, real == nominal

        // Case 2: 0% Equity, 100% Debt -> WACC = After-tax Kd = 10.0% * (1 - 0.20) = 8.0%
        $debtOnly = $this->service->calculateStaticWacc(
            $params,
            Money::zero(Currency::PLN),
            Money::fromDecimal('1000000.0000', Currency::PLN)
        );
        $this->assertEquals(0.0, $debtOnly->equityWeightPercent());
        $this->assertEquals(100.0, $debtOnly->debtWeightPercent());
        $this->assertEquals(8.0, $debtOnly->nominalWaccPercent());

        // Case 3: Zero total capital defaults to 100% equity
        $zeroCapital = $this->service->calculateStaticWacc(
            $params,
            Money::zero(Currency::PLN),
            Money::zero(Currency::PLN)
        );
        $this->assertEquals(100.0, $zeroCapital->equityWeightPercent());
        $this->assertEquals(10.0, $zeroCapital->nominalWaccPercent());
    }

    public function test_calculate_wacc_directly_from_investment_project_aggregate(): void
    {
        $startDate = new DateTimeImmutable('2026-01-01');

        // Project: 2.0M Equity, 3.0M Debt @ 7.5% nominal interest
        $project = InvestmentProject::create(
            InvestmentProjectId::generate(),
            'comp-wacc',
            'Elektrociepłownia',
            'Opis',
            $startDate,
            FinancingStructure::create(Money::fromDecimal('2000000.0000', Currency::PLN)),
            DebtFacility::create(
                DebtFacilityId::generate(),
                'Kredyt',
                Money::fromDecimal('3000000.0000', Currency::PLN),
                InterestMargin::fromPercentage(2.0),
                5.5, // 7.5% total
                LoanTenor::fromMonths(60, 0),
                AmortizationType::LINEAR
            )
        );

        $result = $this->service->calculateFromProject($project);

        $this->assertInstanceOf(WaccResult::class, $result);
        $this->assertEquals(40.0, $result->equityWeightPercent()); // 2M / 5M = 40%
        $this->assertEquals(60.0, $result->debtWeightPercent());   // 3M / 5M = 60%
        $this->assertEquals(7.5, $result->preTaxCostOfDebtPercent());
        $this->assertEquals(round(7.5 * 0.81, 4), $result->afterTaxCostOfDebtPercent());
    }

    public function test_hamada_equation_relevering_and_unlevering_beta(): void
    {
        $unleveredBeta = 0.80;
        $debtEquityRatio = 1.50; // D/E = 1.5
        $taxRate = 19.0;         // T = 19%

        // Relever: Beta_L = 0.80 * [ 1 + (1 - 0.19) * 1.50 ] = 0.80 * [ 1 + 1.215 ] = 0.80 * 2.215 = 1.772
        $leveredBeta = $this->service->releverBeta($unleveredBeta, $debtEquityRatio, $taxRate);
        $this->assertEquals(1.772, $leveredBeta);

        // Unlever back: Beta_U = 1.772 / [ 1 + (1 - 0.19) * 1.50 ] = 1.772 / 2.215 = 0.80
        $reconstructedUnlevered = $this->service->unleverBeta($leveredBeta, $debtEquityRatio, $taxRate);
        $this->assertEquals($unleveredBeta, $reconstructedUnlevered);
    }

    public function test_dynamic_wacc_schedule_tracks_capital_structure_evolution_over_15_years(): void
    {
        $startDate = new DateTimeImmutable('2026-01-01');

        $stage = CapexStage::create(
            CapexStageId::generate(),
            'Inwestycja produkcyjna',
            Money::fromDecimal('5000000.0000', Currency::PLN),
            $startDate,
            6,
            KstClassification::fromCode('KST_1')
        );

        // 3M Equity, 2M Debt maturing in 5 years (60 months)
        $project = InvestmentProject::create(
            InvestmentProjectId::generate(),
            'comp-dynamic-wacc',
            'Fabryka Tworzyw',
            'Opis',
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

        $assumptions = new OperatingAssumptions(
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

        $balanceSheet = $this->balanceSheetService->generateStatement($project, $assumptions, horizonYears: 15);

        $schedule = $this->service->calculateDynamicSchedule($project, $balanceSheet);

        $this->assertInstanceOf(DynamicWaccSchedule::class, $schedule);
        $this->assertEquals(15, $schedule->yearCount());

        // Year 1: Debt is outstanding, WACC incorporates cheaper after-tax debt
        $y1 = $schedule->annualWacc(1);
        $this->assertNotNull($y1);
        $this->assertTrue($y1->debtWeightPercent() > 0.0);

        // Year 7+: Senior debt (60 months) has fully extinguished!
        // Debt weight must be 0%, Equity weight must be 100%, WACC must converge exactly to Ke!
        $y8 = $schedule->annualWacc(8);
        $this->assertNotNull($y8);
        $this->assertEquals(100.0, $y8->equityWeightPercent());
        $this->assertEquals(0.0, $y8->debtWeightPercent());
        $this->assertEquals($y8->costOfEquityPercent(), $y8->nominalWaccPercent());

        // Cumulative multi-year discount factors must decrease strictly monotonically
        $factors = $schedule->cumulativeDiscountFactors();
        $this->assertCount(15, $factors);
        $this->assertLessThan(1.0, $factors[1]);
        for ($y = 2; $y <= 15; $y++) {
            $this->assertLessThan($factors[$y - 1], $factors[$y], "Discount factor in year {$y} must be strictly less than in year ".($y - 1));
        }
    }

    public function test_currency_mismatch_and_invalid_inputs_throw_exceptions(): void
    {
        $params = WaccParameters::defaultForPoland(7.0);

        // Currency mismatch: EUR vs PLN
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('Equity currency EUR does not match debt currency PLN');

        $this->service->calculateStaticWacc(
            $params,
            Money::fromDecimal('100000.0000', Currency::EUR),
            Money::fromDecimal('50000.0000', Currency::PLN)
        );
    }

    public function test_value_objects_serialization_and_equality(): void
    {
        $params = WaccParameters::defaultForPoland(7.5);
        $paramsCopy = clone $params;
        $this->assertTrue($params->equals($paramsCopy));
        $this->assertIsArray($params->toArray());

        $waccResult = $this->service->calculateStaticWacc(
            $params,
            Money::fromDecimal('500000.0000', Currency::PLN),
            Money::fromDecimal('500000.0000', Currency::PLN)
        );

        $waccCopy = clone $waccResult;
        $this->assertTrue($waccResult->equals($waccCopy));
        $this->assertIsArray($waccResult->toArray());

        $schedule = new DynamicWaccSchedule([1 => $waccResult]);
        $this->assertEquals(1, $schedule->yearCount());
        $this->assertIsArray($schedule->toArray());
        $this->assertTrue($schedule->equals($schedule));
    }

    public function test_wacc_calculation_with_nine_percent_preferential_cit_rate(): void
    {
        // Compare standard 19% CIT vs 9% preferential CIT
        $kdPreTax = 8.0;

        $params19 = WaccParameters::defaultForPoland($kdPreTax, 19.0);
        $params9 = WaccCalculatorService::defaultForPoland($kdPreTax, 9.0);

        $this->assertEquals(19.0, $params19->taxRatePercent());
        $this->assertEquals(0.81, $params19->taxShieldMultiplier());

        $this->assertEquals(9.0, $params9->taxRatePercent());
        $this->assertEquals(0.91, $params9->taxShieldMultiplier());

        $equity = Money::fromDecimal('1000000.0000', Currency::PLN);
        $debt = Money::fromDecimal('1000000.0000', Currency::PLN);

        $result19 = $this->service->calculateStaticWacc($params19, $equity, $debt);
        $result9 = $this->service->calculateStaticWacc($params9, $equity, $debt);

        // After-tax Kd: 8.0 * 0.81 = 6.48% (19% CIT) vs 8.0 * 0.91 = 7.28% (9% CIT)
        $this->assertEquals(6.48, $result19->afterTaxCostOfDebtPercent());
        $this->assertEquals(7.28, $result9->afterTaxCostOfDebtPercent());

        // Because after-tax cost of debt is higher under 9% CIT (smaller tax shield benefit),
        // nominal WACC under 9% CIT must be strictly greater than nominal WACC under 19% CIT
        $this->assertGreaterThan($result19->nominalWaccPercent(), $result9->nominalWaccPercent());
        $this->assertEquals(round((0.5 * $params9->costOfEquityPercent()) + (0.5 * 7.28), 4), $result9->nominalWaccPercent());
    }
}
