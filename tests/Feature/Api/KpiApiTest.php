<?php

declare(strict_types=1);

namespace Tests\Feature\Api;

use App\Models\Company;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

final class KpiApiTest extends TestCase
{
    use DatabaseTransactions;

    private User $adminUser;
    private User $clientUser;
    private Company $acmeCompany;
    private Company $helvestCompany;

    protected function setUp(): void
    {
        parent::setUp();

        $this->helvestCompany = Company::firstOrCreate(
            ['code' => 'HELVEST'],
            ['name' => 'Helvest Advisory Sp. z o.o.', 'tax_id' => 'PL5252525252']
        );

        $this->acmeCompany = Company::firstOrCreate(
            ['code' => 'ACME'],
            ['name' => 'Acme Manufacturing S.A.', 'tax_id' => 'PL7010101010']
        );

        $this->adminUser = User::firstOrCreate(
            ['email' => 'admin@helvest.com'],
            [
                'name' => 'Admin Helvest',
                'password' => bcrypt('password123'),
                'role' => 'admin',
                'company_id' => $this->helvestCompany->id,
                'is_active' => true,
            ]
        );

        $this->clientUser = User::firstOrCreate(
            ['email' => 'klient@acme.com'],
            [
                'name' => 'Jan Kowalski (CFO Acme)',
                'password' => bcrypt('password123'),
                'role' => 'client',
                'company_id' => $this->acmeCompany->id,
                'is_active' => true,
            ]
        );
    }

    public function test_unauthenticated_kpi_request_is_rejected(): void
    {
        $response = $this->getJson('/api/v1/finance/kpi');
        $response->assertStatus(401);
    }

    public function test_kpi_endpoint_returns_dynamically_calculated_metrics_and_dynamics(): void
    {
        Sanctum::actingAs($this->clientUser);

        $response = $this->getJson('/api/v1/finance/kpi?start_date=2026-03-01&end_date=2026-03-31');

        $response->assertStatus(200)
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('company_id', $this->acmeCompany->id)
            ->assertJsonStructure([
                'status',
                'company_id',
                'data' => [
                    'period' => ['start', 'end', 'label'],
                    'pnl' => [
                        'revenue',
                        'cogs',
                        'gross_profit',
                        'gross_margin_pct',
                        'opex',
                        'ebitda',
                        'ebitda_margin_pct',
                        'ebit',
                        'operating_margin_pct',
                        'net_profit',
                        'net_margin_pct',
                    ],
                    'balance_sheet',
                    'ratios' => [
                        'current_ratio',
                        'quick_ratio',
                        'debt_to_assets',
                    ],
                    'dynamics' => [
                        'yoy' => [
                            'revenue_growth_pct',
                            'gross_profit_growth_pct',
                            'gross_margin_diff_pct',
                            'ebitda_growth_pct',
                            'ebitda_margin_diff_pct',
                            'ebit_growth_pct',
                            'operating_margin_diff_pct',
                            'net_profit_growth_pct',
                            'net_margin_diff_pct',
                            'opex_growth_pct',
                            'current_ratio_diff',
                            'quick_ratio_diff',
                            'debt_to_assets_diff',
                        ],
                        'mom' => [
                            'revenue_growth_pct',
                            'gross_profit_growth_pct',
                            'ebitda_growth_pct',
                            'net_profit_growth_pct',
                            'opex_growth_pct',
                        ],
                    ],
                    'previous_year',
                    'previous_month',
                ],
            ]);

        $this->assertGreaterThan(0, (float) $response->json('data.pnl.revenue.amount'));
    }

    public function test_analytics_metrics_route_also_returns_enriched_dynamics(): void
    {
        Sanctum::actingAs($this->clientUser);

        $response = $this->getJson('/api/v1/finance/analytics/metrics?start_date=2026-03-01&end_date=2026-03-31');

        $response->assertStatus(200)
            ->assertJsonPath('status', 'success')
            ->assertJsonStructure([
                'data' => [
                    'dynamics' => [
                        'yoy',
                        'mom',
                    ],
                ],
            ]);
    }

    public function test_admin_can_query_kpis_for_another_company_with_company_id_param(): void
    {
        Sanctum::actingAs($this->adminUser);

        $response = $this->getJson('/api/v1/finance/kpi?company_id=' . $this->acmeCompany->id . '&start_date=2026-01-01&end_date=2026-03-31');

        $response->assertStatus(200)
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('company_id', $this->acmeCompany->id);
    }

    public function test_client_cannot_query_kpis_for_another_company(): void
    {
        Sanctum::actingAs($this->clientUser);

        $response = $this->getJson('/api/v1/finance/kpi?company_id=' . $this->helvestCompany->id);

        $response->assertStatus(403);
    }
}
