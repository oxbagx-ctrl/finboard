<?php

declare(strict_types=1);

namespace Tests\Unit\Finance;

use App\Contexts\Finance\Application\Queries\CalculateFinancialDynamics\CalculateFinancialDynamicsHandler;
use App\Contexts\Finance\Application\Queries\CalculateFinancialDynamics\CalculateFinancialDynamicsQuery;
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

final class CalculateFinancialDynamicsHandlerTest extends TestCase
{
    private const COMPANY_ID = '44444444-4444-4444-4444-444444444444';

    private FinancialCalculator $calculator;
    private KpiCalculationService $kpiService;
    private FinancialRecordRepositoryInterface $repositoryMock;
    private CalculateFinancialDynamicsHandler $handler;

    protected function setUp(): void
    {
        parent::setUp();
        $this->calculator = new FinancialCalculator();
        $this->repositoryMock = $this->createMock(FinancialRecordRepositoryInterface::class);
        $this->kpiService = new KpiCalculationService($this->repositoryMock, $this->calculator);
        $this->handler = new CalculateFinancialDynamicsHandler(
            $this->repositoryMock,
            $this->calculator,
            $this->kpiService
        );
    }

    public function test_handler_calculates_dynamics_with_explicit_dates(): void
    {
        $currentRecords = [
            $this->makeRecord(Category::revenue(), '200000.0000', '2026-03-15'),
            $this->makeRecord(Category::cogs(), '80000.0000', '2026-03-15'),
            $this->makeRecord(Category::opex(), '40000.0000', '2026-03-20'),
        ];

        $prevYearRecords = [
            $this->makeRecord(Category::revenue(), '150000.0000', '2025-03-15'),
            $this->makeRecord(Category::cogs(), '60000.0000', '2025-03-15'),
            $this->makeRecord(Category::opex(), '30000.0000', '2025-03-20'),
        ];

        $prevMonthRecords = [
            $this->makeRecord(Category::revenue(), '180000.0000', '2026-02-15'),
            $this->makeRecord(Category::cogs(), '70000.0000', '2026-02-15'),
            $this->makeRecord(Category::opex(), '35000.0000', '2026-02-20'),
        ];

        $this->repositoryMock->expects($this->exactly(3))
            ->method('findByCompanyId')
            ->willReturnCallback(function (string $companyId, ?DateRange $period) use ($currentRecords, $prevYearRecords, $prevMonthRecords): array {
                if ($period === null) {
                    return [];
                }
                $ym = $period->startDate()->format('Y-m');
                if ($ym === '2026-03') {
                    return $currentRecords;
                }
                if ($ym === '2025-03') {
                    return $prevYearRecords;
                }
                if ($ym === '2026-02') {
                    return $prevMonthRecords;
                }
                return [];
            });

        $query = new CalculateFinancialDynamicsQuery(
            companyId: self::COMPANY_ID,
            startDate: '2026-03-01',
            endDate: '2026-03-31',
            currency: 'PLN'
        );

        $result = $this->handler->handle($query);

        $this->assertSame(self::COMPANY_ID, $result->companyId);
        $this->assertTrue($result->hasPreviousYearData());
        $this->assertTrue($result->hasPreviousMonthData());

        // YoY Revenue: (200k - 150k) / 150k = +33.33%
        $this->assertSame(33.33, $result->yoy['revenue_growth_pct']);
        $this->assertSame(50000.0, $result->yoy['revenue_diff_amount']);

        // YoY COGS: (80k - 60k) / 60k = +33.33%
        $this->assertSame(33.33, $result->yoy['cogs_growth_pct']);
        $this->assertSame(20000.0, $result->yoy['cogs_diff_amount']);

        // YoY OPEX: (40k - 30k) / 30k = +33.33%
        $this->assertSame(33.33, $result->yoy['opex_growth_pct']);
        $this->assertSame(10000.0, $result->yoy['opex_diff_amount']);

        // MoM Revenue: (200k - 180k) / 180k = +11.11%
        $this->assertSame(11.11, $result->mom['revenue_growth_pct']);
        $this->assertSame(20000.0, $result->mom['revenue_diff_amount']);

        $array = $result->toArray();
        $this->assertIsArray($array['period']);
        $this->assertSame('2026-03-01', $array['period']['start']);
        $this->assertSame('2026-03-31', $array['period']['end']);
        $this->assertNotNull($array['previous_year_metrics']);
        $this->assertNotNull($array['previous_month_metrics']);
    }

    public function test_handler_calculates_all_pnl_variance_fields_including_ebitda_ebit_and_net_profit(): void
    {
        // 2026-01: Rev: 300k, COGS: 120k -> GP: 180k; OPEX: 60k -> EBITDA: 120k; DEP: 20k -> EBIT: 100k; TAX: 19k -> Net: 81k
        $currentRecords = [
            $this->makeRecord(Category::revenue(), '300000.0000', '2026-01-10'),
            $this->makeRecord(Category::cogs(), '120000.0000', '2026-01-15'),
            $this->makeRecord(Category::opex(), '60000.0000', '2026-01-20'),
            $this->makeRecord(Category::depreciation(), '20000.0000', '2026-01-25'),
            $this->makeRecord(Category::tax(), '19000.0000', '2026-01-28'),
        ];

        // 2025-01: Rev: 200k, COGS: 100k -> GP: 100k; OPEX: 50k -> EBITDA: 50k; DEP: 10k -> EBIT: 40k; TAX: 7.6k -> Net: 32.4k
        $prevYearRecords = [
            $this->makeRecord(Category::revenue(), '200000.0000', '2025-01-10'),
            $this->makeRecord(Category::cogs(), '100000.0000', '2025-01-15'),
            $this->makeRecord(Category::opex(), '50000.0000', '2025-01-20'),
            $this->makeRecord(Category::depreciation(), '10000.0000', '2025-01-25'),
            $this->makeRecord(Category::tax(), '7600.0000', '2025-01-28'),
        ];

        $this->repositoryMock->expects($this->exactly(3))
            ->method('findByCompanyId')
            ->willReturnCallback(function (string $companyId, ?DateRange $period) use ($currentRecords, $prevYearRecords): array {
                if ($period === null) {
                    return [];
                }
                $ym = $period->startDate()->format('Y-m');
                if ($ym === '2026-01') {
                    return $currentRecords;
                }
                if ($ym === '2025-01') {
                    return $prevYearRecords;
                }
                return [];
            });

        $query = new CalculateFinancialDynamicsQuery(
            companyId: self::COMPANY_ID,
            startDate: '2026-01-01',
            endDate: '2026-01-31',
            currency: 'PLN'
        );

        $result = $this->handler->handle($query);

        // GP: Current 180k, Prev 100k -> +80.0%
        $this->assertSame(80.0, $result->yoy['gross_profit_growth_pct']);
        $this->assertSame(80000.0, $result->yoy['gross_profit_diff_amount']);

        // EBITDA: Current 120k, Prev 50k -> +140.0%
        $this->assertSame(140.0, $result->yoy['ebitda_growth_pct']);
        $this->assertSame(70000.0, $result->yoy['ebitda_diff_amount']);

        // EBIT: Current 100k, Prev 40k -> +150.0%
        $this->assertSame(150.0, $result->yoy['ebit_growth_pct']);
        $this->assertSame(60000.0, $result->yoy['ebit_diff_amount']);

        // D&A: Current 20k, Prev 10k -> +100.0%
        $this->assertSame(100.0, $result->yoy['depreciation_growth_pct']);

        // Net Profit: Current 81k, Prev 32.4k -> (81 - 32.4) / 32.4 = +150.0%
        $this->assertSame(150.0, $result->yoy['net_profit_growth_pct']);
        $this->assertSame(48600.0, $result->yoy['net_profit_diff_amount']);
    }

    public function test_handler_calculates_balance_sheet_ratio_variances_when_balance_records_exist(): void
    {
        // 2026-01: Cash: 150k, Rec: 50k, Inv: 40k -> CA = 240k; CL = 120k -> CR = 2.0, QR = 1.6667
        $currentRecords = [
            $this->makeRecord(Category::cash(), '150000.0000', '2026-01-31'),
            $this->makeRecord(Category::receivables(), '50000.0000', '2026-01-31'),
            $this->makeRecord(Category::inventory(), '40000.0000', '2026-01-31'),
            $this->makeRecord(Category::currentLiabilities(), '120000.0000', '2026-01-31'),
        ];

        // 2025-01: Cash: 100k, Rec: 20k, Inv: 30k -> CA = 150k; CL = 100k -> CR = 1.5, QR = 1.2
        $prevYearRecords = [
            $this->makeRecord(Category::cash(), '100000.0000', '2025-01-31'),
            $this->makeRecord(Category::receivables(), '20000.0000', '2025-01-31'),
            $this->makeRecord(Category::inventory(), '30000.0000', '2025-01-31'),
            $this->makeRecord(Category::currentLiabilities(), '100000.0000', '2025-01-31'),
        ];

        $this->repositoryMock->expects($this->exactly(3))
            ->method('findByCompanyId')
            ->willReturnCallback(function (string $companyId, ?DateRange $period) use ($currentRecords, $prevYearRecords): array {
                if ($period === null) {
                    return [];
                }
                $ym = $period->startDate()->format('Y-m');
                if ($ym === '2026-01') {
                    return $currentRecords;
                }
                if ($ym === '2025-01') {
                    return $prevYearRecords;
                }
                return [];
            });

        $query = new CalculateFinancialDynamicsQuery(
            companyId: self::COMPANY_ID,
            startDate: '2026-01-01',
            endDate: '2026-01-31',
            currency: 'PLN'
        );

        $result = $this->handler->handle($query);

        // CR diff: 2.0 - 1.5 = +0.5000
        $this->assertSame(0.5, $result->yoy['current_ratio_diff']);
        // QR diff: 1.6667 - 1.2000 = +0.4667
        $this->assertEqualsWithDelta(0.4667, (float) $result->yoy['quick_ratio_diff'], 0.001);
    }

    public function test_handler_safely_handles_zero_base_in_previous_period(): void
    {
        // 2026-01: Rev: 100k
        $currentRecords = [
            $this->makeRecord(Category::revenue(), '100000.0000', '2026-01-15'),
        ];

        // 2025-01: No revenue, only 0 balance or empty
        $prevYearRecords = [
            $this->makeRecord(Category::cash(), '50000.0000', '2025-01-15'),
        ];

        $this->repositoryMock->expects($this->exactly(3))
            ->method('findByCompanyId')
            ->willReturnCallback(function (string $companyId, ?DateRange $period) use ($currentRecords, $prevYearRecords): array {
                if ($period === null) {
                    return [];
                }
                $ym = $period->startDate()->format('Y-m');
                if ($ym === '2026-01') {
                    return $currentRecords;
                }
                if ($ym === '2025-01') {
                    return $prevYearRecords;
                }
                return [];
            });

        $query = new CalculateFinancialDynamicsQuery(
            companyId: self::COMPANY_ID,
            startDate: '2026-01-01',
            endDate: '2026-01-31',
            currency: 'PLN'
        );

        $result = $this->handler->handle($query);

        // Previous year revenue was 0, so growth pct must be null to avoid division by zero
        $this->assertNull($result->yoy['revenue_growth_pct']);
        // Absolute diff is calculated: 100k - 0 = 100k
        $this->assertSame(100000.0, $result->yoy['revenue_diff_amount']);
    }

    public function test_handler_derives_dynamic_period_when_dates_are_omitted(): void
    {
        $currentRecords = [
            $this->makeRecord(Category::revenue(), '100000.0000', '2026-01-10'),
            $this->makeRecord(Category::revenue(), '150000.0000', '2026-03-25'),
        ];

        $this->repositoryMock->expects($this->exactly(3))
            ->method('findByCompanyId')
            ->willReturnCallback(function (string $companyId, ?DateRange $period) use ($currentRecords): array {
                if ($period === null) {
                    return $currentRecords;
                }
                return [];
            });

        $query = new CalculateFinancialDynamicsQuery(
            companyId: self::COMPANY_ID,
            startDate: null,
            endDate: null,
            currency: 'PLN'
        );

        $result = $this->handler->handle($query);

        $this->assertNotNull($result->period);
        $this->assertSame('2026-01-10', $result->period->startDate()->format('Y-m-d'));
        $this->assertSame('2026-03-25', $result->period->endDate()->format('Y-m-d'));
        $this->assertFalse($result->hasPreviousYearData());
        $this->assertFalse($result->hasPreviousMonthData());
    }

    public function test_handler_gracefully_handles_empty_company_records(): void
    {
        $this->repositoryMock->expects($this->once())
            ->method('findByCompanyId')
            ->with(self::COMPANY_ID, null)
            ->willReturn([]);

        $query = new CalculateFinancialDynamicsQuery(
            companyId: self::COMPANY_ID,
            startDate: null,
            endDate: null,
            currency: 'PLN'
        );

        $result = $this->handler->handle($query);

        $this->assertNull($result->period);
        $this->assertFalse($result->hasPreviousYearData());
        $this->assertFalse($result->hasPreviousMonthData());
        $this->assertNull($result->yoy['revenue_growth_pct']);
        $this->assertNull($result->mom['revenue_growth_pct']);
    }

    private function makeRecord(Category $category, string $amount, string $date): FinancialRecord
    {
        return FinancialRecord::create(
            id: FinancialRecordId::generate(),
            companyId: self::COMPANY_ID,
            category: $category,
            amount: Money::fromDecimal($amount, Currency::PLN),
            recordDate: new DateTimeImmutable($date),
            description: 'Dynamics handler test'
        );
    }
}
