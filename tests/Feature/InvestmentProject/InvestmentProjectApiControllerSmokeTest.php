<?php

declare(strict_types=1);

namespace Tests\Feature\InvestmentProject;

use App\Models\Company;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

final class InvestmentProjectApiControllerSmokeTest extends TestCase
{
    use DatabaseTransactions;

    private User $clientUser;
    private Company $company;

    protected function setUp(): void
    {
        parent::setUp();

        $this->company = Company::firstOrCreate(
            ['code' => 'API_TEST_CO'],
            ['name' => 'API Test Company Sp. z o.o.', 'tax_id' => 'PL' . random_int(1000000000, 9999999999)]
        );

        $this->clientUser = User::firstOrCreate(
            ['email' => 'client.api.test@finboard.local'],
            [
                'name' => 'Client API Tester',
                'password' => bcrypt('secret123'),
                'role' => 'client',
                'company_id' => $this->company->id,
                'is_active' => true,
            ]
        );
    }

    public function test_full_investment_project_rest_api_lifecycle(): void
    {
        Sanctum::actingAs($this->clientUser);

        // 1. Initialize Project via REST API
        $initResponse = $this->postJson('/api/v1/investment-projects', [
            'name' => 'Farma Wiatrowa Baltic 50MW',
            'description' => 'Projekt farmy wiatrowej offshore/onshore',
            'start_date' => '2026-06-01',
            'planning_horizon_years' => 15,
            'currency' => 'PLN',
            'equity_contribution' => '2500000.0000',
            'bank_loan_principal' => '6000000.0000',
            'bank_base_rate' => 5.85,
            'bank_margin' => 2.15,
            'bank_tenor_months' => 120,
            'bank_grace_period_months' => 12,
            'amortization_type' => 'ANNUITY',
            'grant_amount' => '1500000.0000',
            'grant_intensity_percent' => 15.0,
            'vat_bridge_loan' => '2300000.0000',
        ]);

        $initResponse->assertStatus(201);
        $initResponse->assertJsonPath('status', 'success');
        $projectId = $initResponse->json('data.id');
        $this->assertNotNull($projectId);

        // 2. List Projects
        $listResponse = $this->getJson('/api/v1/investment-projects');
        $listResponse->assertStatus(200);
        $listResponse->assertJsonPath('status', 'success');
        $this->assertGreaterThanOrEqual(1, $listResponse->json('count'));

        // 3. Show Project Details
        $showResponse = $this->getJson("/api/v1/investment-projects/{$projectId}");
        $showResponse->assertStatus(200);
        $showResponse->assertJsonPath('data.name', 'Farma Wiatrowa Baltic 50MW');

        // 4. Add CAPEX Stage
        $stageResponse = $this->postJson("/api/v1/investment-projects/{$projectId}/capex-stages", [
            'stage_name' => 'Etap 1: Zakup Turbin i Przyłącze',
            'net_amount' => '8000000.0000',
            'duration_months' => 12,
            'kst_code' => 'KST_4',
            'is_grant_eligible' => true,
            'grant_eligible_amount' => '6000000.0000',
            'stage_order' => 1,
        ]);

        $stageResponse->assertStatus(201);
        $stageId = $stageResponse->json('data.id');
        $this->assertNotNull($stageId);

        // 5. Update CAPEX Stage
        $updateStageResponse = $this->putJson("/api/v1/investment-projects/{$projectId}/capex-stages/{$stageId}", [
            'stage_name' => 'Etap 1: Zakup Turbin (Skorygowany)',
            'net_amount' => '8500000.0000',
            'duration_months' => 12,
            'kst_code' => 'KST_4',
            'stage_order' => 1,
        ]);
        $updateStageResponse->assertStatus(200);
        $updateStageResponse->assertJsonPath('data.stage_name', 'Etap 1: Zakup Turbin (Skorygowany)');

        // 6. Generate 3-Statement financial projections
        $threeStatementResponse = $this->getJson("/api/v1/investment-projects/{$projectId}/statements/three-statement");
        $threeStatementResponse->assertStatus(200);
        $threeStatementResponse->assertJsonPath('status', 'success');
        $this->assertArrayHasKey('income_statement', $threeStatementResponse->json('data'));
        $this->assertArrayHasKey('balance_sheet', $threeStatementResponse->json('data'));
        $this->assertArrayHasKey('cash_flow_statement', $threeStatementResponse->json('data'));
        $this->assertArrayHasKey('depreciation_schedule', $threeStatementResponse->json('data'));
        $this->assertTrue($threeStatementResponse->json('data.balance_sheet.is_balanced'));

        // 7. Calculate DCF Appraisal & Valuation KPI
        $appraisalResponse = $this->getJson("/api/v1/investment-projects/{$projectId}/appraisal");
        $appraisalResponse->assertStatus(200);
        $appraisalResponse->assertJsonPath('status', 'success');
        $this->assertArrayHasKey('enterprise_level', $appraisalResponse->json('data'));
        $this->assertArrayHasKey('equity_level', $appraisalResponse->json('data'));
        $this->assertNotNull($appraisalResponse->json('data.enterprise_level.project_npv'));

        // 8. Run Equity Waterfall Simulation
        $waterfallResponse = $this->postJson("/api/v1/investment-projects/{$projectId}/waterfall", [
            'structure_type' => 'TWO_TIER',
            'hurdle_1_irr_percent' => 8.0,
            'tier_2_investor1_share' => 20.0,
        ]);
        $waterfallResponse->assertStatus(200);
        $waterfallResponse->assertJsonPath('status', 'success');
        $this->assertArrayHasKey('investor_1', $waterfallResponse->json('data'));
        $this->assertArrayHasKey('investor_2', $waterfallResponse->json('data'));

        // 9. Remove CAPEX Stage
        $deleteStageResponse = $this->deleteJson("/api/v1/investment-projects/{$projectId}/capex-stages/{$stageId}");
        $deleteStageResponse->assertStatus(200);

        // 10. Delete Project
        $deleteProjResponse = $this->deleteJson("/api/v1/investment-projects/{$projectId}");
        $deleteProjResponse->assertStatus(200);

        // Verify project is no longer found
        $notFoundResponse = $this->getJson("/api/v1/investment-projects/{$projectId}");
        $notFoundResponse->assertStatus(404);
    }
}
