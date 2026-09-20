<?php

declare(strict_types=1);

namespace Tests\Feature\Api;

use App\Models\Company;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

final class FinancialAnalyticsApiTest extends TestCase
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

    public function test_unauthenticated_request_is_rejected(): void
    {
        $response = $this->getJson('/api/v1/finance/analytics/metrics');
        $response->assertStatus(401);
    }

    public function test_get_financial_metrics_returns_pnl_and_balance_ratios(): void
    {
        Sanctum::actingAs($this->clientUser);

        $response = $this->getJson('/api/v1/finance/analytics/metrics');

        $response->assertStatus(200)
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('company_id', $this->acmeCompany->id)
            ->assertJsonStructure([
                'status',
                'company_id',
                'data' => [
                    'pnl' => [
                        'revenue' => ['amount', 'formatted'],
                        'cogs' => ['amount', 'formatted'],
                        'gross_profit' => ['amount', 'formatted'],
                        'gross_margin_pct',
                        'opex' => ['amount', 'formatted'],
                        'ebitda' => ['amount', 'formatted'],
                        'ebitda_margin_pct',
                        'net_profit' => ['amount', 'formatted'],
                        'net_margin_pct',
                    ],
                    'balance_sheet' => [
                        'current_assets',
                        'inventory',
                        'quick_assets',
                        'current_liabilities',
                    ],
                    'ratios' => [
                        'current_ratio',
                        'quick_ratio',
                        'debt_to_assets',
                    ],
                    'liquidity' => [
                        'current_ratio',
                        'quick_ratio',
                        'current_assets',
                        'current_liabilities',
                    ],
                    'solvency' => [
                        'debt_to_assets',
                    ],
                ],
            ]);

        $this->assertGreaterThan(0, (float) $response->json('data.pnl.revenue.amount'));
        $this->assertGreaterThan(0, (float) $response->json('data.pnl.ebitda.amount'));
    }

    public function test_get_financial_metrics_with_date_range_filter(): void
    {
        Sanctum::actingAs($this->clientUser);

        $response = $this->getJson('/api/v1/finance/analytics/metrics?start_date=2026-01-01&end_date=2026-03-31');

        $response->assertStatus(200)
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.period.start', '2026-01-01')
            ->assertJsonPath('data.period.end', '2026-03-31');
    }

    public function test_get_monthly_trends_returns_chronological_data_points(): void
    {
        Sanctum::actingAs($this->clientUser);

        $response = $this->getJson('/api/v1/finance/analytics/trends?start_date=2026-01-01&end_date=2026-06-30');

        $response->assertStatus(200)
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('count', 6)
            ->assertJsonStructure([
                'status',
                'company_id',
                'count',
                'data' => [
                    '*' => [
                        'month',
                        'label',
                        'revenue',
                        'cogs',
                        'gross_profit',
                        'opex',
                        'ebitda',
                        'ebit',
                        'net_profit',
                        'gross_margin_percent',
                        'ebitda_margin_percent',
                        'net_margin_percent',
                    ],
                ],
            ]);

        $this->assertSame('2026-01', $response->json('data.0.month'));
        $this->assertSame('Sty 2026', $response->json('data.0.label'));
    }

    public function test_get_category_breakdown_returns_percentage_distribution(): void
    {
        Sanctum::actingAs($this->clientUser);

        $response = $this->getJson('/api/v1/finance/analytics/breakdown?record_type=EXPENSE&start_date=2026-01-01&end_date=2026-03-31');

        $response->assertStatus(200)
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('record_type', 'EXPENSE')
            ->assertJsonStructure([
                'status',
                'company_id',
                'record_type',
                'data' => [
                    '*' => [
                        'category_id',
                        'category_name',
                        'category_code',
                        'amount',
                        'formatted_amount',
                        'percentage',
                    ],
                ],
            ]);

        $data = $response->json('data');
        $this->assertNotEmpty($data);

        $totalPercentage = 0.0;
        foreach ($data as $item) {
            $totalPercentage += $item['percentage'];
        }
        $this->assertEqualsWithDelta(100.0, $totalPercentage, 0.5);
    }

    public function test_get_category_breakdown_revenue_filter_excludes_expense_and_balance_categories(): void
    {
        Sanctum::actingAs($this->clientUser);

        $response = $this->getJson('/api/v1/finance/analytics/breakdown?record_type=REVENUE&start_date=2026-01-01&end_date=2026-03-31');

        $response->assertStatus(200)
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('record_type', 'REVENUE');

        $data = $response->json('data');
        $this->assertNotEmpty($data);

        $categoryIds = array_column($data, 'category_id');
        $this->assertContains('cat-revenue', $categoryIds);

        // Ensure no expense or balance categories exist in the revenue breakdown
        $this->assertNotContains('cat-cogs', $categoryIds);
        $this->assertNotContains('cat-opex-payroll', $categoryIds);
        $this->assertNotContains('cat-cash', $categoryIds);
        $this->assertNotContains('cat-current-liabilities', $categoryIds);

        foreach ($data as $item) {
            $this->assertSame('revenue', $item['category_type']);
        }
    }

    public function test_get_category_breakdown_opex_api_returns_diverse_distribution_instead_of_single_entry(): void
    {
        Sanctum::actingAs($this->clientUser);

        $response = $this->getJson('/api/v1/finance/analytics/breakdown?category_type=OPEX&start_date=2026-01-01&end_date=2026-03-31');

        $response->assertStatus(200)
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('category_type', 'OPEX');

        $data = $response->json('data');
        $this->assertGreaterThanOrEqual(6, count($data));

        $categoryCodes = array_column($data, 'category_code');
        $this->assertContains('PAYROLL', $categoryCodes);
        $this->assertContains('SRV', $categoryCodes);
        $this->assertContains('OFFICE', $categoryCodes);

        foreach ($data as $item) {
            $this->assertLessThan(100.0, $item['percentage']);
            $this->assertGreaterThan(0.0, $item['percentage']);
            $this->assertSame('opex', $item['category_type']);
        }

        $totalPercentage = array_sum(array_column($data, 'percentage'));
        $this->assertEqualsWithDelta(100.0, $totalPercentage, 0.5);
    }

    public function test_get_category_breakdown_with_category_type_opex_filter(): void
    {
        Sanctum::actingAs($this->clientUser);

        $response = $this->getJson('/api/v1/finance/analytics/breakdown?category_type=OPEX&start_date=2026-01-01&end_date=2026-03-31');

        $response->assertStatus(200)
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('record_type', 'EXPENSE')
            ->assertJsonPath('category_type', 'OPEX')
            ->assertJsonStructure([
                'status',
                'company_id',
                'record_type',
                'category_type',
                'data' => [
                    '*' => [
                        'category_id',
                        'category_name',
                        'category_code',
                        'category_type',
                        'amount',
                        'formatted_amount',
                        'percentage',
                    ],
                ],
            ]);

        $data = $response->json('data');
        $this->assertNotEmpty($data);

        $totalPercentage = 0.0;
        foreach ($data as $item) {
            $this->assertSame('opex', $item['category_type']);
            $totalPercentage += $item['percentage'];
        }
        $this->assertEqualsWithDelta(100.0, $totalPercentage, 0.5);
    }

    public function test_get_category_breakdown_with_category_type_cogs_filter(): void
    {
        Sanctum::actingAs($this->clientUser);

        $response = $this->getJson('/api/v1/finance/analytics/breakdown?category_type=cogs&start_date=2026-01-01&end_date=2026-03-31');

        $response->assertStatus(200)
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('category_type', 'COGS');

        $data = $response->json('data');
        $this->assertNotEmpty($data);
        foreach ($data as $item) {
            $this->assertSame('cogs', $item['category_type']);
        }
    }

    public function test_get_liquidity_trends_returns_solvency_ratios(): void
    {
        Sanctum::actingAs($this->clientUser);

        $response = $this->getJson('/api/v1/finance/analytics/liquidity?start_date=2026-01-01&end_date=2026-03-31');

        $response->assertStatus(200)
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('count', 3)
            ->assertJsonStructure([
                'status',
                'company_id',
                'count',
                'data' => [
                    '*' => [
                        'month',
                        'label',
                        'current_ratio',
                        'quick_ratio',
                        'current_assets',
                        'inventory',
                        'quick_assets',
                        'current_liabilities',
                    ],
                ],
            ]);

        $this->assertGreaterThan(1.0, (float) $response->json('data.0.current_ratio'));
        $this->assertGreaterThan(0.5, (float) $response->json('data.0.quick_ratio'));
    }

    public function test_get_available_fiscal_years_returns_years_for_company(): void
    {
        Sanctum::actingAs($this->clientUser);

        $response = $this->getJson('/api/v1/finance/analytics/years');

        $response->assertStatus(200)
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('company_id', $this->acmeCompany->id)
            ->assertJsonStructure([
                'status',
                'company_id',
                'count',
                'data',
            ]);

        $years = $response->json('data');
        $this->assertIsArray($years);
        $this->assertNotEmpty($years);
        $this->assertContains(2026, $years);
    }

    public function test_get_available_fiscal_years_for_empty_company_returns_fallback_current_year(): void
    {
        Sanctum::actingAs($this->adminUser);

        $emptyCompany = Company::create([
            'name' => 'Empty Shell Sp. z o.o.',
            'code' => 'EMPTY',
            'tax_id' => 'PL9999999999',
        ]);

        $response = $this->getJson('/api/v1/finance/analytics/years?company_id=' . $emptyCompany->id);

        $response->assertStatus(200)
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('company_id', $emptyCompany->id)
            ->assertJsonPath('count', 1);

        $currentYear = (int) date('Y');
        $this->assertSame([$currentYear], $response->json('data'));
    }

    public function test_admin_can_query_available_fiscal_years_for_any_company(): void
    {
        Sanctum::actingAs($this->adminUser);

        $response = $this->getJson('/api/v1/finance/analytics/years?company_id=' . $this->acmeCompany->id);

        $response->assertStatus(200)
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('company_id', $this->acmeCompany->id);

        $this->assertNotEmpty($response->json('data'));
    }

    public function test_admin_can_query_metrics_for_any_company(): void
    {
        Sanctum::actingAs($this->adminUser);

        // Admin queries Acme
        $response = $this->getJson('/api/v1/finance/analytics/metrics?company_id=' . $this->acmeCompany->id);

        $response->assertStatus(200)
            ->assertJsonPath('company_id', $this->acmeCompany->id);
    }

    public function test_client_cannot_query_metrics_for_another_company(): void
    {
        Sanctum::actingAs($this->clientUser);

        // Client from Acme tries to query Helvest
        $response = $this->getJson('/api/v1/finance/analytics/metrics?company_id=' . $this->helvestCompany->id);

        $response->assertStatus(403);
    }

    public function test_invalid_date_range_validation(): void
    {
        Sanctum::actingAs($this->clientUser);

        // end_date before start_date
        $response = $this->getJson('/api/v1/finance/analytics/metrics?start_date=2026-06-01&end_date=2026-01-01');

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['end_date']);
    }

    public function test_get_financial_dynamics_returns_yoy_and_mom_calculations(): void
    {
        Sanctum::actingAs($this->clientUser);

        $response = $this->getJson('/api/v1/finance/analytics/dynamics');

        $response->assertStatus(200)
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('company_id', $this->acmeCompany->id)
            ->assertJsonStructure([
                'status',
                'company_id',
                'data' => [
                    'company_id',
                    'metrics',
                    'period',
                    'previous_year_period',
                    'previous_year_metrics',
                    'previous_month_period',
                    'previous_month_metrics',
                    'yoy' => [
                        'revenue_growth_pct',
                        'cogs_growth_pct',
                        'gross_profit_growth_pct',
                        'ebitda_growth_pct',
                        'ebit_growth_pct',
                        'net_profit_growth_pct',
                        'opex_growth_pct',
                        'revenue_diff_amount',
                    ],
                    'mom' => [
                        'revenue_growth_pct',
                        'revenue_diff_amount',
                    ],
                ],
            ]);
    }

    public function test_get_financial_dynamics_with_explicit_date_range(): void
    {
        Sanctum::actingAs($this->clientUser);

        $response = $this->getJson('/api/v1/finance/analytics/dynamics?start_date=2026-01-01&end_date=2026-03-31');

        $response->assertStatus(200)
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.period.start', '2026-01-01')
            ->assertJsonPath('data.period.end', '2026-03-31');
    }

    public function test_admin_can_query_dynamics_for_specific_company(): void
    {
        Sanctum::actingAs($this->adminUser);

        $response = $this->getJson('/api/v1/finance/analytics/dynamics?company_id=' . $this->acmeCompany->id);

        $response->assertStatus(200)
            ->assertJsonPath('company_id', $this->acmeCompany->id);
    }

    public function test_client_cannot_query_dynamics_for_another_company(): void
    {
        Sanctum::actingAs($this->clientUser);

        $response = $this->getJson('/api/v1/finance/analytics/dynamics?company_id=' . $this->helvestCompany->id);

        $response->assertStatus(403);
    }
}
