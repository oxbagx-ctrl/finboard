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
use App\Contexts\InvestmentProject\Domain\Services\EquityWaterfallSolverService;
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
use App\Contexts\InvestmentProject\Domain\ValueObjects\WaterfallResult;
use App\Contexts\InvestmentProject\Domain\ValueObjects\WaterfallStructure;
use App\Contexts\InvestmentProject\Domain\ValueObjects\WaterfallTier;
use DateTimeImmutable;
use InvalidArgumentException;
use PHPUnit\Framework\TestCase;

final class EquityWaterfallSolverServiceTest extends TestCase
{
    private EquityWaterfallSolverService $waterfallService;
    private InvestmentAppraisalService $appraisalService;
    private IncomeStatementService $incomeService;
    private CashFlowService $cashFlowService;
    private BalanceSheetService $balanceSheetService;

    protected function setUp(): void
    {
        parent::setUp();

        $depService = new DepreciationScheduleService();
        $debtService = new DebtAmortizationService();
        $vatService = new VatBridgeLoanService();
        $grantService = new GrantAllocationService();
        $this->incomeService = new IncomeStatementService($depService, $debtService, $vatService);
        $this->cashFlowService = new CashFlowService();

        $this->balanceSheetService = new BalanceSheetService(
            $this->cashFlowService,
            $this->incomeService,
            $depService,
            $debtService,
            $vatService,
            $grantService
        );

        $waccService = new WaccCalculatorService();
        $this->appraisalService = new InvestmentAppraisalService($waccService);
        $this->waterfallService = new EquityWaterfallSolverService($this->appraisalService);
    }

    public function test_pari_passu_distribution_preserves_exact_pro_rata_returns_and_cash_conservation(): void
    {
        // Sponsor: 3,000,000 PLN (60%), Financial Partner: 2,000,000 PLN (40%)
        $project = $this->createTwoInvestorProject(
            inv1: Money::fromDecimal('3000000.0000', Currency::PLN),
            inv2: Money::fromDecimal('2000000.0000', Currency::PLN)
        );

        $appraisal = $this->runAppraisal($project);
        $structure = WaterfallStructure::pariPassu(60.0, 40.0);

        $result = $this->waterfallService->solve($project, $appraisal, $structure);

        $this->assertInstanceOf(WaterfallResult::class, $result);
        $this->assertTrue($result->isFullyBalanced());

        $inv1 = $result->investor1Return();
        $inv2 = $result->investor2Return();

        // 1. Initial Contributions: 60% vs 40%
        $this->assertEquals(60.0, $inv1->equitySharePercent());
        $this->assertEquals(40.0, $inv2->equitySharePercent());

        // 2. Exact Cash Conservation: Inv 1 + Inv 2 == Total Distributed
        $this->assertTrue(
            $inv1->totalDistributions()->add($inv2->totalDistributions())->equals($result->totalCashDistributed())
        );

        // 3. In every year, distributions match 60/40 ratio
        foreach ($result->annualPeriods() as $y => $period) {
            $this->assertTrue($period->isBalanced());
            $pCash = $period->totalCashAvailable();
            if ($pCash->isPositive()) {
                $expectedInv1 = $pCash->multiply(0.60);
                // Allow penny rounding precision (less than 0.05 PLN)
                $diff = abs($period->investor1Distribution()->toDecimal() - $expectedInv1->toDecimal());
                $this->assertLessThan(0.05, $diff);
            }
        }

        // 4. MoIC and IRR must be identical under Pari Passu
        $this->assertEquals($inv1->moic(), $inv2->moic());
        $this->assertNotNull($inv1->irr());
        $this->assertNotNull($inv2->irr());
        $this->assertEqualsWithDelta($inv1->irr(), $inv2->irr(), 0.05);
    }

    public function test_standard_two_tier_hurdle_and_promote_rewards_sponsor(): void
    {
        // 50/50 Initial Equity: 2.5M PLN each
        $project = $this->createTwoInvestorProject(
            inv1: Money::fromDecimal('2500000.0000', Currency::PLN),
            inv2: Money::fromDecimal('2500000.0000', Currency::PLN)
        );

        $appraisal = $this->runAppraisal($project);

        // 1. Pari Passu baseline
        $pariPassu = $this->waterfallService->solve(
            $project,
            $appraisal,
            WaterfallStructure::pariPassu(50.0, 50.0)
        );

        // 2. Hurdle 8% + 20% Sponsor Promote on residual
        $twoTier = $this->waterfallService->solve(
            $project,
            $appraisal,
            WaterfallStructure::standardTwoTier(
                hurdleRatePercent: 8.0,
                sponsorPromotePercent: 20.0,
                investor1SharePercent: 50.0,
                investor2SharePercent: 50.0
            )
        );

        $this->assertTrue($twoTier->isFullyBalanced());

        $ppInv1 = $pariPassu->investor1Return();
        $ppInv2 = $pariPassu->investor2Return();

        $ttInv1 = $twoTier->investor1Return();
        $ttInv2 = $twoTier->investor2Return();

        // Total distributed cash across the deal must be identical
        $this->assertTrue($pariPassu->totalCashDistributed()->equals($twoTier->totalCashDistributed()));

        // Financial Partner (Inv 2) achieves at least the 8.0% hurdle return
        $this->assertGreaterThan(8.0, $ttInv2->irr());

        // Sponsor (Inv 1) captures the 20% carry / promote:
        // -> Sponsor MoIC under promote must be strictly higher than under Pari Passu
        $this->assertGreaterThan($ppInv1->moic(), $ttInv1->moic());

        // -> Sponsor IRR under promote must be strictly higher than Pari Passu
        $this->assertGreaterThan($ppInv1->irr(), $ttInv1->irr());

        // -> Financial Partner IRR is lower than Pari Passu due to promote sharing, but well above hurdle
        $this->assertLessThan($ppInv2->irr(), $ttInv2->irr());
        $this->assertGreaterThan(8.0, $ttInv2->irr());
    }

    public function test_three_tier_hurdle_with_intermediate_and_super_promote(): void
    {
        $project = $this->createTwoInvestorProject(
            inv1: Money::fromDecimal('2000000.0000', Currency::PLN),
            inv2: Money::fromDecimal('2000000.0000', Currency::PLN)
        );

        $appraisal = $this->runAppraisal($project);

        // Tier 1: 8% hurdle, Tier 2: 15% hurdle (20% promote), Tier 3: Residual (35% super-promote)
        $structure = WaterfallStructure::standardThreeTier(
            hurdle1Percent: 8.0,
            promote1Percent: 20.0,
            hurdle2Percent: 15.0,
            promote2Percent: 35.0,
            investor1SharePercent: 50.0,
            investor2SharePercent: 50.0
        );

        $result = $this->waterfallService->solve($project, $appraisal, $structure);

        $this->assertTrue($result->isFullyBalanced());
        $this->assertEquals(3, $structure->tierCount());

        $inv1 = $result->investor1Return();
        $inv2 = $result->investor2Return();

        $this->assertGreaterThan(15.0, $inv2->irr());
        $this->assertGreaterThan($inv2->irr(), $inv1->irr());
        $this->assertGreaterThan($inv2->moic(), $inv1->moic());
    }

    public function test_numerical_solver_for_target_irr_finds_exact_promote_percentage(): void
    {
        // 50/50 Initial Equity
        $project = $this->createTwoInvestorProject(
            inv1: Money::fromDecimal('2500000.0000', Currency::PLN),
            inv2: Money::fromDecimal('2500000.0000', Currency::PLN)
        );

        $appraisal = $this->runAppraisal($project);

        // Target: Solve for the exact Sponsor Promote that gives Investor 2 an IRR of 18.0%
        $targetIrr = 18.0;
        $solvedResult = $this->waterfallService->solveForTargetIrr(
            project: $project,
            appraisal: $appraisal,
            targetIrrInvestor2: $targetIrr,
            hurdle1: 8.0
        );

        $this->assertInstanceOf(WaterfallResult::class, $solvedResult);
        $this->assertTrue($solvedResult->isFullyBalanced());
        $this->assertEquals($targetIrr, $solvedResult->targetIrr());

        $realizedIrr2 = $solvedResult->investor2Return()->irr();
        $this->assertNotNull($realizedIrr2);

        // Realized IRR for Investor 2 must match target within 0.05% (5 basis points)
        $this->assertEqualsWithDelta($targetIrr, $realizedIrr2, 0.05);
        $this->assertTrue($solvedResult->isTargetIrrMet());

        // Verify that Sponsor captures substantial promote
        $this->assertGreaterThan($realizedIrr2, $solvedResult->investor1Return()->irr());
    }

    public function test_target_irr_boundary_conditions_and_exceptions(): void
    {
        $project = $this->createTwoInvestorProject(
            inv1: Money::fromDecimal('2500000.0000', Currency::PLN),
            inv2: Money::fromDecimal('2500000.0000', Currency::PLN)
        );

        $appraisal = $this->runAppraisal($project);

        // 1. Target IRR too high (e.g. 150%) that project cannot achieve even with 0% promote
        $resHigh = $this->waterfallService->solveForTargetIrr(
            project: $project,
            appraisal: $appraisal,
            targetIrrInvestor2: 150.0
        );
        $this->assertNotNull($resHigh->targetIrrVariance());
        $this->assertFalse($resHigh->isTargetIrrMet());

        // 2. Target IRR too low (e.g. 2.0%) below the 8.0% hurdle
        $resLow = $this->waterfallService->solveForTargetIrr(
            project: $project,
            appraisal: $appraisal,
            targetIrrInvestor2: 2.0,
            hurdle1: 8.0
        );
        $this->assertNotNull($resLow->targetIrrVariance());

        // 3. Invalid negative target IRR throws exception
        $this->expectException(InvalidArgumentException::class);
        $this->waterfallService->solveForTargetIrr($project, $appraisal, -5.0);
    }

    public function test_waterfall_serialization_and_value_objects(): void
    {
        $project = $this->createTwoInvestorProject(
            inv1: Money::fromDecimal('3000000.0000', Currency::PLN),
            inv2: Money::fromDecimal('1000000.0000', Currency::PLN)
        );

        $appraisal = $this->runAppraisal($project);
        $result = $this->waterfallService->solve($project, $appraisal);

        $data = $result->toArray();
        $this->assertArrayHasKey('total_equity_invested', $data);
        $this->assertArrayHasKey('total_cash_distributed', $data);
        $this->assertArrayHasKey('structure', $data);
        $this->assertArrayHasKey('investor_1', $data);
        $this->assertArrayHasKey('investor_2', $data);
        $this->assertArrayHasKey('annual_periods', $data);
        $this->assertCount(15, $data['annual_periods']);

        // Value Object equals checks
        $tier = new WaterfallTier(1, 'Pref', 8.0, 50.0, 50.0);
        $tierCopy = new WaterfallTier(1, 'Pref', 8.0, 50.0, 50.0);
        $this->assertTrue($tier->equals($tierCopy));

        $structure1 = new WaterfallStructure([$tier]);
        $structure2 = new WaterfallStructure([$tierCopy]);
        $this->assertTrue($structure1->equals($structure2));
    }

    private function createTwoInvestorProject(Money $inv1, Money $inv2): InvestmentProject
    {
        $startDate = new DateTimeImmutable('2026-01-01');

        $stage = CapexStage::create(
            CapexStageId::generate(),
            'Linia technologiczna i infrastruktura',
            Money::fromDecimal('5000000.0000', Currency::PLN),
            $startDate,
            6,
            KstClassification::fromCode('KST_1')
        );

        $project = InvestmentProject::create(
            InvestmentProjectId::generate(),
            'comp-waterfall-test',
            'Biometanownia OZE',
            'Instalacja produkcji biometanu',
            $startDate,
            FinancingStructure::create(
                investor1Equity: $inv1,
                investor2Equity: $inv2
            ),
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

    private function runAppraisal(InvestmentProject $project): AppraisalResult
    {
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

        $horizon = 15;
        $income = $this->incomeService->generateStatement($project, $assumptions, $horizon);
        $cashFlow = $this->cashFlowService->generateStatement($project, $assumptions, $horizon);
        $balanceSheet = $this->balanceSheetService->generateStatement($project, $assumptions, $horizon);

        return $this->appraisalService->appraise(
            project: $project,
            incomeStatement: $income,
            cashFlowStatement: $cashFlow,
            balanceSheet: $balanceSheet
        );
    }
}
