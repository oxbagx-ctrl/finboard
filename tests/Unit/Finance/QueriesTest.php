<?php

declare(strict_types=1);

namespace Tests\Unit\Finance;

use App\Contexts\Finance\Application\Queries\GetAvailableFiscalYears\GetAvailableFiscalYearsHandler;
use App\Contexts\Finance\Application\Queries\GetAvailableFiscalYears\GetAvailableFiscalYearsQuery;
use App\Contexts\Finance\Application\Queries\GetCategoryBreakdown\GetCategoryBreakdownHandler;
use App\Contexts\Finance\Application\Queries\GetCategoryBreakdown\GetCategoryBreakdownQuery;
use App\Contexts\Finance\Application\Queries\GetFinancialMetrics\GetFinancialMetricsHandler;
use App\Contexts\Finance\Application\Queries\GetFinancialMetrics\GetFinancialMetricsQuery;
use App\Contexts\Finance\Application\Queries\GetLiquidityTrends\GetLiquidityTrendsHandler;
use App\Contexts\Finance\Application\Queries\GetLiquidityTrends\GetLiquidityTrendsQuery;
use App\Contexts\Finance\Application\Queries\GetMonthlyTrends\GetMonthlyTrendsHandler;
use App\Contexts\Finance\Application\Queries\GetMonthlyTrends\GetMonthlyTrendsQuery;
use App\Contexts\Finance\Domain\Repositories\FinancialRecordRepositoryInterface;
use App\Contexts\Finance\Domain\Services\FinancialCalculator;
use DateTimeImmutable;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

final class QueriesTest extends TestCase
{
    use DatabaseTransactions;

    private const ACME_COMPANY_ID = '22222222-2222-2222-2222-222222222222';
    private FinancialRecordRepositoryInterface $repo;
    private FinancialCalculator $calculator;

    protected function setUp(): void
    {
        parent::setUp();
        $this->repo = $this->app->make(FinancialRecordRepositoryInterface::class);
        $this->calculator = $this->app->make(FinancialCalculator::class);
    }

    public function test_get_financial_metrics_handler(): void
    {
        $handler = new GetFinancialMetricsHandler($this->repo, $this->calculator);

        $query = new GetFinancialMetricsQuery(
            companyId: self::ACME_COMPANY_ID,
            startDate: '2026-01-01',
            endDate: '2026-03-31'
        );

        $metrics = $handler->handle($query);

        $this->assertGreaterThan(0, (float) $metrics->revenue()->amount());
        $this->assertGreaterThan(0, (float) $metrics->cogs()->amount());
        $this->assertGreaterThan(0, (float) $metrics->grossProfit()->amount());
        $this->assertGreaterThan(0, $metrics->grossMargin());
        $this->assertGreaterThan(0, (float) $metrics->ebitda()->amount());
        $this->assertGreaterThan(0, (float) $metrics->netProfit()->amount());
    }

    public function test_get_monthly_trends_handler(): void
    {
        $handler = new GetMonthlyTrendsHandler($this->repo, $this->calculator);

        $query = new GetMonthlyTrendsQuery(
            companyId: self::ACME_COMPANY_ID,
            startDate: '2026-01-01',
            endDate: '2026-06-30'
        );

        $trends = $handler->handle($query);

        $this->assertCount(6, $trends);
        $this->assertSame('2026-01', $trends[0]['month']);
        $this->assertSame('Sty 2026', $trends[0]['label']);
        $this->assertGreaterThan(0, $trends[0]['revenue']);
        $this->assertGreaterThan(0, $trends[0]['gross_profit']);
        $this->assertGreaterThan(0, $trends[0]['ebitda']);
        $this->assertGreaterThan(0, $trends[0]['gross_margin_percent']);
    }

    public function test_get_category_breakdown_handler(): void
    {
        $handler = new GetCategoryBreakdownHandler($this->repo);

        $query = new GetCategoryBreakdownQuery(
            companyId: self::ACME_COMPANY_ID,
            startDate: '2026-01-01',
            endDate: '2026-03-31',
            recordType: 'EXPENSE'
        );

        $breakdown = $handler->handle($query);

        $this->assertNotEmpty($breakdown);
        $totalPercentage = 0.0;
        foreach ($breakdown as $item) {
            $this->assertArrayHasKey('category_id', $item);
            $this->assertArrayHasKey('category_name', $item);
            $this->assertArrayHasKey('category_code', $item);
            $this->assertArrayHasKey('category_type', $item);
            $this->assertArrayHasKey('amount', $item);
            $this->assertArrayHasKey('percentage', $item);
            $this->assertGreaterThan(0, $item['amount']);
            $totalPercentage += $item['percentage'];
        }

        // Percentage total should sum up to approximately 100%
        $this->assertEqualsWithDelta(100.0, $totalPercentage, 0.5);

        // Verify sorted descending
        for ($i = 0; $i < count($breakdown) - 1; $i++) {
            $this->assertGreaterThanOrEqual($breakdown[$i + 1]['amount'], $breakdown[$i]['amount']);
        }
    }

    public function test_get_category_breakdown_handler_strictly_isolates_revenue_from_expense_and_asset_records(): void
    {
        $handler = new GetCategoryBreakdownHandler($this->repo);

        $query = new GetCategoryBreakdownQuery(
            companyId: self::ACME_COMPANY_ID,
            startDate: '2026-01-01',
            endDate: '2026-03-31',
            recordType: 'REVENUE'
        );

        $breakdown = $handler->handle($query);

        $this->assertNotEmpty($breakdown);
        $categoryIds = array_column($breakdown, 'category_id');
        $categoryTypes = array_column($breakdown, 'category_type');

        // Verify only REVENUE categories are present
        foreach ($breakdown as $item) {
            $this->assertSame('revenue', $item['category_type']);
            $this->assertGreaterThan(0, $item['amount']);
        }

        // Verify EXPENSE categories never leak into revenue query
        $this->assertNotContains('cat-cogs', $categoryIds);
        $this->assertNotContains('cat-opex', $categoryIds);
        $this->assertNotContains('cat-opex-payroll', $categoryIds);
        $this->assertNotContains('cat-opex-services', $categoryIds);
        $this->assertNotContains('cat-opex-office', $categoryIds);
        $this->assertNotContains('cat-depreciation', $categoryIds);
        $this->assertNotContains('cat-financial', $categoryIds);
        $this->assertNotContains('cat-tax', $categoryIds);
        $this->assertNotContains('opex', $categoryTypes);
        $this->assertNotContains('cogs', $categoryTypes);

        // Verify ASSET / LIABILITY balance sheet categories never leak into revenue query
        $this->assertNotContains('cat-cash', $categoryIds);
        $this->assertNotContains('cat-receivables', $categoryIds);
        $this->assertNotContains('cat-inventory', $categoryIds);
        $this->assertNotContains('cat-fixed-assets', $categoryIds);
        $this->assertNotContains('cat-current-liabilities', $categoryIds);
        $this->assertNotContains('cat-long-term-liabilities', $categoryIds);
        $this->assertNotContains('asset', $categoryTypes);
        $this->assertNotContains('liability', $categoryTypes);

        $totalPercentage = array_sum(array_column($breakdown, 'percentage'));
        $this->assertEqualsWithDelta(100.0, $totalPercentage, 0.5);
    }

    public function test_get_category_breakdown_handler_strictly_isolates_expense_from_revenue_and_asset_records(): void
    {
        $handler = new GetCategoryBreakdownHandler($this->repo);

        $query = new GetCategoryBreakdownQuery(
            companyId: self::ACME_COMPANY_ID,
            startDate: '2026-01-01',
            endDate: '2026-03-31',
            recordType: 'EXPENSE'
        );

        $breakdown = $handler->handle($query);

        $this->assertNotEmpty($breakdown);
        $categoryIds = array_column($breakdown, 'category_id');
        $categoryTypes = array_column($breakdown, 'category_type');

        // Verify all items are expense categories
        $allowedExpenseTypes = ['opex', 'cogs', 'depreciation', 'financial', 'tax'];
        foreach ($breakdown as $item) {
            $this->assertContains($item['category_type'], $allowedExpenseTypes);
            $this->assertGreaterThan(0, $item['amount']);
        }

        // Verify REVENUE never leaks into expense query
        $this->assertNotContains('cat-revenue', $categoryIds);
        $this->assertNotContains('revenue', $categoryTypes);

        // Verify ASSET / LIABILITY balance sheet records never leak into expense query
        $this->assertNotContains('cat-cash', $categoryIds);
        $this->assertNotContains('cat-receivables', $categoryIds);
        $this->assertNotContains('cat-inventory', $categoryIds);
        $this->assertNotContains('cat-fixed-assets', $categoryIds);
        $this->assertNotContains('cat-current-liabilities', $categoryIds);
        $this->assertNotContains('cat-long-term-liabilities', $categoryIds);
        $this->assertNotContains('asset', $categoryTypes);
        $this->assertNotContains('liability', $categoryTypes);

        $totalPercentage = array_sum(array_column($breakdown, 'percentage'));
        $this->assertEqualsWithDelta(100.0, $totalPercentage, 0.5);
    }

    public function test_get_category_breakdown_handler_strictly_isolates_asset_and_liability_records(): void
    {
        $handler = new GetCategoryBreakdownHandler($this->repo);

        // 1. Query ASSET records
        $assetQuery = new GetCategoryBreakdownQuery(
            companyId: self::ACME_COMPANY_ID,
            startDate: '2026-01-01',
            endDate: '2026-03-31',
            recordType: 'ASSET'
        );
        $assetBreakdown = $handler->handle($assetQuery);

        $this->assertNotEmpty($assetBreakdown);
        $assetCategoryIds = array_column($assetBreakdown, 'category_id');
        $this->assertContains('cat-cash', $assetCategoryIds);
        $this->assertNotContains('cat-revenue', $assetCategoryIds);
        $this->assertNotContains('cat-cogs', $assetCategoryIds);
        $this->assertNotContains('cat-current-liabilities', $assetCategoryIds);

        // 2. Query LIABILITY records
        $liabilityQuery = new GetCategoryBreakdownQuery(
            companyId: self::ACME_COMPANY_ID,
            startDate: '2026-01-01',
            endDate: '2026-03-31',
            recordType: 'LIABILITY'
        );
        $liabilityBreakdown = $handler->handle($liabilityQuery);

        $this->assertNotEmpty($liabilityBreakdown);
        $liabilityCategoryIds = array_column($liabilityBreakdown, 'category_id');
        $this->assertContains('cat-current-liabilities', $liabilityCategoryIds);
        $this->assertNotContains('cat-revenue', $liabilityCategoryIds);
        $this->assertNotContains('cat-cogs', $liabilityCategoryIds);
        $this->assertNotContains('cat-cash', $liabilityCategoryIds);
    }

    public function test_get_category_breakdown_handler_case_insensitive_record_type_matching(): void
    {
        $handler = new GetCategoryBreakdownHandler($this->repo);

        $breakdownUpper = $handler->handle(new GetCategoryBreakdownQuery(
            companyId: self::ACME_COMPANY_ID,
            startDate: '2026-01-01',
            endDate: '2026-03-31',
            recordType: 'REVENUE'
        ));

        $breakdownLower = $handler->handle(new GetCategoryBreakdownQuery(
            companyId: self::ACME_COMPANY_ID,
            startDate: '2026-01-01',
            endDate: '2026-03-31',
            recordType: 'revenue'
        ));

        $breakdownMixed = $handler->handle(new GetCategoryBreakdownQuery(
            companyId: self::ACME_COMPANY_ID,
            startDate: '2026-01-01',
            endDate: '2026-03-31',
            recordType: 'ReVeNuE '
        ));

        $this->assertNotEmpty($breakdownUpper);
        $this->assertSame($breakdownUpper, $breakdownLower);
        $this->assertSame($breakdownUpper, $breakdownMixed);
    }

    public function test_get_category_breakdown_handler_opex_returns_diverse_distribution_instead_of_single_entry(): void
    {
        $handler = new GetCategoryBreakdownHandler($this->repo);

        $query = new GetCategoryBreakdownQuery(
            companyId: self::ACME_COMPANY_ID,
            startDate: '2026-01-01',
            endDate: '2026-03-31',
            recordType: 'EXPENSE',
            categoryType: 'OPEX'
        );

        $breakdown = $handler->handle($query);

        // Verify there are multiple categories (at least 6 granular subcategories)
        $this->assertGreaterThanOrEqual(6, count($breakdown));

        // Verify no single category occupies 100% of OPEX
        foreach ($breakdown as $item) {
            $this->assertLessThan(100.0, $item['percentage']);
            $this->assertGreaterThan(0.0, $item['percentage']);
            $this->assertSame('opex', $item['category_type']);
        }

        // Verify all 6 granular categories exist in the breakdown
        $categoryIds = array_column($breakdown, 'category_id');
        $this->assertContains('cat-opex-payroll', $categoryIds);
        $this->assertContains('cat-opex-services', $categoryIds);
        $this->assertContains('cat-opex-office', $categoryIds);
        $this->assertContains('cat-opex-software', $categoryIds);
        $this->assertContains('cat-opex-marketing', $categoryIds);
        $this->assertContains('cat-opex-legal', $categoryIds);

        // Sum should equal 100%
        $totalPercentage = array_sum(array_column($breakdown, 'percentage'));
        $this->assertEqualsWithDelta(100.0, $totalPercentage, 0.5);
    }

    public function test_get_category_breakdown_handler_computes_comparative_amounts_and_yoy_dynamics_per_category(): void
    {
        $handler = new GetCategoryBreakdownHandler($this->repo);

        $query = new GetCategoryBreakdownQuery(
            companyId: self::ACME_COMPANY_ID,
            startDate: '2026-01-01',
            endDate: '2026-03-31',
            recordType: 'EXPENSE',
            categoryType: 'OPEX',
            includeYoY: true
        );

        $breakdown = $handler->handle($query);

        $this->assertNotEmpty($breakdown);

        foreach ($breakdown as $item) {
            $this->assertArrayHasKey('previous_amount', $item);
            $this->assertArrayHasKey('formatted_previous_amount', $item);
            $this->assertArrayHasKey('amount_change', $item);
            $this->assertArrayHasKey('formatted_amount_change', $item);
            $this->assertArrayHasKey('yoy_growth_pct', $item);
            $this->assertArrayHasKey('previous_percentage', $item);
            $this->assertArrayHasKey('percentage_point_diff', $item);

            // Since Acme has seeded data in 2025 Q1, previous amounts and YoY should be populated
            $this->assertNotNull($item['previous_amount']);
            $this->assertNotNull($item['yoy_growth_pct']);
            $this->assertGreaterThan(0, $item['previous_amount']);
            // In our seed, 2026 Q1 costs grew by ~15% vs 2025 Q1
            $this->assertEqualsWithDelta(9.52, $item['yoy_growth_pct'], 0.1);
            $this->assertGreaterThan(0, $item['amount_change']);
        }
    }

    public function test_get_category_breakdown_handler_handles_missing_comparative_period_gracefully(): void
    {
        $handler = new GetCategoryBreakdownHandler($this->repo);

        // Query Acme for 2025-01-01 to 2025-03-31 where 2024 has no comparative records
        $query = new GetCategoryBreakdownQuery(
            companyId: self::ACME_COMPANY_ID,
            startDate: '2025-01-01',
            endDate: '2025-03-31',
            recordType: 'EXPENSE',
            includeYoY: true
        );

        $breakdown = $handler->handle($query);

        $this->assertNotEmpty($breakdown);
        foreach ($breakdown as $item) {
            $this->assertNull($item['previous_amount']);
            $this->assertNull($item['formatted_previous_amount']);
            $this->assertNull($item['amount_change']);
            $this->assertNull($item['formatted_amount_change']);
            $this->assertNull($item['yoy_growth_pct']);
            $this->assertNull($item['previous_percentage']);
            $this->assertNull($item['percentage_point_diff']);
            $this->assertGreaterThan(0, $item['amount']);
            $this->assertGreaterThan(0, $item['percentage']);
        }
    }

    public function test_get_category_breakdown_handler_handles_new_category_with_zero_base_gracefully(): void
    {
        // Insert a record for 'cat-opex' (which has 0 records in 2025 comparative period)
        \Illuminate\Support\Facades\DB::table('financial_records')->insert([
            'id' => (string) \Illuminate\Support\Str::uuid(),
            'company_id' => self::ACME_COMPANY_ID,
            'category_id' => 'cat-opex',
            'record_type' => 'EXPENSE',
            'description' => 'New OPEX category expense without 2025 history',
            'amount' => 5000.00,
            'currency' => 'PLN',
            'record_date' => '2026-02-15',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $handler = new GetCategoryBreakdownHandler($this->repo);

        $query = new GetCategoryBreakdownQuery(
            companyId: self::ACME_COMPANY_ID,
            startDate: '2026-01-01',
            endDate: '2026-03-31',
            recordType: 'EXPENSE',
            categoryType: 'OPEX',
            includeYoY: true
        );

        $breakdown = $handler->handle($query);

        $newCategoryItem = null;
        foreach ($breakdown as $item) {
            if ($item['category_id'] === 'cat-opex') {
                $newCategoryItem = $item;
                break;
            }
        }

        $this->assertNotNull($newCategoryItem);
        $this->assertSame(5000.0, $newCategoryItem['amount']);
        $this->assertSame('5 000,00 PLN', $newCategoryItem['formatted_amount']);
        // Previous amount must be 0.0 because comparative period has records for other categories, but 0 for this category
        $this->assertSame(0.0, $newCategoryItem['previous_amount']);
        $this->assertSame('0,00 PLN', $newCategoryItem['formatted_previous_amount']);
        // Growth from zero base is undefined mathematically (null)
        $this->assertNull($newCategoryItem['yoy_growth_pct']);
        $this->assertSame(5000.0, $newCategoryItem['amount_change']);
        $this->assertSame('5 000,00 PLN', $newCategoryItem['formatted_amount_change']);
        $this->assertSame(0.0, $newCategoryItem['previous_percentage']);
        $this->assertSame($newCategoryItem['percentage'], $newCategoryItem['percentage_point_diff']);
    }

    public function test_get_category_breakdown_handler_supports_explicit_custom_comparison_date_range(): void
    {
        $handler = new GetCategoryBreakdownHandler($this->repo);

        // Explicit MoM comparison: Feb 2026 vs Jan 2026
        $query = new GetCategoryBreakdownQuery(
            companyId: self::ACME_COMPANY_ID,
            startDate: '2026-02-01',
            endDate: '2026-02-28',
            recordType: 'EXPENSE',
            categoryType: 'OPEX',
            includeYoY: true,
            comparisonStartDate: '2026-01-01',
            comparisonEndDate: '2026-01-31'
        );

        $breakdown = $handler->handle($query);

        $this->assertNotEmpty($breakdown);
        foreach ($breakdown as $item) {
            $this->assertNotNull($item['previous_amount']);
            $this->assertGreaterThan(0, $item['previous_amount']);
            $this->assertNotNull($item['yoy_growth_pct']);
            $this->assertNotNull($item['amount_change']);
        }

        // PAYROLL in Jan 2026 was 47,895.20 PLN and in Feb 2026 was 48,244.80 PLN
        $payroll = null;
        foreach ($breakdown as $item) {
            if ($item['category_code'] === 'PAYROLL') {
                $payroll = $item;
                break;
            }
        }

        $this->assertNotNull($payroll);
        $this->assertEqualsWithDelta(48244.8, $payroll['amount'], 1.0);
        $this->assertEqualsWithDelta(47895.2, $payroll['previous_amount'], 1.0);
        $this->assertEqualsWithDelta(349.6, $payroll['amount_change'], 1.0);
        $this->assertEqualsWithDelta(0.73, $payroll['yoy_growth_pct'], 0.1);
    }

    public function test_get_category_breakdown_handler_with_include_yoy_disabled_returns_null_comparative_metrics(): void
    {
        $handler = new GetCategoryBreakdownHandler($this->repo);

        $query = new GetCategoryBreakdownQuery(
            companyId: self::ACME_COMPANY_ID,
            startDate: '2026-01-01',
            endDate: '2026-03-31',
            recordType: 'EXPENSE',
            categoryType: 'OPEX',
            includeYoY: false
        );

        $breakdown = $handler->handle($query);

        $this->assertNotEmpty($breakdown);
        foreach ($breakdown as $item) {
            $this->assertNull($item['previous_amount']);
            $this->assertNull($item['formatted_previous_amount']);
            $this->assertNull($item['amount_change']);
            $this->assertNull($item['formatted_amount_change']);
            $this->assertNull($item['yoy_growth_pct']);
            $this->assertNull($item['previous_percentage']);
            $this->assertNull($item['percentage_point_diff']);
            $this->assertGreaterThan(0, $item['amount']);
        }
    }

    public function test_get_category_breakdown_handler_filters_by_single_category_type_opex(): void
    {
        $handler = new GetCategoryBreakdownHandler($this->repo);

        $query = new GetCategoryBreakdownQuery(
            companyId: self::ACME_COMPANY_ID,
            startDate: '2026-01-01',
            endDate: '2026-03-31',
            recordType: 'EXPENSE',
            categoryType: 'OPEX'
        );

        $breakdown = $handler->handle($query);

        $this->assertNotEmpty($breakdown);
        $totalPercentage = 0.0;
        foreach ($breakdown as $item) {
            $this->assertSame('opex', $item['category_type']);
            $this->assertGreaterThan(0, $item['amount']);
            $totalPercentage += $item['percentage'];
        }

        $this->assertEqualsWithDelta(100.0, $totalPercentage, 0.5);
    }

    public function test_get_category_breakdown_handler_filters_by_multiple_category_types(): void
    {
        $handler = new GetCategoryBreakdownHandler($this->repo);

        $query = new GetCategoryBreakdownQuery(
            companyId: self::ACME_COMPANY_ID,
            startDate: '2026-01-01',
            endDate: '2026-03-31',
            recordType: 'EXPENSE',
            categoryType: 'opex,cogs'
        );

        $breakdown = $handler->handle($query);

        $this->assertNotEmpty($breakdown);
        $totalPercentage = 0.0;
        foreach ($breakdown as $item) {
            $this->assertContains($item['category_type'], ['opex', 'cogs']);
            $this->assertGreaterThan(0, $item['amount']);
            $totalPercentage += $item['percentage'];
        }

        $this->assertEqualsWithDelta(100.0, $totalPercentage, 0.5);
    }

    public function test_get_liquidity_trends_handler(): void
    {
        $handler = new GetLiquidityTrendsHandler($this->repo, $this->calculator);

        $query = new GetLiquidityTrendsQuery(
            companyId: self::ACME_COMPANY_ID,
            startDate: '2026-01-01',
            endDate: '2026-03-31'
        );

        $trends = $handler->handle($query);

        $this->assertCount(3, $trends);
        foreach ($trends as $monthTrend) {
            $this->assertNotNull($monthTrend['current_ratio']);
            $this->assertNotNull($monthTrend['quick_ratio']);
            $this->assertGreaterThan(1.0, $monthTrend['current_ratio']);
            $this->assertGreaterThan(0.5, $monthTrend['quick_ratio']);
            $this->assertGreaterThan(0, $monthTrend['current_assets']);
            $this->assertGreaterThan(0, $monthTrend['current_liabilities']);
        }
    }

    public function test_get_available_fiscal_years_handler(): void
    {
        $handler = new GetAvailableFiscalYearsHandler($this->repo);
        $query = new GetAvailableFiscalYearsQuery(self::ACME_COMPANY_ID);

        $years = $handler->handle($query);

        $this->assertNotEmpty($years);
        $this->assertContains(2026, $years);

        // Verify descending
        $expected = $years;
        rsort($expected, SORT_NUMERIC);
        $this->assertSame($expected, $years);
    }

    public function test_get_available_fiscal_years_handler_falls_back_to_current_year_when_empty(): void
    {
        $emptyCompanyId = '00000000-0000-0000-0000-000000000000';
        $handler = new GetAvailableFiscalYearsHandler($this->repo);
        $query = new GetAvailableFiscalYearsQuery($emptyCompanyId);

        $years = $handler->handle($query);

        $currentYear = (int) (new DateTimeImmutable())->format('Y');
        $this->assertSame([$currentYear], $years);
    }
}
