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
