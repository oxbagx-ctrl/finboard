<?php

declare(strict_types=1);

namespace Tests\Feature\InvestmentProject;

use App\Contexts\Finance\Domain\ValueObjects\Currency;
use App\Contexts\Finance\Domain\ValueObjects\Money;
use App\Contexts\InvestmentProject\Domain\Entities\CapexStage;
use App\Contexts\InvestmentProject\Domain\Entities\DebtFacility;
use App\Contexts\InvestmentProject\Domain\Entities\FinancingStructure;
use App\Contexts\InvestmentProject\Domain\Model\InvestmentProject;
use App\Contexts\InvestmentProject\Domain\Repositories\InvestmentProjectRepositoryInterface;
use App\Contexts\InvestmentProject\Domain\Services\BalanceSheetService;
use App\Contexts\InvestmentProject\Domain\Services\CashFlowService;
use App\Contexts\InvestmentProject\Domain\Services\DebtAmortizationService;
use App\Contexts\InvestmentProject\Domain\Services\DepreciationScheduleService;
use App\Contexts\InvestmentProject\Domain\Services\GrantAllocationService;
use App\Contexts\InvestmentProject\Domain\Services\IncomeStatementService;
use App\Contexts\InvestmentProject\Domain\Services\LiquidityBalancingService;
use App\Contexts\InvestmentProject\Domain\Services\VatBridgeLoanService;
use App\Contexts\InvestmentProject\Domain\ValueObjects\AmortizationType;
use App\Contexts\InvestmentProject\Domain\ValueObjects\CapexStageId;
use App\Contexts\InvestmentProject\Domain\ValueObjects\DebtFacilityId;
use App\Contexts\InvestmentProject\Domain\ValueObjects\InterestMargin;
use App\Contexts\InvestmentProject\Domain\ValueObjects\InvestmentProjectId;
use App\Contexts\InvestmentProject\Domain\ValueObjects\KstClassification;
use App\Contexts\InvestmentProject\Domain\ValueObjects\LiquidityAlert;
use App\Contexts\InvestmentProject\Domain\ValueObjects\LoanTenor;
use App\Contexts\InvestmentProject\Domain\ValueObjects\OperatingAssumptions;
use App\Contexts\InvestmentProject\Domain\ValueObjects\TaxLossSettlementMode;
use App\Contexts\InvestmentProject\Domain\ValueObjects\WorkingCapitalDays;
use App\Models\Company;
use DateTimeImmutable;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Str;
use Tests\TestCase;

final class ThreeStatementEngineIntegrationTest extends TestCase
{
    use DatabaseTransactions;

    private Company $company;
    private InvestmentProjectRepositoryInterface $repository;
    private DepreciationScheduleService $depreciationService;
    private IncomeStatementService $incomeStatementService;
    private CashFlowService $cashFlowService;
    private BalanceSheetService $balanceSheetService;
    private LiquidityBalancingService $liquidityService;
    private DebtAmortizationService $debtService;
    private VatBridgeLoanService $vatService;
    private GrantAllocationService $grantService;

    protected function setUp(): void
    {
        parent::setUp();

        $this->company = Company::create([
            'id' => (string) Str::uuid(),
            'name' => 'GreenTech Hydrogen Systems Sp. z o.o.',
            'code' => 'GREENTECH_H2',
            'tax_id' => 'PL' . random_int(1000000000, 9999999999),
        ]);

        $this->repository = $this->app->make(InvestmentProjectRepositoryInterface::class);
        $this->depreciationService = $this->app->make(DepreciationScheduleService::class);
        $this->incomeStatementService = $this->app->make(IncomeStatementService::class);
        $this->cashFlowService = $this->app->make(CashFlowService::class);
        $this->balanceSheetService = $this->app->make(BalanceSheetService::class);
        $this->liquidityService = $this->app->make(LiquidityBalancingService::class);
        $this->debtService = $this->app->make(DebtAmortizationService::class);
        $this->vatService = $this->app->make(VatBridgeLoanService::class);
        $this->grantService = $this->app->make(GrantAllocationService::class);
    }

    public function test_ioc_container_resolves_all_phase_40_three_statement_services(): void
    {
        $this->assertInstanceOf(DepreciationScheduleService::class, $this->depreciationService);
        $this->assertInstanceOf(IncomeStatementService::class, $this->incomeStatementService);
        $this->assertInstanceOf(CashFlowService::class, $this->cashFlowService);
        $this->assertInstanceOf(BalanceSheetService::class, $this->balanceSheetService);
        $this->assertInstanceOf(LiquidityBalancingService::class, $this->liquidityService);
        $this->assertInstanceOf(DebtAmortizationService::class, $this->debtService);
        $this->assertInstanceOf(VatBridgeLoanService::class, $this->vatService);
        $this->assertInstanceOf(GrantAllocationService::class, $this->grantService);
    }

    public function test_end_to_end_15_year_three_statement_mathematical_reconciliation_and_zero_variance(): void
    {
        $startDate = new DateTimeImmutable('2026-01-01');

        // 1. Setup Staggered CAPEX Stages (Total 10,000,000 PLN Net CAPEX)
        // Stage 1: Hala Produkcyjna (KST_1, 2.5%, 6 months, 4,000,000 PLN)
        $stage1 = CapexStage::create(
            CapexStageId::generate(),
            'Budowa hali produkcyjnej i infrastruktury',
            Money::fromDecimal('4000000.0000', Currency::PLN),
            $startDate,
            6,
            KstClassification::fromCode('KST_1'),
            true,
            Money::fromDecimal('4000000.0000', Currency::PLN),
            1
        );

        // Stage 2: Linia Technologiczna i Maszyny (KST_4, 10.0%, 4 months starting month 3, 5,000,000 PLN)
        $stage2 = CapexStage::create(
            CapexStageId::generate(),
            'Linia elektrolizy wodorowej i urządzenia ciśnieniowe',
            Money::fromDecimal('5000000.0000', Currency::PLN),
            $startDate->modify('+2 months'),
            4,
            KstClassification::fromCode('KST_4'),
            true,
            Money::fromDecimal('5000000.0000', Currency::PLN),
            2
        );

        // Stage 3: Instalacja Fotowoltaiczna OZE (KST_6, 14.0%, 3 months starting month 4, 1,000,000 PLN)
        $stage3 = CapexStage::create(
            CapexStageId::generate(),
            'Farma fotowoltaiczna 1 MW na dachu hali',
            Money::fromDecimal('1000000.0000', Currency::PLN),
            $startDate->modify('+3 months'),
            3,
            KstClassification::fromCode('KST_6'),
            true,
            Money::fromDecimal('1000000.0000', Currency::PLN),
            3
        );

        // 2. Multi-source Financing Structure
        // Total Net CAPEX = 10,000,000 PLN, Gross CAPEX (+23% VAT) = 12,300,000 PLN
        // Equity 1: 3,000,000 PLN, Equity 2: 1,000,000 PLN (Total Equity: 4,000,000 PLN)
        // Bank Debt: 5,000,000 PLN
        // Grant: 2,000,000 PLN
        // VAT Bridge Facility: 2,300,000 PLN
        $financing = FinancingStructure::create(
            investor1Equity: Money::fromDecimal('3000000.0000', Currency::PLN),
            investor2Equity: Money::fromDecimal('1000000.0000', Currency::PLN),
            grantAmount: Money::fromDecimal('2000000.0000', Currency::PLN),
            grantIntensityPercent: 20.0,
            vatBridgeLoanAmount: Money::fromDecimal('2300000.0000', Currency::PLN)
        );

        // 3. Bank Facility: 5M PLN, 84 months (7 years), 6 months grace period, 1.25% upfront fee
        $debt = DebtFacility::create(
            DebtFacilityId::generate(),
            'Kredyt Inwestycyjny Konsorcjalny',
            Money::fromDecimal('5000000.0000', Currency::PLN),
            InterestMargin::fromPercentage(2.40),
            5.60, // Total nominal 8.00%
            LoanTenor::fromMonths(84, 6),
            AmortizationType::LINEAR,
            1.25
        );

        $projectId = InvestmentProjectId::generate();
        $project = InvestmentProject::create(
            $projectId,
            $this->company->id,
            'Zakład Produkcji Zielonego Wodoru',
            'Kompleksowy projekt inwestycyjny OZE i wodoru',
            $startDate,
            $financing,
            $debt
        );

        $project->addCapexStage($stage1);
        $project->addCapexStage($stage2);
        $project->addCapexStage($stage3);

        // Persist aggregate in database repository
        $this->repository->save($project);

        // Reconstruct from repository to ensure full ORM mapping integrity
        $persisted = $this->repository->findById($projectId);
        $this->assertNotNull($persisted);

        // 4. Operating Assumptions (15-year horizon, 180 months)
        $assumptions = new OperatingAssumptions(
            annualRevenueBase: Money::fromDecimal('12000000.0000', Currency::PLN),
            revenueGrowthRatePercent: 3.0,
            variableCostPercent: 35.0,
            annualFixedCostsBase: Money::fromDecimal('600000.0000', Currency::PLN),
            fixedCostGrowthRatePercent: 2.5,
            annualPayrollBase: Money::fromDecimal('1200000.0000', Currency::PLN),
            payrollGrowthRatePercent: 3.5,
            capacityRampUp: [1 => 50.0, 2 => 80.0, 3 => 100.0],
            citRatePercent: 19.0,
            taxLossCarryForwardEnabled: true
        );

        // 5. Generate 3-Statement financial statements
        $incomeStatement = $this->incomeStatementService->generateStatement($persisted, $assumptions, horizonYears: 15);
        $cashFlowStatement = $this->cashFlowService->generateStatement($persisted, $assumptions, horizonYears: 15);
        $balanceSheet = $this->balanceSheetService->generateStatement(
            $persisted,
            $assumptions,
            horizonYears: 15,
            cashFlowStatement: $cashFlowStatement,
            incomeStatement: $incomeStatement
        );

        // Verify statements structure
        $this->assertEquals(180, $incomeStatement->monthlyPeriodCount());
        $this->assertEquals(180, $cashFlowStatement->monthlyPeriodCount());
        $this->assertEquals(180, $balanceSheet->monthlyPeriodCount());
        $this->assertCount(15, $incomeStatement->annualStatements());
        $this->assertCount(15, $cashFlowStatement->annualStatements());
        $this->assertCount(15, $balanceSheet->annualStatements());

        // 6. Zero-Variance Balance Sheet Equality Validation across all 180 months
        $this->assertTrue(
            $balanceSheet->isBalancedOverHorizon(),
            'Balance Sheet must have zero variance (Assets == Liabilities + Equity) across all 180 months.'
        );

        for ($m = 1; $m <= 180; $m++) {
            $bsPeriod = $balanceSheet->monthlyPeriod($m);
            $this->assertNotNull($bsPeriod);
            $this->assertTrue($bsPeriod->isBalanced(), "Month {$m} balance sheet is not balanced.");
            $this->assertEquals('0.0000', $bsPeriod->variance()->amount(), "Month {$m} has non-zero variance.");

            // Cross-Statement Consistency:
            // Cash on Balance Sheet must strictly match Closing Cash in Cash Flow Statement
            $cfPeriod = $cashFlowStatement->monthlyPeriod($m);
            $this->assertNotNull($cfPeriod);
            $this->assertEquals(
                $cfPeriod->closingCashBalance()->amount(),
                $bsPeriod->cashAndEquivalents()->amount(),
                "Month {$m} Cash on Balance Sheet does not match Cash Flow Statement closing cash."
            );

            // Retained Earnings roll-forward:
            // Total Equity must equal Share Capital + Retained Earnings + Current Period Net Income
            $expectedEquity = $bsPeriod->shareCapital()
                ->add($bsPeriod->retainedEarnings())
                ->add($bsPeriod->currentPeriodNetIncome());
            $this->assertEquals(
                $expectedEquity->amount(),
                $bsPeriod->totalEquity()->amount(),
                "Month {$m} Equity components do not sum to total equity."
            );
        }

        // 7. Cross-Statement Annual Reconciliation for all 15 years
        for ($y = 1; $y <= 15; $y++) {
            $bsAnnual = $balanceSheet->annualStatement($y);
            $cfAnnual = $cashFlowStatement->annualStatement($y);
            $pnlAnnual = $incomeStatement->annualStatement($y);

            $this->assertNotNull($bsAnnual);
            $this->assertNotNull($cfAnnual);
            $this->assertNotNull($pnlAnnual);

            $this->assertTrue($bsAnnual->isBalanced());
            $this->assertEquals('0.0000', $bsAnnual->variance()->amount());

            // Year-end cash equality
            $this->assertEquals(
                $cfAnnual->closingCashBalance()->amount(),
                $bsAnnual->cashAndEquivalents()->amount(),
                "Year {$y} Balance Sheet cash does not match Cash Flow statement."
            );

            // Year-end Net Income consistency
            $this->assertEquals(
                $pnlAnnual->netIncome()->amount(),
                $cfAnnual->netIncome()->amount(),
                "Year {$y} Cash Flow net income does not match Income Statement net income."
            );
        }

        // 8. Long-Term Debt Extinction Verification
        // Senior debt has tenor of 84 months (7 years). By month 85+, long-term and short-term bank debt must be 0.
        $m85 = $balanceSheet->monthlyPeriod(85);
        $this->assertNotNull($m85);
        $this->assertEquals('0.0000', $m85->longTermDebt()->amount(), 'Senior long-term debt must extinguish after tenor.');
        $this->assertEquals('0.0000', $m85->shortTermDebt()->amount(), 'Senior short-term debt must extinguish after tenor.');

        // 9. Total CAPEX and Depreciation Verification
        $this->assertEquals('-10000000.0000', $cashFlowStatement->totalInvestingCashFlow()->amount());
    }

    public function test_liquidity_balancing_service_end_to_end_integration(): void
    {
        $startDate = new DateTimeImmutable('2026-01-01');

        $stage = CapexStage::create(
            CapexStageId::generate(),
            'Inwestycja testowa',
            Money::fromDecimal('2000000.0000', Currency::PLN),
            $startDate,
            6,
            KstClassification::fromCode('KST_4')
        );

        // Project with tight equity (1.0M equity, 1.0M debt = 2.0M financing vs 2.46M gross capex)
        $project = InvestmentProject::create(
            InvestmentProjectId::generate(),
            $this->company->id,
            'Projekt z luką płynnościową',
            'Opis',
            $startDate,
            FinancingStructure::create(Money::fromDecimal('1000000.0000', Currency::PLN)),
            DebtFacility::create(
                DebtFacilityId::generate(),
                'Kredyt',
                Money::fromDecimal('1000000.0000', Currency::PLN),
                InterestMargin::fromPercentage(2.0),
                6.0,
                LoanTenor::fromMonths(60, 6),
                AmortizationType::ANNUITY,
                1.0
            )
        );
        $project->addCapexStage($stage);

        $assumptions = new OperatingAssumptions(
            annualRevenueBase: Money::fromDecimal('3000000.0000', Currency::PLN),
            revenueGrowthRatePercent: 2.0,
            variableCostPercent: 40.0,
            annualFixedCostsBase: Money::fromDecimal('200000.0000', Currency::PLN),
            fixedCostGrowthRatePercent: 2.0,
            annualPayrollBase: Money::fromDecimal('300000.0000', Currency::PLN),
            payrollGrowthRatePercent: 3.0,
            capacityRampUp: [1 => 50.0, 2 => 80.0, 3 => 100.0],
            citRatePercent: 19.0,
            taxLossCarryForwardEnabled: true
        );

        $cashFlowStatement = $this->cashFlowService->generateStatement($project, $assumptions, horizonYears: 15);

        // Case A: Revolving credit limit of 1.5M covers the deficit
        $rcfLimit = Money::fromDecimal('1500000.0000', Currency::PLN);
        $cashBuffer = Money::fromDecimal('50000.0000', Currency::PLN);

        $schedule = $this->liquidityService->balanceLiquidity(
            $project,
            $cashFlowStatement,
            $rcfLimit,
            $cashBuffer,
            annualInterestRate: 8.50
        );

        $this->assertTrue($schedule->isLiquidOverHorizon(), 'Sufficient facility limit must keep project liquid.');
        $this->assertFalse($schedule->hasUnfundedDeficit());
        $this->assertTrue($schedule->maxFacilityExposure()->isPositive());
        $this->assertTrue($schedule->totalDrawdowns()->isPositive());
        $this->assertTrue($schedule->totalRepayments()->isPositive());

        // Case B: Inadequate revolving limit of 100k triggers critical alerts
        $tightLimit = Money::fromDecimal('100000.0000', Currency::PLN);
        $stressedSchedule = $this->liquidityService->balanceLiquidity(
            $project,
            $cashFlowStatement,
            $tightLimit,
            $cashBuffer,
            annualInterestRate: 8.50
        );

        $this->assertFalse($stressedSchedule->isLiquidOverHorizon());
        $this->assertTrue($stressedSchedule->hasUnfundedDeficit());
        $this->assertNotEmpty($stressedSchedule->criticalAlerts());

        $firstCritical = $stressedSchedule->criticalAlerts()[0];
        $this->assertEquals('UNFUNDED_CASH_DEFICIT', $firstCritical->code());
        $this->assertTrue($firstCritical->isCritical());
    }

    public function test_multi_tenant_isolation_on_three_statement_evaluations(): void
    {
        $otherCompany = Company::create([
            'id' => (string) Str::uuid(),
            'name' => 'Foreign Competitor Ltd',
            'code' => 'COMPETITOR',
            'tax_id' => 'PL9999999999',
        ]);

        $startDate = new DateTimeImmutable('2026-01-01');

        $project = InvestmentProject::create(
            InvestmentProjectId::generate(),
            $this->company->id,
            'Nasz poufny projekt',
            'Opis',
            $startDate,
            FinancingStructure::create(Money::fromDecimal('500000.0000', Currency::PLN)),
            DebtFacility::create(
                DebtFacilityId::generate(),
                'Kredyt',
                Money::fromDecimal('500000.0000', Currency::PLN),
                InterestMargin::fromPercentage(2.0),
                6.0,
                LoanTenor::fromMonths(36, 0),
                AmortizationType::LINEAR
            )
        );

        $this->repository->save($project);

        // Querying repository with otherCompany id must not return project
        $found = $this->repository->findByCompanyId($otherCompany->id);
        $this->assertEmpty($found);

        $ourProjects = $this->repository->findByCompanyId($this->company->id);
        $this->assertNotEmpty($ourProjects);
        $this->assertEquals($project->id(), $ourProjects[0]->id());

        $this->assertNull($this->repository->findById($project->projectId(), $otherCompany->id));
        $this->assertNotNull($this->repository->findById($project->projectId(), $this->company->id));
    }
    public function test_end_to_end_statutory_cit_tax_loss_carry_forward_and_one_off_mode_parity(): void
    {
        $startDate = new DateTimeImmutable('2026-01-01');

        $stage = CapexStage::create(
            CapexStageId::generate(),
            'Infrastruktura Przemysłowa',
            Money::fromDecimal('8000000.0000', Currency::PLN),
            $startDate,
            6,
            KstClassification::fromCode('KST_4')
        );

        $project = InvestmentProject::create(
            InvestmentProjectId::generate(),
            $this->company->id,
            'Projekt Fotowoltaiczny & BESS',
            'Opis',
            $startDate,
            FinancingStructure::create(Money::fromDecimal('4000000.0000', Currency::PLN)),
            DebtFacility::create(
                DebtFacilityId::generate(),
                'Kredyt Inwestycyjny',
                Money::fromDecimal('4000000.0000', Currency::PLN),
                InterestMargin::fromPercentage(2.0),
                6.0,
                LoanTenor::fromMonths(60, 6),
                AmortizationType::LINEAR,
                1.0
            )
        );
        $project->addCapexStage($stage);
        $this->repository->save($project);

        // Standard 50% cap assumptions (art. 7 ust. 5 pkt 1 CIT)
        $standardAssumptions = new OperatingAssumptions(
            annualRevenueBase: Money::fromDecimal('10000000.0000', Currency::PLN),
            revenueGrowthRatePercent: 3.0,
            variableCostPercent: 30.0,
            annualFixedCostsBase: Money::fromDecimal('800000.0000', Currency::PLN),
            fixedCostGrowthRatePercent: 2.0,
            annualPayrollBase: Money::fromDecimal('1000000.0000', Currency::PLN),
            payrollGrowthRatePercent: 3.0,
            capacityRampUp: [1 => 10.0, 2 => 90.0, 3 => 100.0],
            citRatePercent: 19.0,
            taxLossCarryForwardEnabled: true,
            taxLossSettlementMode: TaxLossSettlementMode::STANDARD_LOSS_CAP,
            taxLossOffsetCapPercent: 50.0
        );

        // One-off 5M cap assumptions (art. 7 ust. 5 pkt 2 CIT)
        $oneOffAssumptions = new OperatingAssumptions(
            annualRevenueBase: Money::fromDecimal('10000000.0000', Currency::PLN),
            revenueGrowthRatePercent: 3.0,
            variableCostPercent: 30.0,
            annualFixedCostsBase: Money::fromDecimal('800000.0000', Currency::PLN),
            fixedCostGrowthRatePercent: 2.0,
            annualPayrollBase: Money::fromDecimal('1000000.0000', Currency::PLN),
            payrollGrowthRatePercent: 3.0,
            capacityRampUp: [1 => 10.0, 2 => 90.0, 3 => 100.0],
            citRatePercent: 19.0,
            taxLossCarryForwardEnabled: true,
            taxLossSettlementMode: TaxLossSettlementMode::ONE_OFF_5M,
            taxLossOneOffCapAmount: Money::fromDecimal('5000000.0000', Currency::PLN)
        );

        // Generate statements for both modes
        $pnlStandard = $this->incomeStatementService->generateStatement($project, $standardAssumptions, horizonYears: 15);
        $cfStandard = $this->cashFlowService->generateStatement($project, $standardAssumptions, horizonYears: 15);
        $bsStandard = $this->balanceSheetService->generateStatement($project, $standardAssumptions, 15, $cfStandard, $pnlStandard);

        $pnlOneOff = $this->incomeStatementService->generateStatement($project, $oneOffAssumptions, horizonYears: 15);
        $cfOneOff = $this->cashFlowService->generateStatement($project, $oneOffAssumptions, horizonYears: 15);
        $bsOneOff = $this->balanceSheetService->generateStatement($project, $oneOffAssumptions, 15, $cfOneOff, $pnlOneOff);

        // 1. Both Balance Sheets must balance with ZERO variance across all 180 months
        $this->assertTrue($bsStandard->isBalancedOverHorizon(), 'Standard mode balance sheet must be balanced over 180 months.');
        $this->assertTrue($bsOneOff->isBalancedOverHorizon(), 'One-off mode balance sheet must be balanced over 180 months.');

        // 2. Both modes must have monthly YTD advance sum strictly equal to annual CIT
        for ($y = 1; $y <= 15; $y++) {
            $annualStd = $pnlStandard->annualStatement($y);
            $annualOne = $pnlOneOff->annualStatement($y);

            $monthlyStdCitSum = 0.0;
            $monthlyOneCitSum = 0.0;
            for ($m = 1; $m <= 12; $m++) {
                $monthIdx = ($y - 1) * 12 + $m;
                $monthlyStdCitSum += (float) $pnlStandard->monthlyPeriod($monthIdx)->incomeTax()->amount();
                $monthlyOneCitSum += (float) $pnlOneOff->monthlyPeriod($monthIdx)->incomeTax()->amount();
            }

            $this->assertEqualsWithDelta((float) $annualStd->incomeTax()->amount(), $monthlyStdCitSum, 0.01, "Year {$y} standard CIT mismatch");
            $this->assertEqualsWithDelta((float) $annualOne->incomeTax()->amount(), $monthlyOneCitSum, 0.01, "Year {$y} one-off CIT mismatch");
        }

        // 3. In Year 1 (low ramp up 10%), project incurs a loss, creating a tax loss pool
        $pnlStdY1 = $pnlStandard->annualStatement(1);
        $this->assertTrue($pnlStdY1->ebt()->isNegative(), 'Year 1 EBT must be negative due to low capacity ramp up.');
        $this->assertEquals('0.0000', $pnlStdY1->incomeTax()->amount(), 'Year 1 CIT must be 0 PLN due to loss.');

        // 4. In Year 2 (ramp up 90%), Year 1 loss is carried forward
        $pnlStdY2 = $pnlStandard->annualStatement(2);
        $pnlOneY2 = $pnlOneOff->annualStatement(2);

        $this->assertTrue($pnlStdY2->taxLossUsed()->isPositive(), 'Standard mode must use tax loss in Year 2.');
        $this->assertTrue($pnlOneY2->taxLossUsed()->isPositive(), 'One-off mode must use tax loss in Year 2.');

        // In One-Off 5M mode, up to 100% of loss (within 5M) can be deducted in Year 2,
        // so taxLossUsed in Year 2 is higher than or equal to standard mode (50% cap)
        $this->assertGreaterThanOrEqual(
            (float) $pnlStdY2->taxLossUsed()->amount(),
            (float) $pnlOneY2->taxLossUsed()->amount()
        );

        // Consequently, One-Off mode has equal or lower CIT in Year 2
        $this->assertLessThanOrEqual(
            (float) $pnlStdY2->incomeTax()->amount(),
            (float) $pnlOneY2->incomeTax()->amount()
        );

        // And higher or equal Year 2 Net Income
        $this->assertGreaterThanOrEqual(
            (float) $pnlStdY2->netIncome()->amount(),
            (float) $pnlOneY2->netIncome()->amount()
        );

        // 5. Cross-statement reconciliation for both modes
        for ($m = 1; $m <= 180; $m++) {
            $this->assertEquals(
                $cfStandard->monthlyPeriod($m)->closingCashBalance()->amount(),
                $bsStandard->monthlyPeriod($m)->cashAndEquivalents()->amount(),
                "Standard Month {$m} Cash mismatch"
            );
            $this->assertEquals(
                $cfOneOff->monthlyPeriod($m)->closingCashBalance()->amount(),
                $bsOneOff->monthlyPeriod($m)->cashAndEquivalents()->amount(),
                "OneOff Month {$m} Cash mismatch"
            );
        }
    }
}
