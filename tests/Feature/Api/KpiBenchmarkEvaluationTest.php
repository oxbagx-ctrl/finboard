<?php

declare(strict_types=1);

namespace Tests\Feature\Api;

use App\Models\Company;
use App\Models\FinancialBenchmark;
use App\Models\FinancialRecord;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Symfony\Component\HttpFoundation\Response;
use Tests\TestCase;

final class KpiBenchmarkEvaluationTest extends TestCase
{
    use DatabaseTransactions;

    private User $adminUser;
    private User $advisorUser;
    private User $clientUser;
    private Company $testCompany;
    private Company $otherCompany;

    protected function setUp(): void
    {
        parent::setUp();

        $this->testCompany = Company::create([
            'id' => (string) Str::uuid(),
            'name' => 'Benchmark Test Portfolio S.A.',
            'code' => 'BM_TEST_' . strtoupper(Str::random(5)),
            'tax_id' => 'PL' . random_int(1000000000, 9999999999),
        ]);

        $this->otherCompany = Company::create([
            'id' => (string) Str::uuid(),
            'name' => 'Other Benchmark Corp Sp. z o.o.',
            'code' => 'BM_OTHER_' . strtoupper(Str::random(5)),
            'tax_id' => 'PL' . random_int(1000000000, 9999999999),
        ]);

        $this->adminUser = User::create([
            'id' => (string) Str::uuid(),
            'name' => 'Admin User',
            'email' => 'admin_' . Str::random(6) . '@helvest.com',
            'password' => bcrypt('password123'),
            'role' => 'admin',
            'is_active' => true,
        ]);

        $this->advisorUser = User::create([
            'id' => (string) Str::uuid(),
            'name' => 'Advisor User',
            'email' => 'advisor_' . Str::random(6) . '@helvest.com',
            'password' => bcrypt('password123'),
            'role' => 'advisor',
            'is_active' => true,
        ]);
        $this->advisorUser->assignedCompanies()->attach($this->testCompany->id, [
            'assigned_by' => $this->adminUser->id,
        ]);

        $this->clientUser = User::create([
            'id' => (string) Str::uuid(),
            'name' => 'Client CFO',
            'email' => 'client_' . Str::random(6) . '@testcompany.com',
            'password' => bcrypt('password123'),
            'role' => 'client',
            'company_id' => $this->testCompany->id,
            'is_active' => true,
        ]);

        // Seed basic financial records for testCompany
        $this->seedFinancialData($this->testCompany->id);
    }

    private function seedFinancialData(string $companyId): void
    {
        // Current period: March 2026
        FinancialRecord::create([
            'company_id' => $companyId,
            'category_id' => 'cat-revenue',
            'record_type' => 'revenue',
            'amount' => 100000.00,
            'currency' => 'PLN',
            'record_date' => '2026-03-15',
            'description' => 'Przychody marzec 2026',
        ]);
        FinancialRecord::create([
            'company_id' => $companyId,
            'category_id' => 'cat-cogs',
            'record_type' => 'expense',
            'amount' => 50000.00,
            'currency' => 'PLN',
            'record_date' => '2026-03-15',
            'description' => 'COGS marzec 2026',
        ]);
        FinancialRecord::create([
            'company_id' => $companyId,
            'category_id' => 'cat-opex',
            'record_type' => 'expense',
            'amount' => 20000.00,
            'currency' => 'PLN',
            'record_date' => '2026-03-15',
            'description' => 'OPEX marzec 2026',
        ]);
        FinancialRecord::create([
            'company_id' => $companyId,
            'category_id' => 'cat-cash',
            'record_type' => 'asset',
            'amount' => 200000.00,
            'currency' => 'PLN',
            'record_date' => '2026-03-31',
            'description' => 'Aktywa bieżące marzec 2026',
        ]);
        FinancialRecord::create([
            'company_id' => $companyId,
            'category_id' => 'cat-current-liabilities',
            'record_type' => 'liability',
            'amount' => 100000.00,
            'currency' => 'PLN',
            'record_date' => '2026-03-31',
            'description' => 'Zobowiązania krótkoterminowe marzec 2026',
        ]);

        // Prior period (March 2025) for YoY comparison
        FinancialRecord::create([
            'company_id' => $companyId,
            'category_id' => 'cat-revenue',
            'record_type' => 'revenue',
            'amount' => 80000.00,
            'currency' => 'PLN',
            'record_date' => '2025-03-15',
            'description' => 'Przychody marzec 2025',
        ]);
    }

    public function test_kpi_endpoint_returns_benchmark_evaluations_and_summary_with_default_thresholds(): void
    {
        Sanctum::actingAs($this->clientUser);

        $response = $this->getJson('/api/v1/finance/kpi?start_date=2026-03-01&end_date=2026-03-31');

        $response->assertStatus(Response::HTTP_OK)
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('company_id', $this->testCompany->id)
            ->assertJsonStructure([
                'status',
                'company_id',
                'data' => [
                    'benchmarks' => [
                        'CURRENT_RATIO' => [
                            'metric_type',
                            'label',
                            'actual_value',
                            'target_value',
                            'warning_threshold',
                            'critical_threshold',
                            'higher_is_better',
                            'status',
                            'status_label',
                            'status_color',
                            'unit',
                            'is_optimal',
                            'is_warning',
                            'is_critical',
                            'is_unknown',
                        ],
                        'QUICK_RATIO',
                        'DEBT_TO_ASSETS',
                        'GROSS_MARGIN',
                        'EBITDA_MARGIN',
                        'OPERATING_MARGIN',
                        'NET_MARGIN',
                        'REVENUE_GROWTH',
                    ],
                    'benchmark_summary' => [
                        'total_metrics',
                        'evaluated_count',
                        'optimal_count',
                        'warning_count',
                        'critical_count',
                        'unknown_count',
                        'health_score',
                        'overall_status',
                        'overall_status_label',
                        'overall_status_color',
                    ],
                ],
            ]);

        // Revenue: 100k vs 80k in prior year => +25% growth
        $revenueGrowthBenchmark = $response->json('data.benchmarks.REVENUE_GROWTH');
        $this->assertEquals(25.0, (float) $revenueGrowthBenchmark['actual_value']);
        $this->assertSame('OPT', $revenueGrowthBenchmark['status']);

        // Current ratio: 200k assets / 100k liabilities = 2.0. Default target is 1.5 => OPT
        $currentRatioBenchmark = $response->json('data.benchmarks.CURRENT_RATIO');
        $this->assertEquals(2.0, (float) $currentRatioBenchmark['actual_value']);
        $this->assertSame('OPT', $currentRatioBenchmark['status']);

        // Check health score is computed
        $healthScore = $response->json('data.benchmark_summary.health_score');
        $this->assertNotNull($healthScore);
        $this->assertGreaterThan(0, $healthScore);
    }

    public function test_kpi_evaluation_dynamically_adapts_to_custom_advisor_benchmarks(): void
    {
        Sanctum::actingAs($this->advisorUser);

        // First check with defaults: Current Ratio 2.0 is OPT (target 1.5)
        $initialRes = $this->getJson('/api/v1/finance/kpi?start_date=2026-03-01&end_date=2026-03-31');
        $this->assertSame('OPT', $initialRes->json('data.benchmarks.CURRENT_RATIO.status'));

        // Now advisor configures custom benchmark: target 3.0, warning 1.8, critical 1.2
        FinancialBenchmark::create([
            'id' => (string) Str::uuid(),
            'company_id' => $this->testCompany->id,
            'metric_type' => 'CURRENT_RATIO',
            'target_value' => 3.0,
            'warning_threshold' => 1.8,
            'critical_threshold' => 1.2,
            'higher_is_better' => true,
            'description' => 'Restrykcyjny cel płynności dla procesu M&A',
            'configured_by' => $this->advisorUser->id,
        ]);

        // Current ratio 2.0 is now between target (3.0) and warning (1.8) => WARN!
        $updatedRes = $this->getJson('/api/v1/finance/kpi?start_date=2026-03-01&end_date=2026-03-31');
        $updatedRes->assertStatus(Response::HTTP_OK);

        $benchmarkData = $updatedRes->json('data.benchmarks.CURRENT_RATIO');
        $this->assertSame('WARN', $benchmarkData['status']);
        $this->assertSame('amber', $benchmarkData['status_color']);
        $this->assertTrue($benchmarkData['is_warning']);
        $this->assertFalse($benchmarkData['is_optimal']);
        $this->assertSame('Restrykcyjny cel płynności dla procesu M&A', $benchmarkData['description']);
    }

    public function test_kpi_evaluation_isolation_between_companies(): void
    {
        Sanctum::actingAs($this->adminUser);

        // Set custom target on testCompany
        FinancialBenchmark::create([
            'id' => (string) Str::uuid(),
            'company_id' => $this->testCompany->id,
            'metric_type' => 'CURRENT_RATIO',
            'target_value' => 5.0,
            'warning_threshold' => 4.0,
            'critical_threshold' => 3.0,
            'higher_is_better' => true,
        ]);

        // Query testCompany
        $resA = $this->getJson('/api/v1/finance/kpi?company_id=' . $this->testCompany->id);
        $resA->assertStatus(Response::HTTP_OK);
        $this->assertEquals(5.0, (float) $resA->json('data.benchmarks.CURRENT_RATIO.target_value'));

        // Query otherCompany
        $resB = $this->getJson('/api/v1/finance/kpi?company_id=' . $this->otherCompany->id);
        $resB->assertStatus(Response::HTTP_OK);
        // Default target is 1.5, not 5.0
        $this->assertEquals(1.5, (float) $resB->json('data.benchmarks.CURRENT_RATIO.target_value'));
    }

    public function test_analytics_metrics_endpoint_also_includes_benchmark_evaluations(): void
    {
        Sanctum::actingAs($this->clientUser);

        $response = $this->getJson('/api/v1/finance/analytics/metrics?start_date=2026-03-01&end_date=2026-03-31');

        $response->assertStatus(Response::HTTP_OK)
            ->assertJsonStructure([
                'data' => [
                    'benchmarks',
                    'benchmark_summary',
                ],
            ]);

        $this->assertNotNull($response->json('data.benchmark_summary.health_score'));
    }
}
