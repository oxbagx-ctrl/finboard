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

final class FinancialEdgeCasesTest extends TestCase
{
    private const COMPANY_ID = '33333333-3333-3333-3333-333333333333';

    private FinancialCalculator $calculator;
    private KpiCalculationService $kpiService;
    private FinancialRecordRepositoryInterface $repositoryMock;

    protected function setUp(): void
    {
        parent::setUp();
        $this->calculator = new FinancialCalculator();
        $this->repositoryMock = $this->createMock(FinancialRecordRepositoryInterface::class);
        $this->kpiService = new KpiCalculationService($this->repositoryMock, $this->calculator);
    }

    public function test_zero_revenue_prevents_division_by_zero_in_margins(): void
    {
        $zeroRevenue = Money::zero(Currency::PLN);
        $profit = Money::fromDecimal('50000.0000', Currency::PLN);

        $this->assertNull(FinancialRecord::calculateGrossMargin($profit, $zeroRevenue));
        $this->assertNull(FinancialRecord::calculateEbitdaMargin($profit, $zeroRevenue));
        $this->assertNull(FinancialRecord::calculateOperatingMargin($profit, $zeroRevenue));
        $this->assertNull(FinancialRecord::calculateNetMargin($profit, $zeroRevenue));

        $negativeRevenue = Money::fromDecimal('-10000.0000', Currency::PLN);
        $this->assertNull(FinancialRecord::calculateMargin($profit, $negativeRevenue));
    }

    public function test_zero_liabilities_and_assets_prevents_division_by_zero_in_ratios(): void
    {
        $cash = Money::fromDecimal('100000.0000', Currency::PLN);
        $zeroLiabilities = Money::zero(Currency::PLN);

        // When current liabilities are 0, liquidity ratios must return null
        $this->assertNull(FinancialRecord::calculateCurrentRatio($cash, $zeroLiabilities));
        $this->assertNull(FinancialRecord::calculateQuickRatio($cash, $zeroLiabilities));

        // When total assets are 0, debt to assets must return null
        $debt = Money::fromDecimal('50000.0000', Currency::PLN);
        $zeroAssets = Money::zero(Currency::PLN);
        $this->assertNull(FinancialRecord::calculateDebtToAssets($debt, $zeroAssets));

        // When debt is 0 and assets > 0, ratio is 0.0
        $this->assertSame(0.0, FinancialRecord::calculateDebtToAssets($zeroLiabilities, $cash));
    }

    public function test_empty_tenant_history_returns_null_dynamics_without_exceptions(): void
    {
        $currentPeriod = DateRange::forMonth(2026, 6);
        $records = [
            $this->makeRecord(Category::revenue(), '50000.0000', '2026-06-15'),
            $this->makeRecord(Category::opex(), '20000.0000', '2026-06-20'),
        ];

        // Newly created company with no historical records
        $dynamics = $this->kpiService->calculateDynamicsFromRecords(
            currentRecords: $records,
            prevYearRecords: [],
            prevMonthRecords: [],
            currency: Currency::PLN,
            currentPeriod: $currentPeriod
        );

        $this->assertNull($dynamics['previous_year_metrics']);
        $this->assertNull($dynamics['previous_month_metrics']);
        $this->assertNull($dynamics['yoy']['revenue_growth_pct']);
        $this->assertNull($dynamics['yoy']['gross_profit_growth_pct']);
        $this->assertNull($dynamics['yoy']['ebitda_growth_pct']);
        $this->assertNull($dynamics['yoy']['net_profit_growth_pct']);
        $this->assertNull($dynamics['yoy']['current_ratio_diff']);
        $this->assertNull($dynamics['mom']['revenue_growth_pct']);
    }

    public function test_startup_commercialization_from_zero_revenue_base(): void
    {
        // Startup year 1: 0 revenue, 120k OPEX (R&D)
        $prevYearRecords = [
            $this->makeRecord(Category::opex(), '120000.0000', '2025-05-10'),
        ];

        // Startup year 2: 300k revenue, 180k OPEX
        $currentRecords = [
            $this->makeRecord(Category::revenue(), '300000.0000', '2026-05-10'),
            $this->makeRecord(Category::opex(), '180000.0000', '2026-05-15'),
        ];

        $dynamics = $this->kpiService->calculateDynamicsFromRecords(
            currentRecords: $currentRecords,
            prevYearRecords: $prevYearRecords,
            prevMonthRecords: [],
            currency: Currency::PLN,
            currentPeriod: DateRange::forMonth(2026, 5)
        );

        // Previous revenue was 0 -> growth percentage is undefined (null)
        $this->assertNull($dynamics['yoy']['revenue_growth_pct']);

        // OPEX grew from 120k to 180k -> (180 - 120) / 120 = +50.0%
        $this->assertSame(50.0, $dynamics['yoy']['opex_growth_pct']);
    }

    public function test_profit_and_loss_transition_dynamics_edge_cases(): void
    {
        // 1. Loss to Profit: -200k to +100k
        $loss200k = Money::fromDecimal('-200000.0000', Currency::PLN);
        $profit100k = Money::fromDecimal('100000.0000', Currency::PLN);
        // (100 - (-200)) / |-200| = 300 / 200 = +150.0%
        $this->assertSame(150.0, $this->kpiService->calculateGrowthPercentage($profit100k, $loss200k));

        // 2. Profit to Loss: +100k to -50k
        $loss50k = Money::fromDecimal('-50000.0000', Currency::PLN);
        // (-50 - 100) / 100 = -150 / 100 = -150.0%
        $this->assertSame(-150.0, $this->kpiService->calculateGrowthPercentage($loss50k, $profit100k));

        // 3. Deepening Loss: -50k to -120k
        $loss120k = Money::fromDecimal('-120000.0000', Currency::PLN);
        // (-120 - (-50)) / |-50| = -70 / 50 = -140.0%
        $this->assertSame(-140.0, $this->kpiService->calculateGrowthPercentage($loss120k, $loss50k));

        // 4. Reducing Loss: -100k to -25k
        $loss100k = Money::fromDecimal('-100000.0000', Currency::PLN);
        $loss25k = Money::fromDecimal('-25000.0000', Currency::PLN);
        // (-25 - (-100)) / |-100| = +75 / 100 = +75.0%
        $this->assertSame(75.0, $this->kpiService->calculateGrowthPercentage($loss25k, $loss100k));
    }

    public function test_zero_current_records_after_active_history_represents_complete_decline(): void
    {
        $prevYearRecords = [
            $this->makeRecord(Category::revenue(), '200000.0000', '2025-04-10'),
            $this->makeRecord(Category::cogs(), '100000.0000', '2025-04-12'),
        ];

        // Current period has 0 records (ceased operations or zero activity)
        $dynamics = $this->kpiService->calculateDynamicsFromRecords(
            currentRecords: [],
            prevYearRecords: $prevYearRecords,
            prevMonthRecords: [],
            currency: Currency::PLN,
            currentPeriod: DateRange::forMonth(2026, 4)
        );

        // Revenue dropped from 200k to 0 -> (0 - 200) / 200 = -100.0%
        $this->assertSame(-100.0, $dynamics['yoy']['revenue_growth_pct']);
        // Gross profit dropped from 100k to 0 -> -100.0%
        $this->assertSame(-100.0, $dynamics['yoy']['gross_profit_growth_pct']);
    }

    public function test_extreme_precision_micro_and_macro_values(): void
    {
        // Micro amounts: 0.0001 PLN -> 0.0002 PLN (+100.0%)
        $microBase = Money::fromDecimal('0.0001', Currency::PLN);
        $microCurrent = Money::fromDecimal('0.0002', Currency::PLN);
        $this->assertSame(100.0, $this->kpiService->calculateGrowthPercentage($microCurrent, $microBase));

        // Macro amounts: 999,999,999 PLN -> 1,249,999,998.75 PLN (+25.0%)
        $macroBase = Money::fromDecimal('999999999.0000', Currency::PLN);
        $macroCurrent = Money::fromDecimal('1249999998.7500', Currency::PLN);
        $this->assertSame(25.0, $this->kpiService->calculateGrowthPercentage($macroCurrent, $macroBase));
    }

    public function test_leap_year_boundary_handling(): void
    {
        // February 2024 is a leap year (29 days)
        $leapMonth = DateRange::forMonth(2024, 2);
        $this->assertSame('2024-02-01', $leapMonth->startDate()->format('Y-m-d'));
        $this->assertSame('2024-02-29', $leapMonth->endDate()->format('Y-m-d'));

        // Previous year is 2023 (non-leap year -> 28 days)
        $prevYear = $leapMonth->previousYear();
        $this->assertSame('2023-02-01', $prevYear->startDate()->format('Y-m-d'));
        $this->assertSame('2023-02-28', $prevYear->endDate()->format('Y-m-d'));

        // Custom range spanning leap day: 2024-02-20 to 2024-02-29
        $customLeapRange = DateRange::fromStrings('2024-02-20', '2024-02-29');
        $prevCustom = $customLeapRange->previousYear();
        $this->assertSame('2023-02-20', $prevCustom->startDate()->format('Y-m-d'));
        $this->assertSame('2023-02-28', $prevCustom->endDate()->format('Y-m-d'));
    }

    private function makeRecord(Category $category, string $amount, string $date): FinancialRecord
    {
        return FinancialRecord::create(
            id: FinancialRecordId::generate(),
            companyId: self::COMPANY_ID,
            category: $category,
            amount: Money::fromDecimal($amount, Currency::PLN),
            recordDate: new DateTimeImmutable($date),
            description: 'Edge case test entry'
        );
    }

    public function test_metrics_calculation_and_serialization_with_pnl_only_and_zero_balance(): void
    {
        // Only P&L entries: revenue and OPEX, no cash/receivables/liabilities
        $records = [
            $this->makeRecord(Category::revenue(), "250000.0000", "2026-03-10"),
            $this->makeRecord(Category::opex(), "100000.0000", "2026-03-15"),
        ];

        $metrics = $this->calculator->calculateMetrics($records, Currency::PLN);

        $this->assertNull($metrics->currentRatio());
        $this->assertNull($metrics->quickRatio());
        // Since both debt and assets are zero, debt to assets is null
        $this->assertNull($metrics->debtToAssets());

        $array = $metrics->toArray();
        $this->assertNull($array["ratios"]["current_ratio"]);
        $this->assertNull($array["ratios"]["quick_ratio"]);
        $this->assertNull($array["ratios"]["debt_to_assets"]);
        $this->assertNull($array["liquidity"]["current_ratio"]);
        $this->assertNull($array["liquidity"]["quick_ratio"]);
        $this->assertNull($array["solvency"]["debt_to_assets"]);
    }

    public function test_extreme_debt_to_assets_leverage_above_one(): void
    {
        $records = [
            $this->makeRecord(Category::cash(), "50000.0000", "2026-03-01"),
            $this->makeRecord(Category::currentLiabilities(), "80000.0000", "2026-03-05"),
            $this->makeRecord(Category::longTermLiabilities(), "120000.0000", "2026-03-05"),
        ];

        $metrics = $this->calculator->calculateMetrics($records, Currency::PLN);

        // Assets = 50k, Debt = 200k => Debt to Assets = 200k / 50k = 4.0
        $this->assertSame(4.0, $metrics->debtToAssets());
        $this->assertSame(4.0, $metrics->ratios()["debt_to_assets"]);
        $this->assertSame(4.0, $metrics->solvency()["debt_to_assets"]);
        // Current Ratio: 50k / 80k = 0.625 => rounded to 0.63 in liquidity/ratios
        $this->assertSame(0.625, $metrics->currentRatio());
        $this->assertSame(0.63, $metrics->ratios()["current_ratio"]);
    }
}
