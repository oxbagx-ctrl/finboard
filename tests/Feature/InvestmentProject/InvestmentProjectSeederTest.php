<?php

declare(strict_types=1);

namespace Tests\Feature\InvestmentProject;

use App\Models\Company;
use App\Models\FinancialAuditLog;
use App\Models\InvestmentCapexStage;
use App\Models\InvestmentDebtFacility;
use App\Models\InvestmentFinancingStructure;
use App\Models\InvestmentGrantAllocation;
use App\Models\InvestmentProject;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\IdentitySeeder;
use Database\Seeders\InvestmentProjectSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Phase 46 Commit 227: Feature Test for InvestmentProjectSeeder
 */
final class InvestmentProjectSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_investment_project_seeder_populates_acme_manufacturing_demo_project(): void
    {
        // 1. Run prerequisite IdentitySeeder
        $this->seed(IdentitySeeder::class);

        // 2. Run InvestmentProjectSeeder
        $this->seed(InvestmentProjectSeeder::class);

        // 3. Verify Project Aggregate
        $project = InvestmentProject::query()
            ->with(['capexStages', 'financingStructure', 'debtFacilities', 'grantAllocations'])
            ->where('id', InvestmentProjectSeeder::DEMO_PROJECT_ID)
            ->first();

        $this->assertNotNull($project);
        $this->assertSame(InvestmentProjectSeeder::ACME_COMPANY_ID, $project->company_id);
        $this->assertSame(InvestmentProjectSeeder::PROJECT_NAME, $project->name);
        $this->assertSame('approved', $project->status);
        $this->assertSame('PLN', $project->currency);
        $this->assertSame('2027-03-01', $project->commercial_operation_date->format('Y-m-d'));

        // 4. Verify 4 CAPEX Stages
        $stages = $project->capexStages;
        $this->assertCount(4, $stages);
        $totalCapex = $stages->sum(fn ($s) => (float) $s->net_amount);
        $this->assertEquals(32000000.00, $totalCapex);

        // Stage 1: Land
        $stage1 = $stages->where('order_index', 1)->first();
        $this->assertSame('Nabycie gruntu inwestycyjnego pod rozbudowę', $stage1->stage_name);
        $this->assertEquals(4000000.00, (float) $stage1->net_amount);
        $this->assertSame('KST_0', $stage1->kst_code);
        $this->assertEquals(0.0, (float) $stage1->kst_annual_rate);
        $this->assertFalse($stage1->eligible_for_grant);

        // Stage 2: Buildings
        $stage2 = $stages->where('order_index', 2)->first();
        $this->assertSame('Roboty budowlano-konstrukcyjne hali produkcyjno-magazynowej', $stage2->stage_name);
        $this->assertEquals(12000000.00, (float) $stage2->net_amount);
        $this->assertSame('KST_1', $stage2->kst_code);
        $this->assertEquals(2.50, (float) $stage2->kst_annual_rate);
        $this->assertTrue($stage2->eligible_for_grant);

        // Stage 3: Machines
        $stage3 = $stages->where('order_index', 3)->first();
        $this->assertSame('Zautomatyzowane linie montażowe i park maszynowy CNC', $stage3->stage_name);
        $this->assertEquals(11000000.00, (float) $stage3->net_amount);
        $this->assertSame('KST_4', $stage3->kst_code);
        $this->assertEquals(10.00, (float) $stage3->kst_annual_rate);
        $this->assertTrue($stage3->eligible_for_grant);

        // Stage 4: IT & SCADA
        $stage4 = $stages->where('order_index', 4)->first();
        $this->assertSame('Oprogramowanie przemysłowe SCADA/MES oraz licencje R&D', $stage4->stage_name);
        $this->assertEquals(5000000.00, (float) $stage4->net_amount);
        $this->assertSame('KST_IT', $stage4->kst_code);
        $this->assertEquals(20.00, (float) $stage4->kst_annual_rate);
        $this->assertTrue($stage4->eligible_for_grant);

        // 5. Verify Financing Structure
        $financing = $project->financingStructure;
        $this->assertNotNull($financing);
        $this->assertEquals(8000000.00, (float) $financing->equity_contribution);
        $this->assertEquals(14000000.00, (float) $financing->bank_loan_amount);
        $this->assertEquals(10000000.00, (float) $financing->grant_amount);
        $this->assertEquals(5500000.00, (float) $financing->vat_bridge_loan);
        $this->assertCount(3, $financing->grant_disbursement_schedule);

        $totalSources = (float) $financing->equity_contribution
            + (float) $financing->bank_loan_amount
            + (float) $financing->grant_amount;
        $this->assertEquals($totalCapex, $totalSources);

        // 6. Verify Senior Debt Facility
        $debtFacility = $project->debtFacilities->first();
        $this->assertNotNull($debtFacility);
        $this->assertEquals(14000000.00, (float) $debtFacility->principal_amount);
        $this->assertSame('WIBOR_1M', $debtFacility->base_rate_type);
        $this->assertEquals(5.85, (float) $debtFacility->base_rate_percent);
        $this->assertEquals(2.40, (float) $debtFacility->margin_percent);
        $this->assertSame(144, $debtFacility->tenor_months);
        $this->assertSame(14, $debtFacility->grace_period_months);
        $this->assertSame('ANNUITY', $debtFacility->amortization_type);
        $this->assertEquals(1.50, (float) $debtFacility->upfront_fee_percent);

        // 7. Verify Grant Allocation
        $grantAllocation = $project->grantAllocations->first();
        $this->assertNotNull($grantAllocation);
        $this->assertSame('FENG - Ścieżka SMART (Innowacje w Przedsiębiorstwach)', $grantAllocation->grant_program_name);
        $this->assertEquals(20000000.00, (float) $grantAllocation->total_eligible_costs);
        $this->assertEquals(50.00, (float) $grantAllocation->co_financing_rate_percent);
        $this->assertEquals(10000000.00, (float) $grantAllocation->max_grant_amount);
        $this->assertCount(3, $grantAllocation->disbursement_schedule);

        // 8. Verify Operating Assumptions
        $assumptions = $project->operating_assumptions;
        $this->assertIsArray($assumptions);
        $this->assertEquals(32000000.00, (float) $assumptions['annual_revenue_base']);
        $this->assertCount(2, $assumptions['revenue_lines']);
        $this->assertEquals(40.0, (float) $assumptions['capacity_ramp_up']['1']);
        $this->assertEquals(24.0, (float) $assumptions['variable_cost_percent']);
        $this->assertEquals(2200000.00, (float) $assumptions['annual_fixed_costs_base']);
        $this->assertCount(4, $assumptions['headcount_matrix']);
        $this->assertSame(45, $assumptions['dso']);
        $this->assertSame(30, $assumptions['dpo']);
        $this->assertSame(20, $assumptions['dio']);
        $this->assertCount(2, $assumptions['reinvestment_programs']);
        $this->assertEquals(7.5, (float) $assumptions['valuation_multiple']['multiple']);
        $this->assertSame(7, $assumptions['exit_valuation']['exit_year']);
        $this->assertArrayHasKey('readiness_scorecard', $assumptions);

        // 9. Verify Audit Trail
        $auditLog = FinancialAuditLog::where('entity_type', 'InvestmentProject')
            ->where('entity_id', $project->id)
            ->first();
        $this->assertNotNull($auditLog);
        $this->assertSame(InvestmentProjectSeeder::ACME_COMPANY_ID, $auditLog->company_id);
        $this->assertSame('create', $auditLog->action);
    }

    public function test_investment_project_seeder_is_idempotent(): void
    {
        $this->seed(IdentitySeeder::class);

        // First run
        $this->seed(InvestmentProjectSeeder::class);
        $this->assertSame(1, InvestmentProject::where('id', InvestmentProjectSeeder::DEMO_PROJECT_ID)->count());
        $this->assertSame(4, InvestmentCapexStage::where('project_id', InvestmentProjectSeeder::DEMO_PROJECT_ID)->count());

        // Second run
        $this->seed(InvestmentProjectSeeder::class);
        $this->assertSame(1, InvestmentProject::where('id', InvestmentProjectSeeder::DEMO_PROJECT_ID)->count());
        $this->assertSame(4, InvestmentCapexStage::where('project_id', InvestmentProjectSeeder::DEMO_PROJECT_ID)->count());
        $this->assertSame(1, InvestmentFinancingStructure::where('project_id', InvestmentProjectSeeder::DEMO_PROJECT_ID)->count());
        $this->assertSame(1, InvestmentDebtFacility::where('project_id', InvestmentProjectSeeder::DEMO_PROJECT_ID)->count());
        $this->assertSame(1, InvestmentGrantAllocation::where('project_id', InvestmentProjectSeeder::DEMO_PROJECT_ID)->count());
    }

    public function test_database_seeder_executes_investment_project_seeder_successfully(): void
    {
        $this->seed(DatabaseSeeder::class);

        $this->assertTrue(
            InvestmentProject::where('id', InvestmentProjectSeeder::DEMO_PROJECT_ID)->exists()
        );
    }
}
