<?php

declare(strict_types=1);

namespace Tests\Feature\InvestmentProject;

use App\Contexts\Identity\Domain\ValueObjects\RoleType;
use App\Models\Company;
use App\Models\InvestmentProject as InvestmentProjectModel;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

final class InvestmentValuationApiTest extends TestCase
{
    use DatabaseTransactions;

    private Company $companyA;
    private Company $companyB;
    private User $clientA;
    private User $clientB;
    private User $advisor;
    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->companyA = Company::create([
            'id' => (string) Str::uuid(),
            'name' => 'Solaris Energy Park Sp. z o.o.',
            'code' => 'SOLARIS_' . strtoupper(Str::random(6)),
            'tax_id' => 'PL' . random_int(1000000000, 9999999999),
        ]);

        $this->companyB = Company::create([
            'id' => (string) Str::uuid(),
            'name' => 'Foreign Offshore Sp. z o.o.',
            'code' => 'FOREIGN_' . strtoupper(Str::random(6)),
            'tax_id' => 'PL' . random_int(1000000000, 9999999999),
        ]);

        $this->clientA = User::create([
            'id' => (string) Str::uuid(),
            'name' => 'CFO Solaris Energy',
            'email' => 'client_a_' . Str::random(8) . '@solaris.local',
            'password' => Hash::make('secret123'),
            'role' => RoleType::CLIENT->value,
            'company_id' => $this->companyA->id,
            'is_active' => true,
        ]);

        $this->clientB = User::create([
            'id' => (string) Str::uuid(),
            'name' => 'CFO Foreign Offshore',
            'email' => 'client_b_' . Str::random(8) . '@foreign.local',
            'password' => Hash::make('secret123'),
            'role' => RoleType::CLIENT->value,
            'company_id' => $this->companyB->id,
            'is_active' => true,
        ]);

        $this->admin = User::create([
            'id' => (string) Str::uuid(),
            'name' => 'Global Admin Partner',
            'email' => 'admin_' . Str::random(8) . '@helvest.local',
            'password' => Hash::make('secret123'),
            'role' => RoleType::ADMIN->value,
            'company_id' => $this->companyA->id,
            'is_active' => true,
        ]);

        $this->advisor = User::create([
            'id' => (string) Str::uuid(),
            'name' => 'Investment Advisor Lead',
            'email' => 'advisor_' . Str::random(8) . '@helvest.local',
            'password' => Hash::make('secret123'),
            'role' => RoleType::ADVISOR->value,
            'company_id' => $this->companyA->id,
            'is_active' => true,
        ]);

        // Assign advisor strictly to Company A
        $this->advisor->assignedCompanies()->attach($this->companyA->id, [
            'assigned_by' => $this->admin->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function test_unauthenticated_requests_are_rejected_with_401(): void
    {
        $dummyId = (string) Str::uuid();

        $this->getJson('/api/v1/investment-projects')->assertStatus(401);
        $this->postJson('/api/v1/investment-projects', [])->assertStatus(401);
        $this->getJson("/api/v1/investment-projects/{$dummyId}")->assertStatus(401);
        $this->putJson("/api/v1/investment-projects/{$dummyId}", [])->assertStatus(401);
        $this->deleteJson("/api/v1/investment-projects/{$dummyId}")->assertStatus(401);
        $this->getJson("/api/v1/investment-projects/{$dummyId}/appraisal")->assertStatus(401);
        $this->postJson("/api/v1/investment-projects/{$dummyId}/waterfall", [])->assertStatus(401);
        $this->getJson("/api/v1/investment-projects/{$dummyId}/statements/three-statement")->assertStatus(401);
    }

    public function test_multi_tenant_isolation_prevents_cross_company_access(): void
    {
        // 1. Client A creates a project
        Sanctum::actingAs($this->clientA);
        $projectAId = $this->createStandardProject('Projekt Farmy Fotowoltaicznej 20MW');

        // 2. Client B creates a project
        Sanctum::actingAs($this->clientB);
        $projectBId = $this->createStandardProject('Projekt Morski Wiatrak 50MW');

        // 3. Client B cannot see Project A in list
        $listResponse = $this->getJson('/api/v1/investment-projects');
        $listResponse->assertStatus(200);
        $ids = array_column($listResponse->json('data'), 'id');
        $this->assertContains($projectBId, $ids);
        $this->assertNotContains($projectAId, $ids);

        // 4. Client B cannot show, update, delete Project A (Must return 404 to avoid leaking existence)
        $this->getJson("/api/v1/investment-projects/{$projectAId}")->assertStatus(404);
        $this->putJson("/api/v1/investment-projects/{$projectAId}", ['name' => 'Hack Attempt'])->assertStatus(404);
        $this->deleteJson("/api/v1/investment-projects/{$projectAId}")->assertStatus(404);

        // 5. Client B cannot add capex stage to Project A
        $this->postJson("/api/v1/investment-projects/{$projectAId}/capex-stages", [
            'stage_name' => 'Nieautoryzowany Etap',
            'net_amount' => '1000000.0000',
            'duration_months' => 6,
            'kst_code' => 'KST_3',
        ])->assertStatus(404);

        // 6. Client B cannot access Project A statements, appraisal, or waterfall
        $this->getJson("/api/v1/investment-projects/{$projectAId}/statements/three-statement")->assertStatus(404);
        $this->getJson("/api/v1/investment-projects/{$projectAId}/appraisal")->assertStatus(404);
        $this->postJson("/api/v1/investment-projects/{$projectAId}/waterfall", [])->assertStatus(404);
    }

    public function test_advisor_access_control_to_assigned_and_unassigned_companies(): void
    {
        // Create Project A under Company A
        Sanctum::actingAs($this->clientA);
        $projectAId = $this->createStandardProject('Projekt Wodór H2');

        // Create Project B under Company B
        Sanctum::actingAs($this->clientB);
        $projectBId = $this->createStandardProject('Projekt Bateria BESS');

        // Authenticate as Advisor (assigned ONLY to Company A)
        Sanctum::actingAs($this->advisor);

        // Advisor can access Company A project
        $this->getJson("/api/v1/investment-projects/{$projectAId}?company_id={$this->companyA->id}")
            ->assertStatus(200)
            ->assertJsonPath('data.name', 'Projekt Wodór H2');

        // Advisor attempting to access unassigned Company B project is rejected
        $this->getJson("/api/v1/investment-projects/{$projectBId}?company_id={$this->companyB->id}")
            ->assertStatus(403);
    }

    public function test_admin_can_access_any_company_projects_via_company_id_context(): void
    {
        Sanctum::actingAs($this->clientB);
        $projectBId = $this->createStandardProject('Biometanownia Pomorze');

        // Authenticate as Admin
        Sanctum::actingAs($this->admin);

        // Admin accessing Company B project with X-Company-Id header
        $response = $this->withHeader('X-Company-Id', $this->companyB->id)
            ->getJson("/api/v1/investment-projects/{$projectBId}");

        $response->assertStatus(200);
        $response->assertJsonPath('data.name', 'Biometanownia Pomorze');
        $response->assertJsonPath('data.company_id', $this->companyB->id);
    }

    public function test_dcf_appraisal_endpoint_calculates_enterprise_and_equity_metrics(): void
    {
        Sanctum::actingAs($this->clientA);
        $projectId = $this->createStandardProject('Centrum Danych AI Green');

        // Add 2 CAPEX stages
        $this->postJson("/api/v1/investment-projects/{$projectId}/capex-stages", [
            'stage_name' => 'Faza 1: Budynek Serwerowni',
            'net_amount' => '5000000.0000',
            'duration_months' => 6,
            'kst_code' => 'KST_1',
            'stage_order' => 1,
        ])->assertStatus(201);

        $this->postJson("/api/v1/investment-projects/{$projectId}/capex-stages", [
            'stage_name' => 'Faza 2: Serwery GPU i Zasilacze UPS',
            'net_amount' => '10000000.0000',
            'duration_months' => 6,
            'kst_code' => 'KST_IT',
            'stage_order' => 2,
        ])->assertStatus(201);

        // Call DCF Appraisal API
        $response = $this->getJson("/api/v1/investment-projects/{$projectId}/appraisal");

        $response->assertStatus(200);
        $response->assertJsonPath('status', 'success');

        $data = $response->json('data');
        $this->assertArrayHasKey('enterprise_level', $data);
        $this->assertArrayHasKey('equity_level', $data);
        $this->assertArrayHasKey('terminal_value', $data);
        $this->assertArrayHasKey('wacc', $data);
        $this->assertArrayHasKey('annual_periods', $data);

        // Enterprise Level Assertions
        $el = $data['enterprise_level'];
        $this->assertNotNull($el['enterprise_value']);
        $this->assertNotNull($el['pv_capex']);
        $this->assertNotNull($el['project_npv']);
        $this->assertNotNull($el['project_irr_percent']);
        $this->assertNotNull($el['profitability_index']);
        $this->assertNotNull($el['simple_payback_years']);
        $this->assertNotNull($el['discounted_payback_years']);

        // Equity Level Assertions
        $eq = $data['equity_level'];
        $this->assertNotNull($eq['initial_equity']);
        $this->assertNotNull($eq['sum_discounted_fcfe']);
        $this->assertNotNull($eq['equity_npv']);
        $this->assertNotNull($eq['equity_irr_percent']);
        $this->assertNotNull($eq['equity_moic']);
        $this->assertGreaterThan(0.0, (float) $eq['equity_moic']);
    }

    public function test_dcf_appraisal_supports_custom_wacc_and_terminal_value_methods(): void
    {
        Sanctum::actingAs($this->clientA);
        $projectId = $this->createStandardProject('Magazyn Energii 10MW');

        $this->postJson("/api/v1/investment-projects/{$projectId}/capex-stages", [
            'stage_name' => 'Baterie LFP',
            'net_amount' => '8000000.0000',
            'duration_months' => 6,
            'kst_code' => 'KST_4',
        ])->assertStatus(201);

        // 1. Gordon Growth with Ke override
        $gordonResponse = $this->getJson("/api/v1/investment-projects/{$projectId}/appraisal?tv_method=GORDON_GROWTH&tv_parameter=2.5&cost_of_equity_percent=14.5");
        $gordonResponse->assertStatus(200);
        $this->assertEquals('gordon_growth', $gordonResponse->json('data.terminal_value.method'));
        $this->assertEquals(2.5, $gordonResponse->json('data.terminal_value.parameter'));
        $this->assertEquals(14.5, $gordonResponse->json('data.wacc.cost_of_equity_percent'));

        // 2. Book Value method
        $bookResponse = $this->getJson("/api/v1/investment-projects/{$projectId}/appraisal?tv_method=BOOK_VALUE");
        $bookResponse->assertStatus(200);
        $this->assertEquals('book_value', $bookResponse->json('data.terminal_value.method'));
    }

    public function test_what_if_sensitivity_analysis_in_statements_and_appraisal_without_persistence(): void
    {
        Sanctum::actingAs($this->clientA);
        $projectId = $this->createStandardProject('Fabryka Pomp Ciepła');

        $this->postJson("/api/v1/investment-projects/{$projectId}/capex-stages", [
            'stage_name' => 'Linia Produkcyjna',
            'net_amount' => '6000000.0000',
            'duration_months' => 6,
            'kst_code' => 'KST_4',
        ])->assertStatus(201);

        // Call 3-Statement with What-If custom assumptions
        $whatIfResponse = $this->getJson("/api/v1/investment-projects/{$projectId}/statements/three-statement?annual_revenue_base=25000000.0000&variable_cost_percent=35.0");

        $whatIfResponse->assertStatus(200);
        $this->assertEquals('25000000.0000', $whatIfResponse->json('data.income_statement.assumptions.annual_revenue_base'));
        $this->assertEquals(35.0, $whatIfResponse->json('data.income_statement.assumptions.variable_cost_percent'));

        // Verify baseline project record in database remains untouched
        $showResponse = $this->getJson("/api/v1/investment-projects/{$projectId}");
        $showResponse->assertStatus(200);
        $this->assertEquals('Fabryka Pomp Ciepła', $showResponse->json('data.name'));
    }

    public function test_equity_waterfall_pari_passu_and_two_tier_hurdle(): void
    {
        Sanctum::actingAs($this->clientA);
        $projectId = $this->createStandardProject('Projekt Wiatrowy 30MW');

        $this->postJson("/api/v1/investment-projects/{$projectId}/capex-stages", [
            'stage_name' => 'Budowa Turbin',
            'net_amount' => '12000000.0000',
            'duration_months' => 12,
            'kst_code' => 'KST_4',
        ])->assertStatus(201);

        // 1. Pari Passu Waterfall Simulation
        $pariResponse = $this->postJson("/api/v1/investment-projects/{$projectId}/waterfall", [
            'structure_type' => 'PARI_PASSU',
        ]);

        $pariResponse->assertStatus(200);
        $pariData = $pariResponse->json('data');
        $this->assertTrue($pariData['is_fully_balanced']);
        $this->assertArrayHasKey('investor_1', $pariData);
        $this->assertArrayHasKey('investor_2', $pariData);

        // Cash conservation: total cash distributed equals sum of investor distributions
        $inv1Dist = (float) $pariData['investor_1']['total_distributions'];
        $inv2Dist = (float) $pariData['investor_2']['total_distributions'];
        $totalDist = (float) $pariData['total_cash_distributed'];
        $this->assertEqualsWithDelta($totalDist, $inv1Dist + $inv2Dist, 0.01);

        // 2. Two-Tier Hurdle & Promote Waterfall Simulation
        $twoTierResponse = $this->postJson("/api/v1/investment-projects/{$projectId}/waterfall", [
            'structure_type' => 'TWO_TIER',
            'hurdle_1_irr_percent' => 8.0,
            'tier_2_investor1_share' => 20.0,
        ]);

        $twoTierResponse->assertStatus(200);
        $this->assertTrue($twoTierResponse->json('data.is_fully_balanced'));
        $this->assertEquals(2, count($twoTierResponse->json('data.structure.tiers')));
    }

    public function test_equity_waterfall_numerical_target_irr_solver(): void
    {
        Sanctum::actingAs($this->clientA);
        $projectId = $this->createStandardProject('Projekt Fotowoltaika z BESS');

        $this->postJson("/api/v1/investment-projects/{$projectId}/capex-stages", [
            'stage_name' => 'Budowa Farmy',
            'net_amount' => '10000000.0000',
            'duration_months' => 6,
            'kst_code' => 'KST_4',
        ])->assertStatus(201);

        // Run numerical solver targeting Investor 2 IRR of 12.0%
        $solverResponse = $this->postJson("/api/v1/investment-projects/{$projectId}/waterfall", [
            'target_investor' => 2,
            'target_irr_percent' => 12.0,
            'hurdle_1_irr_percent' => 8.0,
        ]);

        $solverResponse->assertStatus(200);
        $solverData = $solverResponse->json('data');
        $this->assertNotNull($solverData['target_irr_percent']);
        $this->assertEquals(12.0, $solverData['target_irr_percent']);
        $this->assertNotNull($solverData['target_irr_variance']);
    }

    public function test_three_statement_endpoints_reconcile_and_maintain_zero_variance(): void
    {
        Sanctum::actingAs($this->clientA);
        $projectId = $this->createStandardProject('Biometanownia 5MW');

        $this->postJson("/api/v1/investment-projects/{$projectId}/capex-stages", [
            'stage_name' => 'Instalacja Fermentatorów',
            'net_amount' => '7000000.0000',
            'duration_months' => 12,
            'kst_code' => 'KST_4',
        ])->assertStatus(201);

        // 1. Comprehensive Three-Statement endpoint
        $threeStmt = $this->getJson("/api/v1/investment-projects/{$projectId}/statements/three-statement");
        $threeStmt->assertStatus(200);
        $this->assertTrue($threeStmt->json('data.balance_sheet.is_balanced'));
        $this->assertEquals('0.0000', $threeStmt->json('data.balance_sheet.max_variance'));

        // 2. Individual statement endpoints
        $this->getJson("/api/v1/investment-projects/{$projectId}/statements/income-statement")
            ->assertStatus(200)
            ->assertJsonPath('status', 'success');

        $this->getJson("/api/v1/investment-projects/{$projectId}/statements/balance-sheet")
            ->assertStatus(200)
            ->assertJsonPath('data.is_balanced', true);

        $this->getJson("/api/v1/investment-projects/{$projectId}/statements/cash-flow")
            ->assertStatus(200)
            ->assertJsonPath('status', 'success');

        $this->getJson("/api/v1/investment-projects/{$projectId}/statements/depreciation")
            ->assertStatus(200)
            ->assertJsonPath('status', 'success');
    }

    public function test_input_validation_and_business_rules_enforcement(): void
    {
        Sanctum::actingAs($this->clientA);

        // 1. Invalid Project initialization (empty name, negative amounts, grace > tenor)
        $invalidProjResponse = $this->postJson('/api/v1/investment-projects', [
            'name' => '',
            'start_date' => 'invalid-date',
            'equity_contribution' => -500,
            'bank_tenor_months' => 60,
            'bank_grace_period_months' => 120, // grace period > tenor
        ]);
        $invalidProjResponse->assertStatus(422);
        $invalidProjResponse->assertJsonValidationErrors(['name', 'start_date', 'equity_contribution', 'bank_grace_period_months']);

        // 2. Invalid CAPEX stage (negative net amount, invalid date)
        $projectId = $this->createStandardProject('Test Walidacji Błędów');
        $invalidStageResponse = $this->postJson("/api/v1/investment-projects/{$projectId}/capex-stages", [
            'stage_name' => '',
            'net_amount' => -100,
        ]);
        $invalidStageResponse->assertStatus(422);
        $invalidStageResponse->assertJsonValidationErrors(['stage_name', 'net_amount']);
    }

    public function test_can_update_project_financing_structure_and_debt_facility(): void
    {
        Sanctum::actingAs($this->clientA);
        $projectId = $this->createStandardProject('Projekt Przed Aktualizacją');

        $updateResponse = $this->putJson("/api/v1/investment-projects/{$projectId}", [
            'name' => 'Projekt Po Aktualizacji Montażu',
            'equity_contribution' => 4500000.00,
            'bank_loan_principal' => 8500000.00,
            'grant_amount' => 1500000.00,
            'vat_bridge_loan' => 1800000.00,
            'bank_base_rate' => 6.25,
            'bank_margin' => 1.95,
            'bank_tenor_months' => 144,
            'bank_grace_period_months' => 18,
            'amortization_type' => 'LINEAR',
            'upfront_fee_rate' => 1.5,
        ]);

        $updateResponse->assertStatus(200);
        $updateResponse->assertJsonPath('data.name', 'Projekt Po Aktualizacji Montażu');
        $updateResponse->assertJsonPath('data.financing_structure.equity_contribution', 4500000);
        $updateResponse->assertJsonPath('data.financing_structure.bank_loan_amount', 8500000);
        $updateResponse->assertJsonPath('data.financing_structure.grant_amount', 1500000);
        $updateResponse->assertJsonPath('data.financing_structure.vat_bridge_loan', 1800000);
        $updateResponse->assertJsonPath('data.debt_facilities.0.principal_amount', 8500000);
        $updateResponse->assertJsonPath('data.debt_facilities.0.base_rate_percent', 6.25);
        $updateResponse->assertJsonPath('data.debt_facilities.0.margin_percent', 1.95);
        $updateResponse->assertJsonPath('data.debt_facilities.0.tenor_months', 144);
        $updateResponse->assertJsonPath('data.debt_facilities.0.grace_period_months', 18);
        $updateResponse->assertJsonPath('data.debt_facilities.0.amortization_type', 'LINEAR');
        $updateResponse->assertJsonPath('data.debt_facilities.0.upfront_fee_percent', 1.5);
    }

    private function createStandardProject(string $name): string
    {
        $response = $this->postJson('/api/v1/investment-projects', [
            'name' => $name,
            'description' => 'Testowy projekt infrastruktury OZE',
            'start_date' => '2026-06-01',
            'planning_horizon_years' => 15,
            'currency' => 'PLN',
            'equity_contribution' => '3000000.0000',
            'bank_loan_principal' => '7000000.0000',
            'bank_base_rate' => 5.85,
            'bank_margin' => 2.15,
            'bank_tenor_months' => 120,
            'bank_grace_period_months' => 12,
            'amortization_type' => 'ANNUITY',
            'grant_amount' => '2000000.0000',
            'grant_intensity_percent' => 20.0,
            'vat_bridge_loan' => '2760000.0000',
            'capitalization_rate_percent' => 7.5,
            'valuation_multiple' => 8.5,
        ]);

        $response->assertStatus(201);

        return $response->json('data.id');
    }
}
