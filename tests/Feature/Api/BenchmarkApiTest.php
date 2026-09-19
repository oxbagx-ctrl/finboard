<?php

declare(strict_types=1);

namespace Tests\Feature\Api;

use App\Models\Company;
use App\Models\FinancialBenchmark;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Symfony\Component\HttpFoundation\Response;
use Tests\TestCase;

final class BenchmarkApiTest extends TestCase
{
    use DatabaseTransactions;

    private User $adminUser;
    private User $advisorUser;
    private User $clientUser;
    private Company $targetCompany;
    private Company $otherCompany;

    protected function setUp(): void
    {
        parent::setUp();

        $this->targetCompany = Company::create([
            'id' => (string) Str::uuid(),
            'name' => 'Target Portfolio Sp. z o.o.',
            'code' => 'TARGET_' . strtoupper(Str::random(5)),
            'tax_id' => 'PL' . random_int(1000000000, 9999999999),
        ]);

        $this->otherCompany = Company::create([
            'id' => (string) Str::uuid(),
            'name' => 'Unrelated Corp Sp. z o.o.',
            'code' => 'OTHER_' . strtoupper(Str::random(5)),
            'tax_id' => 'PL' . random_int(1000000000, 9999999999),
        ]);

        $this->adminUser = User::create([
            'id' => (string) Str::uuid(),
            'name' => 'Partner Admin',
            'email' => 'partner_' . Str::random(6) . '@helvest.com',
            'password' => bcrypt('password123'),
            'role' => 'admin',
            'is_active' => true,
        ]);

        $this->advisorUser = User::create([
            'id' => (string) Str::uuid(),
            'name' => 'Lead Advisor',
            'email' => 'advisor_' . Str::random(6) . '@helvest.com',
            'password' => bcrypt('password123'),
            'role' => 'advisor',
            'is_active' => true,
        ]);

        // Assign targetCompany to advisorUser
        $this->advisorUser->assignedCompanies()->attach($this->targetCompany->id, [
            'assigned_by' => $this->adminUser->id,
        ]);

        $this->clientUser = User::create([
            'id' => (string) Str::uuid(),
            'name' => 'Client CFO',
            'email' => 'cfo_' . Str::random(6) . '@target.com',
            'password' => bcrypt('password123'),
            'role' => 'client',
            'company_id' => $this->targetCompany->id,
            'is_active' => true,
        ]);
    }

    public function test_unauthenticated_request_is_rejected(): void
    {
        $response = $this->getJson('/api/v1/finance/benchmarks');
        $response->assertStatus(Response::HTTP_UNAUTHORIZED);
    }

    public function test_client_can_view_benchmarks_for_own_company(): void
    {
        Sanctum::actingAs($this->clientUser);

        $response = $this->getJson('/api/v1/finance/benchmarks');

        $response->assertStatus(Response::HTTP_OK)
            ->assertJson([
                'status' => 'success',
                'company_id' => $this->targetCompany->id,
            ]);

        $data = $response->json('data');
        $this->assertCount(8, $data);
        $metricTypes = array_column($data, 'metric_type');
        $this->assertContains('CURRENT_RATIO', $metricTypes);
        $this->assertContains('EBITDA_MARGIN', $metricTypes);
        $this->assertContains('REVENUE_GROWTH', $metricTypes);
    }

    public function test_client_cannot_update_benchmarks(): void
    {
        Sanctum::actingAs($this->clientUser);

        $response = $this->putJson('/api/v1/finance/benchmarks/CURRENT_RATIO', [
            'target_value' => 2.0,
            'warning_threshold' => 1.5,
        ]);

        $response->assertStatus(Response::HTTP_FORBIDDEN);
    }

    public function test_client_cannot_batch_update_or_reset_benchmarks(): void
    {
        Sanctum::actingAs($this->clientUser);

        $batchResponse = $this->putJson('/api/v1/finance/benchmarks', [
            'benchmarks' => [
                [
                    'metric_type' => 'CURRENT_RATIO',
                    'target_value' => 2.0,
                    'warning_threshold' => 1.5,
                ],
            ],
        ]);
        $batchResponse->assertStatus(Response::HTTP_FORBIDDEN);

        $resetResponse = $this->postJson('/api/v1/finance/benchmarks/reset');
        $resetResponse->assertStatus(Response::HTTP_FORBIDDEN);
    }

    public function test_advisor_can_view_and_update_benchmark_for_assigned_company(): void
    {
        Sanctum::actingAs($this->advisorUser);

        $payload = [
            'company_id' => $this->targetCompany->id,
            'target_value' => 2.2,
            'warning_threshold' => 1.6,
            'critical_threshold' => 1.1,
            'description' => 'Zaostrzony cel płynności bieżącej',
        ];

        $response = $this->putJson('/api/v1/finance/benchmarks/CURRENT_RATIO', $payload);

        $response->assertStatus(Response::HTTP_OK)
            ->assertJson([
                'status' => 'success',
                'company_id' => $this->targetCompany->id,
                'data' => [
                    'metric_type' => 'CURRENT_RATIO',
                    'target_value' => 2.2,
                    'warning_threshold' => 1.6,
                    'critical_threshold' => 1.1,
                    'is_custom' => true,
                    'description' => 'Zaostrzony cel płynności bieżącej',
                ],
            ]);

        $this->assertDatabaseHas('financial_benchmarks', [
            'company_id' => $this->targetCompany->id,
            'metric_type' => 'CURRENT_RATIO',
            'target_value' => 2.2,
            'warning_threshold' => 1.6,
            'critical_threshold' => 1.1,
            'description' => 'Zaostrzony cel płynności bieżącej',
            'updated_by' => $this->advisorUser->id,
        ]);
    }

    public function test_advisor_cannot_update_benchmark_for_unassigned_company(): void
    {
        Sanctum::actingAs($this->advisorUser);

        $payload = [
            'company_id' => $this->otherCompany->id,
            'target_value' => 2.0,
            'warning_threshold' => 1.5,
        ];

        $response = $this->putJson('/api/v1/finance/benchmarks/CURRENT_RATIO', $payload);

        $response->assertStatus(Response::HTTP_FORBIDDEN);
    }

    public function test_admin_can_update_benchmark_for_any_company(): void
    {
        Sanctum::actingAs($this->adminUser);

        $payload = [
            'company_id' => $this->otherCompany->id,
            'target_value' => 0.25,
            'warning_threshold' => 0.15,
            'critical_threshold' => 0.05,
            'description' => 'Docelowa marża EBITDA dla nieprzypisanej spółki',
        ];

        $response = $this->putJson('/api/v1/finance/benchmarks/EBITDA_MARGIN', $payload);

        $response->assertStatus(Response::HTTP_OK)
            ->assertJson([
                'status' => 'success',
                'company_id' => $this->otherCompany->id,
                'data' => [
                    'metric_type' => 'EBITDA_MARGIN',
                    'target_value' => 0.25,
                    'warning_threshold' => 0.15,
                ],
            ]);
    }

    public function test_batch_update_benchmarks(): void
    {
        Sanctum::actingAs($this->advisorUser);

        $payload = [
            'company_id' => $this->targetCompany->id,
            'benchmarks' => [
                [
                    'metric_type' => 'CURRENT_RATIO',
                    'target_value' => 1.8,
                    'warning_threshold' => 1.4,
                    'critical_threshold' => 1.0,
                    'description' => 'Płynność bieżąca Q3',
                ],
                [
                    'metric_type' => 'QUICK_RATIO',
                    'target_value' => 1.2,
                    'warning_threshold' => 0.9,
                    'critical_threshold' => 0.6,
                    'description' => 'Płynność szybka Q3',
                ],
            ],
        ];

        $response = $this->putJson('/api/v1/finance/benchmarks', $payload);

        $response->assertStatus(Response::HTTP_OK)
            ->assertJson([
                'status' => 'success',
                'company_id' => $this->targetCompany->id,
                'count' => 2,
            ]);

        $this->assertDatabaseHas('financial_benchmarks', [
            'company_id' => $this->targetCompany->id,
            'metric_type' => 'CURRENT_RATIO',
            'target_value' => 1.8,
        ]);

        $this->assertDatabaseHas('financial_benchmarks', [
            'company_id' => $this->targetCompany->id,
            'metric_type' => 'QUICK_RATIO',
            'target_value' => 1.2,
        ]);
    }

    public function test_validation_rejects_invalid_threshold_ordering(): void
    {
        Sanctum::actingAs($this->advisorUser);

        // Target (1.0) is lower than warning (1.5) for a higher-is-better metric => invalid
        $payload = [
            'company_id' => $this->targetCompany->id,
            'target_value' => 1.0,
            'warning_threshold' => 1.5,
        ];

        $response = $this->putJson('/api/v1/finance/benchmarks/CURRENT_RATIO', $payload);

        $response->assertStatus(Response::HTTP_UNPROCESSABLE_ENTITY)
            ->assertJson([
                'status' => 'error',
            ]);
    }

    public function test_show_unknown_metric_returns_404(): void
    {
        Sanctum::actingAs($this->advisorUser);

        $response = $this->getJson('/api/v1/finance/benchmarks/UNKNOWN_METRIC_FOO');

        $response->assertStatus(Response::HTTP_NOT_FOUND);
    }

    public function test_reset_benchmarks_restores_defaults(): void
    {
        Sanctum::actingAs($this->advisorUser);

        // First configure custom benchmark
        FinancialBenchmark::create([
            'id' => (string) Str::uuid(),
            'company_id' => $this->targetCompany->id,
            'metric_type' => 'CURRENT_RATIO',
            'target_value' => 2.5,
            'warning_threshold' => 1.8,
            'critical_threshold' => 1.2,
            'higher_is_better' => true,
        ]);

        $this->assertDatabaseHas('financial_benchmarks', [
            'company_id' => $this->targetCompany->id,
            'metric_type' => 'CURRENT_RATIO',
        ]);

        // Reset benchmarks
        $resetResponse = $this->postJson('/api/v1/finance/benchmarks/reset', [
            'company_id' => $this->targetCompany->id,
        ]);

        $resetResponse->assertStatus(Response::HTTP_OK)
            ->assertJson([
                'status' => 'success',
                'company_id' => $this->targetCompany->id,
            ]);

        $this->assertDatabaseMissing('financial_benchmarks', [
            'company_id' => $this->targetCompany->id,
            'metric_type' => 'CURRENT_RATIO',
        ]);
    }
}
