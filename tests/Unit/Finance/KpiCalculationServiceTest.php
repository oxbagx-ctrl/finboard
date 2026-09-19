<?php

declare(strict_types=1);

namespace Tests\Unit\Finance;

use App\Contexts\Finance\Application\Services\KpiCalculationService;
use App\Contexts\Finance\Domain\Entities\Category;
use App\Contexts\Finance\Domain\Model\FinancialRecord;
use App\Contexts\Finance\Domain\Repositories\FinancialRecordRepositoryInterface;
use App\Contexts\Finance\Domain\Services\FinancialCalculator;
use App\Contexts\Finance\Domain\ValueObjects\Currency;
use App\Contexts\Finance\Domain\ValueObjects\DateRange;
use App\Contexts\Finance\Domain\ValueObjects\FinancialRecordId;
use App\Contexts\Finance\Domain\ValueObjects\Money;
use DateTimeImmutable;
use PHPUnit\Framework\TestCase;

final class KpiCalculationServiceTest extends TestCase
{
    private const COMPANY_ID = '22222222-2222-2222-2222-222222222222';

    private FinancialCalculator $calculator;
    private KpiCalculationService $service;
    private FinancialRecordRepositoryInterface $repositoryMock;

    protected function setUp(): void
    {
        parent::setUp();
        $this->calculator = new FinancialCalculator();
        $this->repositoryMock = $this->createMock(FinancialRecordRepositoryInterface::class);
        $this->service = new KpiCalculationService($this->repositoryMock, $this->calculator);
    }

    public function test_calculate_growth_percentage_positive_and_negative(): void
    {
        $prev = Money::fromDecimal('100000.0000', Currency::PLN);
        $currHigher = Money::fromDecimal('125000.0000', Currency::PLN);
        $currLower = Money::fromDecimal('80000.0000', Currency::PLN);

        // +25%
        $this->assertSame(25.0, $this->service->calculateGrowthPercentage($currHigher, $prev));
        // -20%
        $this->assertSame(-20.0, $this->service->calculateGrowthPercentage($currLower, $prev));
    }

    public function test_calculate_growth_percentage_out_of_negative_base(): void
    {
        $prevLoss = Money::fromDecimal('-50000.0000', Currency::PLN);
        $currProfit = Money::fromDecimal('25000.0000', Currency::PLN);

        // Change is +75k on base |-50k| = +150%
        $this->assertSame(150.0, $this->service->calculateGrowthPercentage($currProfit, $prevLoss));
    }

    public function test_calculate_growth_guards_division_by_zero_and_null(): void
    {
        $curr = Money::fromDecimal('100000.0000', Currency::PLN);
        $zero = Money::zero(Currency::PLN);

        $this->assertNull($this->service->calculateGrowthPercentage($curr, null));
        $this->assertNull($this->service->calculateGrowthPercentage(null, $curr));
        $this->assertNull($this->service->calculateGrowthPercentage($curr, $zero));
        $this->assertNull($this->service->calculateGrowthPercentage($zero, $zero));
    }

    public function test_calculate_ratio_difference_and_margin_difference(): void
    {
        $this->assertSame(0.35, $this->service->calculateRatioDifference(2.15, 1.80));
        $this->assertNull($this->service->calculateRatioDifference(2.15, null));
        $this->assertNull($this->service->calculateRatioDifference(null, 1.80));

        // Margin points diff: (0.35 - 0.28) * 100 = 7.00 percentage points
        $this->assertSame(7.0, $this->service->calculateMarginDifference(0.35, 0.28));
        $this->assertNull($this->service->calculateMarginDifference(0.35, null));
    }

    public function test_calculate_dynamics_from_records_with_full_history(): void
    {
        // Current: 2026-03 (Revenue: 200k, COGS: 80k, OPEX: 40k, Cash: 50k, CLIAB: 25k)
        $currentRecords = [
            $this->makeRecord(Category::revenue(), '200000.0000', '2026-03-10'),
            $this->makeRecord(Category::cogs(), '80000.0000', '2026-03-12'),
            $this->makeRecord(Category::opex(), '40000.0000', '2026-03-15'),
            $this->makeRecord(Category::cash(), '50000.0000', '2026-03-15'),
            $this->makeRecord(Category::currentLiabilities(), '25000.0000', '2026-03-15'),
        ];

        // Previous Year: 2025-03 (Revenue: 160k, COGS: 70k, OPEX: 30k, Cash: 40k, CLIAB: 25k)
        $prevYearRecords = [
            $this->makeRecord(Category::revenue(), '160000.0000', '2025-03-10'),
            $this->makeRecord(Category::cogs(), '70000.0000', '2025-03-12'),
            $this->makeRecord(Category::opex(), '30000.0000', '2025-03-15'),
            $this->makeRecord(Category::cash(), '40000.0000', '2025-03-15'),
            $this->makeRecord(Category::currentLiabilities(), '25000.0000', '2025-03-15'),
        ];

        // Previous Month: 2026-02 (Revenue: 180k, COGS: 75k, OPEX: 35k, Cash: 45k, CLIAB: 25k)
        $prevMonthRecords = [
            $this->makeRecord(Category::revenue(), '180000.0000', '2026-02-10'),
            $this->makeRecord(Category::cogs(), '75000.0000', '2026-02-12'),
            $this->makeRecord(Category::opex(), '35000.0000', '2026-02-15'),
            $this->makeRecord(Category::cash(), '45000.0000', '2026-02-15'),
            $this->makeRecord(Category::currentLiabilities(), '25000.0000', '2026-02-15'),
        ];

        $currentPeriod = DateRange::forMonth(2026, 3);
        $result = $this->service->calculateDynamicsFromRecords(
            $currentRecords,
            $prevYearRecords,
            $prevMonthRecords,
            Currency::PLN,
            $currentPeriod
        );

        // Current revenue 200k, prev year 160k -> YoY growth = (200 - 160) / 160 = +25%
        $this->assertSame(25.0, $result['yoy']['revenue_growth_pct']);
        // Gross Profit YoY: current 120k (200 - 80), prev year 90k (160 - 70) -> (120 - 90)/90 = +33.33%
        $this->assertSame(33.33, $result['yoy']['gross_profit_growth_pct']);

        // Revenue MoM: current 200k, prev month 180k -> (200 - 180)/180 = +11.11%
        $this->assertSame(11.11, $result['mom']['revenue_growth_pct']);

        // Current ratio: current = 50k / 25k = 2.0; prev year = 40k / 25k = 1.6 -> diff = +0.40
        $this->assertSame(0.4, $result['yoy']['current_ratio_diff']);

        $this->assertNotNull($result['previous_year_metrics']);
        $this->assertNotNull($result['previous_month_metrics']);
    }

    public function test_calculate_dynamics_with_missing_historical_records(): void
    {
        $currentRecords = [
            $this->makeRecord(Category::revenue(), '150000.0000', '2026-01-10'),
            $this->makeRecord(Category::cogs(), '60000.0000', '2026-01-12'),
        ];

        // No previous year, no previous month (e.g. brand new tenant)
        $result = $this->service->calculateDynamicsFromRecords(
            $currentRecords,
            [],
            [],
            Currency::PLN,
            DateRange::forMonth(2026, 1)
        );

        $this->assertNull($result['previous_year_metrics']);
        $this->assertNull($result['previous_month_metrics']);

        $this->assertNull($result['yoy']['revenue_growth_pct']);
        $this->assertNull($result['yoy']['gross_profit_growth_pct']);
        $this->assertNull($result['yoy']['ebitda_growth_pct']);
        $this->assertNull($result['yoy']['current_ratio_diff']);

        $this->assertNull($result['mom']['revenue_growth_pct']);
        $this->assertNull($result['mom']['gross_profit_growth_pct']);
        $this->assertNull($result['mom']['ebitda_growth_pct']);
    }

    public function test_calculate_kpi_dynamics_queries_repository(): void
    {
        $period = DateRange::forMonth(2026, 3);

        $records = [
            $this->makeRecord(Category::revenue(), '100000.0000', '2026-03-01'),
        ];

        $this->repositoryMock->expects($this->exactly(3))
            ->method('findByCompanyId')
            ->willReturnCallback(function (string $companyId, ?DateRange $queryPeriod) use ($records): array {
                if ($queryPeriod !== null && $queryPeriod->startDate()->format('Y-m') === '2026-03') {
                    return $records;
                }
                return [];
            });

        $res = $this->service->calculateKpiDynamics(self::COMPANY_ID, $period, Currency::PLN);

        $this->assertSame(self::COMPANY_ID, $res['company_id']);
        $this->assertSame('2026-03-01', $res['period']['start']);
        $this->assertSame('2026-03-31', $res['period']['end']);
        $this->assertNull($res['yoy']['revenue_growth_pct']);
        $this->assertNull($res['mom']['revenue_growth_pct']);
    }

    private function makeRecord(Category $category, string $amount, string $date): FinancialRecord
    {
        return FinancialRecord::create(
            id: FinancialRecordId::generate(),
            companyId: self::COMPANY_ID,
            category: $category,
            amount: Money::fromDecimal($amount, Currency::PLN),
            recordDate: new DateTimeImmutable($date),
            description: 'Test entry'
        );
    }
}
