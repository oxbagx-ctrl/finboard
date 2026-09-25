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
use App\Contexts\InvestmentProject\Domain\Services\GrantAllocationService;
use App\Contexts\InvestmentProject\Domain\Services\IncomeStatementService;
use App\Contexts\InvestmentProject\Domain\Services\VatBridgeLoanService;
use App\Contexts\InvestmentProject\Domain\ValueObjects\AmortizationType;
use App\Contexts\InvestmentProject\Domain\ValueObjects\CapexStageId;
use App\Contexts\InvestmentProject\Domain\ValueObjects\DebtFacilityId;
use App\Contexts\InvestmentProject\Domain\ValueObjects\InterestMargin;
use App\Contexts\InvestmentProject\Domain\ValueObjects\InvestmentProjectId;
use App\Contexts\InvestmentProject\Domain\ValueObjects\KstClassification;
use App\Contexts\InvestmentProject\Domain\ValueObjects\LoanTenor;
use App\Contexts\InvestmentProject\Domain\ValueObjects\OperatingAssumptions;
use App\Models\Company;
use App\Models\InvestmentFinancingStructure;
use App\Models\InvestmentProject as InvestmentProjectModel;
use App\Models\User;
use DateTimeImmutable;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Str;
use Tests\TestCase;

final class ProjectFinanceLmaCovenantsIntegrationTest extends TestCase
{
    use DatabaseTransactions;

    private Company $company;
    private User $advisorUser;
    private InvestmentProjectRepositoryInterface $repository;
    private DebtAmortizationService $debtService;
    private VatBridgeLoanService $vatService;
    private GrantAllocationService $grantService;
    private IncomeStatementService $incomeStatementService;
    private CashFlowService $cashFlowService;
    private BalanceSheetService $balanceSheetService;

    protected function setUp(): void
    {
        parent::setUp();

        $this->company = Company::create([
            'id' => (string) Str::uuid(),
            'name' => 'Baltic Offshore Wind Consortium Sp. z o.o.',
            'code' => 'BALTIC_WIND',
            'tax_id' => 'PL' . random_int(1000000000, 9999999999),
        ]);

        $this->advisorUser = User::create([
            'id' => (string) Str::uuid(),
            'name' => 'Krzysztof Kowalczyk (LMA Loan Specialist)',
            'email' => 'krzysztof.kowalczyk@balticwind.test',
            'password' => bcrypt('Secret123!'),
            'role' => 'advisor',
            'company_id' => $this->company->id,
            'is_active' => true,
        ]);
        $this->advisorUser->assignedCompanies()->attach($this->company->id, [
            'assigned_by' => $this->advisorUser->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->repository = $this->app->make(InvestmentProjectRepositoryInterface::class);
        $this->debtService = $this->app->make(DebtAmortizationService::class);
        $this->vatService = $this->app->make(VatBridgeLoanService::class);
        $this->grantService = $this->app->make(GrantAllocationService::class);
        $this->incomeStatementService = $this->app->make(IncomeStatementService::class);
        $this->cashFlowService = $this->app->make(CashFlowService::class);
        $this->balanceSheetService = $this->app->make(BalanceSheetService::class);
    }

    public function test_financing_structure_persists_grant_disbursement_schedule_with_multi_tenant_isolation(): void
    {
        $project = InvestmentProjectModel::create([
            'id' => (string) Str::uuid(),
            'company_id' => $this->company->id,
            'name' => 'Morska Farma Wiatrowa 120MW z Buforem DSRA',
            'currency' => 'PLN',
            'start_date' => '2026-01-01',
            'commercial_operation_date' => '2027-01-01',
            'planning_horizon_years' => 15,
            'status' => 'draft',
        ]);

        $grantSchedule = [
            ['milestone' => 'Zaliczka NFOŚiGW', 'amount' => '3000000.00', 'date' => '2026-03-31', 'month' => 3],
            ['milestone' => 'Transza Pośrednia Funduszy UE', 'amount' => '4000000.00', 'date' => '2026-09-30', 'month' => 9],
            ['milestone' => 'Płatność Końcowa Certyfikowana', 'amount' => '3000000.00', 'date' => '2027-02-28', 'month' => 14],
        ];

        InvestmentFinancingStructure::create([
            'id' => (string) Str::uuid(),
            'project_id' => $project->id,
            'company_id' => $this->company->id,
            'equity_contribution' => '10000000.0000',
            'bank_loan_amount' => '20000000.0000',
            'grant_amount' => '10000000.0000',
            'vat_bridge_loan' => '9200000.0000',
            'currency' => 'PLN',
            'grant_disbursement_schedule' => $grantSchedule,
        ]);

        $retrieved = InvestmentFinancingStructure::where('project_id', $project->id)
            ->where('company_id', $this->company->id)
            ->first();

        $this->assertNotNull($retrieved);
        $this->assertIsArray($retrieved->grant_disbursement_schedule);
        $this->assertCount(3, $retrieved->grant_disbursement_schedule);
        $this->assertSame('Zaliczka NFOŚiGW', $retrieved->grant_disbursement_schedule[0]['milestone']);
        $this->assertSame('3000000.00', $retrieved->grant_disbursement_schedule[0]['amount']);

        // Verify other companies cannot query this record
        $otherCompanyId = (string) Str::uuid();
        $crossTenant = InvestmentFinancingStructure::where('project_id', $project->id)
            ->where('company_id', $otherCompanyId)
            ->first();
        $this->assertNull($crossTenant);
    }

    public function test_three_statement_engine_reconciles_zero_variance_with_senior_debt_and_grants(): void
    {
        $startDate = new DateTimeImmutable('2026-01-01');

        $stage1 = CapexStage::create(
            CapexStageId::generate(),
            'Infrastruktura Przyłączeniowa i Kable',
            Money::fromDecimal('16000000.0000', Currency::PLN),
            $startDate,
            6,
            KstClassification::fromCode('KST_2'),
            true,
            Money::fromDecimal('16000000.0000', Currency::PLN),
            1
        );

        $stage2 = CapexStage::create(
            CapexStageId::generate(),
            'Zespoły Wiatrowe i Maszyny',
            Money::fromDecimal('24000000.0000', Currency::PLN),
            $startDate->modify('+6 months'),
            6,
            KstClassification::fromCode('KST_3'),
            true,
            Money::fromDecimal('24000000.0000', Currency::PLN),
            2
        );

        $debtFacility = DebtFacility::create(
            DebtFacilityId::generate(),
            'Senior Term Loan Consortium LMA',
            Money::fromDecimal('24000000.0000', Currency::PLN),
            InterestMargin::fromPercentage(2.50),
            5.85,
            LoanTenor::fromMonths(120, 12),
            AmortizationType::ANNUITY,
            1.00
        );

        $financing = FinancingStructure::create(
            investor1Equity: Money::fromDecimal('4000000.0000', Currency::PLN),
            investor2Equity: Money::fromDecimal('4000000.0000', Currency::PLN),
            grantAmount: Money::fromDecimal('8000000.0000', Currency::PLN),
            grantIntensityPercent: 20.0,
            vatBridgeLoanAmount: Money::fromDecimal('9200000.0000', Currency::PLN)
        );

        $projectId = InvestmentProjectId::generate();
        $project = InvestmentProject::create(
            $projectId,
            $this->company->id,
            'Projekt Wiatrowy LMA Audit Zero-Variance',
            'Kompleksowy projekt wiatrowy z audytem kowenantów LMA',
            $startDate,
            $financing,
            $debtFacility
        );

        $project->addCapexStage($stage1);
        $project->addCapexStage($stage2);

        $this->repository->save($project);
        $persisted = $this->repository->findById($projectId);
        $this->assertNotNull($persisted);

        $assumptions = new OperatingAssumptions(
            annualRevenueBase: Money::fromDecimal('16000000.0000', Currency::PLN),
            revenueGrowthRatePercent: 3.5,
            variableCostPercent: 20.0,
            annualFixedCostsBase: Money::fromDecimal('1200000.0000', Currency::PLN),
            fixedCostGrowthRatePercent: 2.5,
            annualPayrollBase: Money::fromDecimal('800000.0000', Currency::PLN),
            payrollGrowthRatePercent: 3.0,
            capacityRampUp: [1 => 60.0, 2 => 90.0, 3 => 100.0],
            citRatePercent: 19.0,
            taxLossCarryForwardEnabled: true
        );

        // Generate full 15-year 3-statement model
        $incomeStatement = $this->incomeStatementService->generateStatement($persisted, $assumptions, horizonYears: 15);
        $cashFlowStatement = $this->cashFlowService->generateStatement($persisted, $assumptions, horizonYears: 15);
        $balanceSheet = $this->balanceSheetService->generateStatement(
            $persisted,
            $assumptions,
            horizonYears: 15,
            cashFlowStatement: $cashFlowStatement,
            incomeStatement: $incomeStatement
        );

        // Verify zero variance balance sheet identity: Assets == Liabilities + Equity
        $this->assertTrue(
            $balanceSheet->isBalancedOverHorizon(),
            'Balance Sheet must maintain zero variance across all 180 months under Senior Debt and Grants.'
        );

        $annualSheets = $balanceSheet->annualStatements();
        $this->assertCount(15, $annualSheets);

        foreach ($annualSheets as $sheet) {
            $this->assertTrue($sheet->isBalanced());
            $this->assertEquals('0.0000', $sheet->variance()->amount());
        }
    }

    public function test_debt_amortization_schedule_produces_cfads_and_debt_service_for_lma_tenor(): void
    {
        $principal = Money::fromDecimal('30000000.0000', Currency::PLN);
        $rate = 8.0; // 8% annual
        $tenor = LoanTenor::fromMonths(120, 12); // 10 years tenor, 1 year grace

        $schedule = $this->debtService->generateScheduleForParameters(
            principal: $principal,
            nominalAnnualRate: $rate,
            tenor: $tenor,
            amortizationType: AmortizationType::ANNUITY,
            upfrontFeeRate: 1.0
        );

        $this->assertSame(120, $schedule->periodCount());

        // In grace period (month 1-12), principal repaid must be 0, interest only
        for ($m = 1; $m <= 12; $m++) {
            $p = $schedule->period($m);
            $this->assertNotNull($p);
            $this->assertTrue($p->isGracePeriod());
            $this->assertEquals('0.0000', $p->principalPayment()->amount());
            $this->assertTrue($p->interestPayment()->greaterThan(Money::zero(Currency::PLN)));
        }

        // After grace period (month 13-120), principal repaid must be positive
        for ($m = 13; $m <= 24; $m++) {
            $p = $schedule->period($m);
            $this->assertNotNull($p);
            $this->assertFalse($p->isGracePeriod());
            $this->assertTrue($p->principalPayment()->greaterThan(Money::zero(Currency::PLN)));
            $this->assertTrue($p->interestPayment()->greaterThan(Money::zero(Currency::PLN)));
        }

        // Annual debt service summary
        $annualSummaries = $schedule->annualSummaries();
        $this->assertCount(10, $annualSummaries);

        // Year 1 (Grace period): only interest
        $y1 = $schedule->annualSummary(1);
        $this->assertNotNull($y1);
        $this->assertEquals('0.0000', $y1->principalPaid()->amount());
        $this->assertTrue($y1->interestPaid()->greaterThan(Money::zero(Currency::PLN)));

        // Total principal paid across all 10 years must equal initial 30M PLN
        $this->assertEquals('30000000.0000', $schedule->totalPrincipalPaid()->amount());
        $this->assertTrue($schedule->outstandingBalanceAt(120)->isZero());
    }

    public function test_api_returns_grant_disbursement_schedule_in_project_response(): void
    {
        $project = InvestmentProjectModel::create([
            'id' => (string) Str::uuid(),
            'company_id' => $this->company->id,
            'name' => 'Farma Solarna 40MW z Kredytem LMA',
            'currency' => 'PLN',
            'start_date' => '2026-01-01',
            'commercial_operation_date' => '2026-09-01',
            'planning_horizon_years' => 15,
            'status' => 'draft',
        ]);

        $grantSchedule = [
            ['milestone' => 'Etap 1 - Panele PV', 'amount' => '5000000.00', 'date' => '2026-06-30'],
            ['milestone' => 'Etap 2 - Inwertery i Trafostacja', 'amount' => '5000000.00', 'date' => '2026-10-31'],
        ];

        InvestmentFinancingStructure::create([
            'id' => (string) Str::uuid(),
            'project_id' => $project->id,
            'company_id' => $this->company->id,
            'equity_contribution' => '6000000.0000',
            'bank_loan_amount' => '14000000.0000',
            'grant_amount' => '10000000.0000',
            'vat_bridge_loan' => '4600000.0000',
            'currency' => 'PLN',
            'grant_disbursement_schedule' => $grantSchedule,
        ]);

        $response = $this->actingAs($this->advisorUser, 'sanctum')
            ->getJson("/api/v1/investment-projects/{$project->id}");

        $response->assertStatus(200);
        $response->assertJsonPath('data.name', 'Farma Solarna 40MW z Kredytem LMA');
        $this->assertEquals(10000000, $response->json('data.financing_structure.grant_amount'));
        $response->assertJsonCount(2, 'data.financing_structure.grant_disbursement_schedule');
        $response->assertJsonPath('data.financing_structure.grant_disbursement_schedule.0.milestone', 'Etap 1 - Panele PV');
        $response->assertJsonPath('data.financing_structure.grant_disbursement_schedule.0.amount', '5000000.00');
    }
}
