<?php

declare(strict_types=1);

namespace Tests\Feature\InvestmentProject;

use App\Contexts\Identity\Domain\ValueObjects\RoleType;
use App\Models\Company;
use App\Models\InvestmentCapexStage;
use App\Models\InvestmentDebtFacility;
use App\Models\InvestmentFinancingStructure;
use App\Models\InvestmentGrantAllocation;
use App\Models\InvestmentProject;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

final class InvestmentProjectDatabaseMigrationTest extends TestCase
{
    use DatabaseTransactions;

    private Company $companyA;
    private Company $companyB;
    private User $user;

    protected function setUp(): void
    {
        parent::setUp();

        $this->companyA = Company::create([
            'id' => (string) Str::uuid(),
            'name' => 'Solar Horizon Sp. z o.o.',
            'code' => 'SOLAR_TEST',
            'tax_id' => 'PL' . random_int(1000000000, 9999999999),
        ]);

        $this->companyB = Company::create([
            'id' => (string) Str::uuid(),
            'name' => 'Wind Power S.A.',
            'code' => 'WIND_TEST',
            'tax_id' => 'PL' . random_int(1000000000, 9999999999),
        ]);

        $this->user = User::create([
            'id' => (string) Str::uuid(),
            'name' => 'Deal Partner',
            'email' => 'partner_' . Str::random(8) . '@finboard.local',
            'password' => Hash::make('secret123'),
            'role' => RoleType::ADVISOR->value,
            'is_active' => true,
        ]);
    }

    public function test_all_investment_project_tables_exist_with_proper_columns(): void
    {
        $this->assertTrue(Schema::hasTable('investment_projects'));
        $this->assertTrue(Schema::hasColumns('investment_projects', [
            'id', 'company_id', 'name', 'description', 'status', 'currency',
            'commercial_operation_date', 'operating_assumptions', 'created_by', 'created_at', 'updated_at',
        ]));

        $this->assertTrue(Schema::hasTable('investment_capex_stages'));
        $this->assertTrue(Schema::hasColumns('investment_capex_stages', [
            'id', 'project_id', 'company_id', 'stage_name', 'net_amount', 'currency',
            'vat_rate_percent', 'vat_rate_code', 'start_date', 'completion_date',
            'kst_code', 'kst_annual_rate', 'eligible_for_grant', 'order_index',
            'created_at', 'updated_at',
        ]));

        $this->assertTrue(Schema::hasTable('investment_financing_structures'));
        $this->assertTrue(Schema::hasColumns('investment_financing_structures', [
            'id', 'project_id', 'company_id', 'equity_contribution', 'bank_loan_amount',
            'grant_amount', 'vat_bridge_loan', 'currency', 'grant_disbursement_schedule',
            'created_at', 'updated_at',
        ]));

        $this->assertTrue(Schema::hasTable('investment_debt_facilities'));
        $this->assertTrue(Schema::hasColumns('investment_debt_facilities', [
            'id', 'project_id', 'company_id', 'facility_name', 'facility_type',
            'principal_amount', 'currency', 'base_rate_type', 'base_rate_percent',
            'margin_percent', 'tenor_months', 'grace_period_months', 'amortization_type',
            'upfront_fee_percent', 'commitment_fee_percent', 'interest_payment_frequency',
            'principal_payment_frequency', 'created_at', 'updated_at',
        ]));

        $this->assertTrue(Schema::hasTable('investment_grant_allocations'));
        $this->assertTrue(Schema::hasColumns('investment_grant_allocations', [
            'id', 'project_id', 'company_id', 'grant_program_name', 'total_eligible_costs',
            'co_financing_rate_percent', 'max_grant_amount', 'advance_payment_amount',
            'currency', 'status', 'disbursement_schedule', 'notes',
            'created_at', 'updated_at',
        ]));
    }

    public function test_can_persist_and_relate_complete_investment_project_hierarchy(): void
    {
        $project = InvestmentProject::create([
            'id' => (string) Str::uuid(),
            'company_id' => $this->companyA->id,
            'name' => 'Farma Fotowoltaiczna 20 MW',
            'description' => 'Budowa elektrowni PV wraz z magazynem energii',
            'status' => 'active',
            'currency' => 'PLN',
            'commercial_operation_date' => '2027-06-30',
            'created_by' => $this->user->id,
        ]);

        $stage1 = InvestmentCapexStage::create([
            'id' => (string) Str::uuid(),
            'project_id' => $project->id,
            'company_id' => $this->companyA->id,
            'stage_name' => 'Prace ziemne i instalacja konstrukcji wsporczych',
            'net_amount' => '12500000.0000',
            'currency' => 'PLN',
            'vat_rate_percent' => '23.00',
            'vat_rate_code' => 'standard',
            'start_date' => '2026-04-01',
            'completion_date' => '2026-10-31',
            'kst_code' => 'KST-2',
            'kst_annual_rate' => '4.50',
            'eligible_for_grant' => true,
            'order_index' => 1,
        ]);

        $stage2 = InvestmentCapexStage::create([
            'id' => (string) Str::uuid(),
            'project_id' => $project->id,
            'company_id' => $this->companyA->id,
            'stage_name' => 'Dostawa paneli PV i falowników',
            'net_amount' => '27500000.0000',
            'currency' => 'PLN',
            'vat_rate_percent' => '23.00',
            'vat_rate_code' => 'standard',
            'start_date' => '2026-08-01',
            'completion_date' => '2027-06-30',
            'kst_code' => 'KST-4',
            'kst_annual_rate' => '10.00',
            'eligible_for_grant' => true,
            'order_index' => 2,
        ]);

        $financing = InvestmentFinancingStructure::create([
            'id' => (string) Str::uuid(),
            'project_id' => $project->id,
            'company_id' => $this->companyA->id,
            'equity_contribution' => '8000000.0000',
            'bank_loan_amount' => '22000000.0000',
            'grant_amount' => '10000000.0000',
            'vat_bridge_loan' => '9200000.0000',
            'currency' => 'PLN',
            'grant_disbursement_schedule' => [
                ['milestone' => 'Etap 1', 'amount' => '3000000.00', 'date' => '2026-11-15'],
                ['milestone' => 'Etap 2', 'amount' => '7000000.00', 'date' => '2027-07-31'],
            ],
        ]);

        $debt = InvestmentDebtFacility::create([
            'id' => (string) Str::uuid(),
            'project_id' => $project->id,
            'company_id' => $this->companyA->id,
            'facility_name' => 'Kredyt Inwestycyjny Konsorcjum Bankowego',
            'facility_type' => 'term_loan',
            'principal_amount' => '22000000.0000',
            'currency' => 'PLN',
            'base_rate_type' => 'WIBOR_3M',
            'base_rate_percent' => '5.8500',
            'margin_percent' => '2.4000',
            'tenor_months' => 180,
            'grace_period_months' => 15,
            'amortization_type' => 'ANNUITY',
            'upfront_fee_percent' => '1.20',
            'commitment_fee_percent' => '0.50',
            'interest_payment_frequency' => 'monthly',
            'principal_payment_frequency' => 'monthly',
        ]);

        $grant = InvestmentGrantAllocation::create([
            'id' => (string) Str::uuid(),
            'project_id' => $project->id,
            'company_id' => $this->companyA->id,
            'grant_program_name' => 'KPO B2.2.2 - Transformacja Energetyczna',
            'total_eligible_costs' => '40000000.0000',
            'co_financing_rate_percent' => '25.00',
            'max_grant_amount' => '10000000.0000',
            'advance_payment_amount' => '2000000.0000',
            'currency' => 'PLN',
            'status' => 'contracted',
            'notes' => 'Umowa o dofinansowanie podpisana z NFOŚiGW',
        ]);

        // Verify relationships from Project
        $this->assertEquals($this->companyA->id, $project->company->id);
        $this->assertEquals($this->user->id, $project->creator->id);
        $this->assertCount(2, $project->capexStages);
        $this->assertEquals('12500000.0000', $project->capexStages[0]->net_amount);
        $this->assertEquals('27500000.0000', $project->capexStages[1]->net_amount);
        $this->assertNotNull($project->financingStructure);
        $this->assertEquals('8000000.0000', $project->financingStructure->equity_contribution);
        $this->assertCount(1, $project->debtFacilities);
        $this->assertEquals('22000000.0000', $project->debtFacilities->first()->principal_amount);
        $this->assertCount(1, $project->grantAllocations);
        $this->assertEquals('10000000.0000', $project->grantAllocations->first()->max_grant_amount);

        // Verify relationship from Company
        $this->assertCount(1, $this->companyA->investmentProjects);
        $this->assertEquals($project->id, $this->companyA->investmentProjects->first()->id);
    }

    public function test_multi_tenant_isolation_scopes(): void
    {
        $projectA = InvestmentProject::create([
            'id' => (string) Str::uuid(),
            'company_id' => $this->companyA->id,
            'name' => 'Projekt Alfa',
            'status' => 'active',
            'currency' => 'PLN',
        ]);

        $projectB = InvestmentProject::create([
            'id' => (string) Str::uuid(),
            'company_id' => $this->companyB->id,
            'name' => 'Projekt Beta',
            'status' => 'active',
            'currency' => 'PLN',
        ]);

        $projectsForA = InvestmentProject::forCompany($this->companyA->id)->get();
        $projectsForB = InvestmentProject::forCompany($this->companyB->id)->get();

        $this->assertCount(1, $projectsForA);
        $this->assertTrue($projectsForA->contains('id', $projectA->id));
        $this->assertFalse($projectsForA->contains('id', $projectB->id));

        $this->assertCount(1, $projectsForB);
        $this->assertTrue($projectsForB->contains('id', $projectB->id));
        $this->assertFalse($projectsForB->contains('id', $projectA->id));
    }

    public function test_cascade_delete_removes_all_child_entities(): void
    {
        $project = InvestmentProject::create([
            'id' => (string) Str::uuid(),
            'company_id' => $this->companyA->id,
            'name' => 'Projekt do usunięcia',
            'status' => 'draft',
            'currency' => 'PLN',
        ]);

        $stageId = (string) Str::uuid();
        InvestmentCapexStage::create([
            'id' => $stageId,
            'project_id' => $project->id,
            'company_id' => $this->companyA->id,
            'stage_name' => 'Etap 1',
            'net_amount' => '100000.0000',
            'currency' => 'PLN',
            'start_date' => '2026-01-01',
            'completion_date' => '2026-06-30',
        ]);

        $financingId = (string) Str::uuid();
        InvestmentFinancingStructure::create([
            'id' => $financingId,
            'project_id' => $project->id,
            'company_id' => $this->companyA->id,
            'equity_contribution' => '100000.0000',
        ]);

        $debtId = (string) Str::uuid();
        InvestmentDebtFacility::create([
            'id' => $debtId,
            'project_id' => $project->id,
            'company_id' => $this->companyA->id,
            'facility_name' => 'Kredyt',
            'principal_amount' => '50000.0000',
            'tenor_months' => 36,
        ]);

        $grantId = (string) Str::uuid();
        InvestmentGrantAllocation::create([
            'id' => $grantId,
            'project_id' => $project->id,
            'company_id' => $this->companyA->id,
            'grant_program_name' => 'Dotacja Testowa',
            'total_eligible_costs' => '100000.0000',
            'co_financing_rate_percent' => '50.00',
            'max_grant_amount' => '50000.0000',
        ]);

        // Delete project
        $project->delete();

        // Assert all children are deleted via database foreign key cascades
        $this->assertDatabaseMissing('investment_projects', ['id' => $project->id]);
        $this->assertDatabaseMissing('investment_capex_stages', ['id' => $stageId]);
        $this->assertDatabaseMissing('investment_financing_structures', ['id' => $financingId]);
        $this->assertDatabaseMissing('investment_debt_facilities', ['id' => $debtId]);
        $this->assertDatabaseMissing('investment_grant_allocations', ['id' => $grantId]);
    }
}
