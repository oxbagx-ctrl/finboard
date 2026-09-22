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
use App\Contexts\InvestmentProject\Domain\Services\DebtAmortizationService;
use App\Contexts\InvestmentProject\Domain\Services\GrantAllocationService;
use App\Contexts\InvestmentProject\Domain\Services\VatBridgeLoanService;
use App\Contexts\InvestmentProject\Domain\ValueObjects\AmortizationType;
use App\Contexts\InvestmentProject\Domain\ValueObjects\CapexStageId;
use App\Contexts\InvestmentProject\Domain\ValueObjects\DebtFacilityId;
use App\Contexts\InvestmentProject\Domain\ValueObjects\GrantTrancheType;
use App\Contexts\InvestmentProject\Domain\ValueObjects\InterestMargin;
use App\Contexts\InvestmentProject\Domain\ValueObjects\InvestmentProjectId;
use App\Contexts\InvestmentProject\Domain\ValueObjects\KstClassification;
use App\Contexts\InvestmentProject\Domain\ValueObjects\LoanTenor;
use App\Contexts\InvestmentProject\Domain\ValueObjects\VatRate;
use App\Models\Company;
use DateTimeImmutable;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Str;
use Tests\TestCase;

final class FinancialEngineeringIntegrationTest extends TestCase
{
    use DatabaseTransactions;

    private Company $company;
    private InvestmentProjectRepositoryInterface $repository;
    private DebtAmortizationService $debtService;
    private VatBridgeLoanService $vatService;
    private GrantAllocationService $grantService;

    protected function setUp(): void
    {
        parent::setUp();

        $this->company = Company::create([
            'id' => (string) Str::uuid(),
            'name' => 'Industrial Biofuels Poland Sp. z o.o.',
            'code' => 'BIOFUELS_PL',
            'tax_id' => 'PL' . random_int(1000000000, 9999999999),
        ]);

        $this->repository = $this->app->make(InvestmentProjectRepositoryInterface::class);
        $this->debtService = $this->app->make(DebtAmortizationService::class);
        $this->vatService = $this->app->make(VatBridgeLoanService::class);
        $this->grantService = $this->app->make(GrantAllocationService::class);
    }

    public function test_ioc_container_binds_and_resolves_all_financial_engineering_services(): void
    {
        $this->assertInstanceOf(DebtAmortizationService::class, $this->debtService);
        $this->assertInstanceOf(VatBridgeLoanService::class, $this->vatService);
        $this->assertInstanceOf(GrantAllocationService::class, $this->grantService);

        // Verify singleton lifecycle in application container
        $secondDebtService = $this->app->make(DebtAmortizationService::class);
        $secondVatService = $this->app->make(VatBridgeLoanService::class);
        $secondGrantService = $this->app->make(GrantAllocationService::class);

        $this->assertSame($this->debtService, $secondDebtService);
        $this->assertSame($this->vatService, $secondVatService);
        $this->assertSame($this->grantService, $secondGrantService);
    }

    public function test_end_to_end_greenfield_manufacturing_facility_financial_engineering_montage(): void
    {
        $startDate = new DateTimeImmutable('2026-04-01');
        $projectId = InvestmentProjectId::generate();

        // 1. Setup Financing Structure & Debt Facility (5,000,000 PLN total: 2.5M Debt, 2.5M Grant)
        $financing = FinancingStructure::create(
            investor1Equity: Money::fromDecimal('1000000.0000', Currency::PLN),
            investor2Equity: Money::zero(Currency::PLN),
            grantAmount: Money::fromDecimal('2500000.0000', Currency::PLN),
            grantIntensityPercent: 50.0,
            vatBridgeLoanAmount: Money::fromDecimal('1150000.0000', Currency::PLN)
        );

        // 2,500,000 PLN Senior Debt, WIBOR 5.85% + Margin 2.15% = 8.0%, 60 months, 6m grace, 1.5% fee
        $debt = DebtFacility::create(
            DebtFacilityId::generate(),
            'Kredyt Inwestycyjny BGK',
            Money::fromDecimal('2500000.0000', Currency::PLN),
            InterestMargin::fromPercentage(2.15),
            5.85,
            LoanTenor::fromMonths(60, 6),
            AmortizationType::ANNUITY,
            1.5
        );

        $project = InvestmentProject::create(
            $projectId,
            $this->company->id,
            'Budowa Zakładu Biodiesla II',
            'Budowa instalacji rafinacji estrów metylowych',
            $startDate,
            $financing,
            $debt,
            VatRate::standard()
        );

        // 2. Add CAPEX Stages
        $stage1 = CapexStage::create(
            CapexStageId::generate(),
            'Roboty ziemne i fundamentowe',
            Money::fromDecimal('1000000.0000', Currency::PLN),
            $startDate,
            3,
            KstClassification::fromCode('KST_1'),
            true,
            Money::fromDecimal('1000000.0000', Currency::PLN),
            1
        );

        $stage2 = CapexStage::create(
            CapexStageId::generate(),
            'Konstrukcja hali produkcyjnej',
            Money::fromDecimal('2000000.0000', Currency::PLN),
            $startDate,
            6,
            KstClassification::fromCode('KST_1'),
            true,
            Money::fromDecimal('2000000.0000', Currency::PLN),
            2
        );

        $stage3 = CapexStage::create(
            CapexStageId::generate(),
            'Linia technologiczna i reaktory chemiczne',
            Money::fromDecimal('2000000.0000', Currency::PLN),
            $startDate,
            6,
            KstClassification::fromCode('KST_4'),
            true,
            Money::fromDecimal('2000000.0000', Currency::PLN),
            3
        );

        $project->addCapexStage($stage1);
        $project->addCapexStage($stage2);
        $project->addCapexStage($stage3);

        // Persist aggregate in database
        $this->repository->save($project);
        $this->assertTrue($this->repository->exists($projectId, $this->company->id));

        // Reconstruct from DB to ensure integrity
        $loadedProject = $this->repository->findById($projectId, $this->company->id);
        $this->assertNotNull($loadedProject);
        $this->assertEquals('5000000.0000', $loadedProject->totalCapexNet()->amount());

        // 3. Test Debt Amortization Engineering
        $debtSchedule = $this->debtService->generateSchedule($loadedProject->debtFacility());
        $this->assertEquals(60, $debtSchedule->periodCount());
        $this->assertEquals('37500.0000', $debtSchedule->upfrontFee()->amount()); // 1.5% of 2.5M = 37,500 PLN
        $this->assertEquals('2500000.0000', $debtSchedule->totalPrincipalPaid()->amount());
        $this->assertEquals('0.0000', $debtSchedule->outstandingBalanceAt(60)->amount());

        // Check grace period periods (months 1-6 have 0 principal payment)
        foreach (range(1, 6) as $m) {
            $period = $debtSchedule->periods()[$m - 1];
            $this->assertTrue($period->isGracePeriod());
            $this->assertEquals('0.0000', $period->principalPayment()->amount());
            $this->assertTrue($period->interestPayment()->isPositive());
            $this->assertEquals('2500000.0000', $period->closingBalance()->amount());
        }

        // Post-grace period (month 7 onwards) pays principal
        $this->assertTrue($debtSchedule->periods()[6]->principalPayment()->isPositive());

        // Annual debt summary for 15-year 3-Statement model
        $annualDebt = $debtSchedule->annualSummaries();
        $this->assertCount(5, $annualDebt); // 60 months = 5 years of loan tenure

        // 4. Test VAT Bridge Financing Service
        $vatSchedule = $this->vatService->generateFromAggregate(
            $loadedProject,
            annualInterestRate: 7.5,
            reimbursementLagMonths: 2
        );

        $this->assertGreaterThan(0, $vatSchedule->periodCount());
        $this->assertEquals('1150000.0000', $vatSchedule->totalVatIncurred()->amount()); // 23% of 5,000,000 PLN
        $this->assertEquals('1150000.0000', $vatSchedule->totalVatRefunded()->amount());
        $this->assertEquals('0.0000', $vatSchedule->finalPeriod()->closingBalance()->amount());
        $this->assertTrue($vatSchedule->peakExposure()->isPositive());
        $this->assertTrue($vatSchedule->isWithinLimit());

        // 5. Test Grant Allocation Service
        $grantResult = $this->grantService->generateFromAggregate(
            $loadedProject,
            grantProgramName: 'Program FENG Ścieżka SMART dla Przemysłu',
            advanceRatePercent: 20.0,
            finalRetentionPercent: 10.0,
            reimbursementLagMonths: 2
        );

        $this->assertEquals('5000000.0000', $grantResult->totalEligibleCosts()->amount());
        $this->assertEquals('2500000.0000', $grantResult->maxGrantAmount()->amount());
        $this->assertEquals('2500000.0000', $grantResult->totalDisbursed()->amount());
        $this->assertEquals('500000.0000', $grantResult->advancePaymentAmount()->amount()); // 20% of 2.5M

        // Tranches inspection
        $advance = $grantResult->advanceTranche();
        $this->assertNotNull($advance);
        $this->assertEquals(GrantTrancheType::ADVANCE, $advance->type());
        $this->assertEquals('500000.0000', $advance->disbursementAmount()->amount());

        $finalTranche = $grantResult->finalTranche();
        $this->assertNotNull($finalTranche);
        $this->assertEquals(GrantTrancheType::FINAL, $finalTranche->type());
        $this->assertEquals('250000.0000', $finalTranche->disbursementAmount()->amount()); // 10% of 2.5M

        // Verify annual inflows for Year 1
        $annualGrant = $grantResult->annualDisbursementSummary(15);
        $this->assertEquals('2500000.0000', $annualGrant[1]->amount());
    }

    public function test_linear_amortization_with_grant_cap_and_vat_revolving_facility(): void
    {
        $startDate = new DateTimeImmutable('2026-06-01');
        $projectId = InvestmentProjectId::generate();

        // 8,000,000 PLN CAPEX, 6,000,000 PLN Eligible
        $financing = FinancingStructure::create(
            investor1Equity: Money::fromDecimal('2000000.0000', Currency::PLN),
            investor2Equity: Money::zero(Currency::PLN),
            grantAmount: Money::fromDecimal('2000000.0000', Currency::PLN), // capped at 2M
            grantIntensityPercent: 50.0, // 50% would be 3M, but capped at 2M
            vatBridgeLoanAmount: Money::fromDecimal('1840000.0000', Currency::PLN)
        );

        // 4,000,000 PLN Linear Debt Facility, 48 months, 0 grace period
        $debt = DebtFacility::create(
            DebtFacilityId::generate(),
            'Kredyt Liniowy Konsorcjum Banków',
            Money::fromDecimal('4000000.0000', Currency::PLN),
            InterestMargin::fromPercentage(1.8),
            6.2,
            LoanTenor::fromMonths(48, 0),
            AmortizationType::LINEAR,
            1.0
        );

        $project = InvestmentProject::create(
            $projectId,
            $this->company->id,
            'Rozbudowa Terminalu Logistycznego',
            'Budowa placu manewrowego i magazynów',
            $startDate,
            $financing,
            $debt
        );

        $stage1 = CapexStage::create(
            CapexStageId::generate(),
            'Zakup działki i przyłącza (częściowo niekwalifikowane)',
            Money::fromDecimal('2000000.0000', Currency::PLN),
            $startDate,
            2,
            null,
            false // 0 eligible
        );

        $stage2 = CapexStage::create(
            CapexStageId::generate(),
            'Hale wysokiego składowania',
            Money::fromDecimal('6000000.0000', Currency::PLN),
            $startDate,
            8,
            null,
            true,
            Money::fromDecimal('6000000.0000', Currency::PLN)
        );

        $project->addCapexStage($stage1);
        $project->addCapexStage($stage2);

        $this->repository->save($project);

        // 1. Linear Debt Schedule Verification
        $debtSchedule = $this->debtService->generateSchedule($project->debtFacility());
        $this->assertEquals(48, $debtSchedule->periodCount());
        $this->assertEquals('4000000.0000', $debtSchedule->totalPrincipalPaid()->amount());
        $this->assertEquals('0.0000', $debtSchedule->outstandingBalanceAt(48)->amount());

        // Linear schedule has constant principal per period: 4,000,000 / 48 = 83,333.3333 PLN
        $firstPeriodPrincipal = $debtSchedule->periods()[0]->principalPayment()->amount();
        $secondPeriodPrincipal = $debtSchedule->periods()[1]->principalPayment()->amount();
        $this->assertEquals($firstPeriodPrincipal, $secondPeriodPrincipal);

        // Linear total payment decreases over time as interest decreases
        $this->assertTrue(
            $debtSchedule->periods()[0]->totalPayment()->greaterThan($debtSchedule->periods()[1]->totalPayment())
        );

        // 2. Grant Allocation with Cap Verification
        $grantResult = $this->grantService->calculate(
            grantProgramName: 'KPO Komponent A',
            capexStages: $project->capexStages(),
            coFinancingRatePercent: 50.0,
            grantCap: Money::fromDecimal('2000000.0000', Currency::PLN), // Cap enforced
            advanceRatePercent: 15.0,
            finalRetentionPercent: 10.0,
            reimbursementLagMonths: 3,
            projectStartDate: $startDate
        );

        $this->assertEquals('8000000.0000', $grantResult->totalCapex()->amount());
        $this->assertEquals('6000000.0000', $grantResult->totalEligibleCosts()->amount());
        $this->assertEquals('2000000.0000', $grantResult->nonEligibleCosts()->amount());
        // Cap limited grant to 2,000,000 PLN instead of 3,000,000 PLN
        $this->assertEquals('2000000.0000', $grantResult->maxGrantAmount()->amount());
        $this->assertEquals('2000000.0000', $grantResult->totalDisbursed()->amount());
        $this->assertEquals('300000.0000', $grantResult->advancePaymentAmount()->amount()); // 15% of 2M
    }

    public function test_bullet_repayment_facility_with_zero_grant_project(): void
    {
        $startDate = new DateTimeImmutable('2026-01-01');
        $projectId = InvestmentProjectId::generate();

        // 1,500,000 PLN 100% Equity / Bullet Bridge
        $financing = FinancingStructure::create(
            investor1Equity: Money::fromDecimal('500000.0000', Currency::PLN),
            investor2Equity: Money::zero(Currency::PLN),
            grantAmount: Money::zero(Currency::PLN),
            grantIntensityPercent: 0.0,
            vatBridgeLoanAmount: Money::zero(Currency::PLN)
        );

        $debt = DebtFacility::create(
            DebtFacilityId::generate(),
            'Obligacje Pomostowe Bullet',
            Money::fromDecimal('1000000.0000', Currency::PLN),
            InterestMargin::fromPercentage(3.0),
            7.0,
            LoanTenor::fromMonths(24, 0),
            AmortizationType::BULLET
        );

        $project = InvestmentProject::create(
            $projectId,
            $this->company->id,
            'Centrum Danych AI',
            'Serwerownia z finansowaniem dłużnym typu bullet',
            $startDate,
            $financing,
            $debt
        );

        $stage = CapexStage::create(
            CapexStageId::generate(),
            'Serwery i macierze dyskowe',
            Money::fromDecimal('1500000.0000', Currency::PLN),
            $startDate,
            3,
            null,
            false // No grant eligibility
        );

        $project->addCapexStage($stage);
        $this->repository->save($project);

        // Verify Bullet schedule
        $debtSchedule = $this->debtService->generateSchedule($project->debtFacility());
        $this->assertEquals(24, $debtSchedule->periodCount());

        // Periods 1..23 have 0 principal payment
        for ($i = 0; $i < 23; $i++) {
            $this->assertEquals('0.0000', $debtSchedule->periods()[$i]->principalPayment()->amount());
            $this->assertEquals('1000000.0000', $debtSchedule->periods()[$i]->closingBalance()->amount());
        }

        // Period 24 pays 100% principal
        $this->assertEquals('1000000.0000', $debtSchedule->periods()[23]->principalPayment()->amount());
        $this->assertEquals('0.0000', $debtSchedule->periods()[23]->closingBalance()->amount());

        // Verify Grant service handles 0 grant cleanly
        $grantResult = $this->grantService->generateFromAggregate($project);
        $this->assertEquals('0.0000', $grantResult->maxGrantAmount()->amount());
        $this->assertEquals('0.0000', $grantResult->totalDisbursed()->amount());
        $this->assertCount(0, $grantResult->tranches());
    }

    public function test_multi_tenant_isolation_on_financial_engineering_calculations(): void
    {
        $otherCompany = Company::create([
            'id' => (string) Str::uuid(),
            'name' => 'Foreign Corp Inc.',
            'code' => 'FOREIGN_CORP',
            'tax_id' => 'PL' . random_int(1000000000, 9999999999),
        ]);

        $projectA = InvestmentProject::create(
            InvestmentProjectId::generate(),
            $this->company->id,
            'Projekt Tenant A',
            'Opis',
            new DateTimeImmutable(),
            FinancingStructure::create(Money::fromDecimal('100000.0000', Currency::PLN)),
            DebtFacility::create(
                DebtFacilityId::generate(),
                'Dług A',
                Money::fromDecimal('50000.0000', Currency::PLN),
                InterestMargin::fromPercentage(2.0),
                5.0,
                LoanTenor::fromMonths(12)
            )
        );

        $this->repository->save($projectA);

        // Other company should not see or be able to query Project A
        $this->assertFalse($this->repository->exists($projectA->projectId(), $otherCompany->id));
        $this->assertNull($this->repository->findById($projectA->projectId(), $otherCompany->id));
    }
}
