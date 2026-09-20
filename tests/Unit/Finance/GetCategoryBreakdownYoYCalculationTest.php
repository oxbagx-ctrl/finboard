<?php

declare(strict_types=1);

namespace Tests\Unit\Finance;

use App\Contexts\Finance\Application\Queries\GetCategoryBreakdown\GetCategoryBreakdownHandler;
use App\Contexts\Finance\Application\Queries\GetCategoryBreakdown\GetCategoryBreakdownQuery;
use App\Contexts\Finance\Application\Services\KpiCalculationService;
use App\Contexts\Finance\Domain\Entities\Category;
use App\Contexts\Finance\Domain\Model\FinancialRecord;
use App\Contexts\Finance\Domain\Repositories\FinancialRecordRepositoryInterface;
use App\Contexts\Finance\Domain\Services\FinancialCalculator;
use App\Contexts\Finance\Domain\ValueObjects\CategoryType;
use App\Contexts\Finance\Domain\ValueObjects\Currency;
use App\Contexts\Finance\Domain\ValueObjects\DateRange;
use App\Contexts\Finance\Domain\ValueObjects\FinancialRecordId;
use App\Contexts\Finance\Domain\ValueObjects\Money;
use App\Contexts\Finance\Domain\ValueObjects\RecordType;
use DateTimeImmutable;
use PHPUnit\Framework\TestCase;

final class GetCategoryBreakdownYoYCalculationTest extends TestCase
{
    private const COMPANY_ID = '55555555-5555-5555-5555-555555555555';

    private FinancialCalculator $calculator;
    private FinancialRecordRepositoryInterface $repositoryMock;
    private KpiCalculationService $kpiService;
    private GetCategoryBreakdownHandler $handler;

    protected function setUp(): void
    {
        parent::setUp();
        $this->calculator = new FinancialCalculator();
        $this->repositoryMock = $this->createMock(FinancialRecordRepositoryInterface::class);
        $this->kpiService = new KpiCalculationService($this->repositoryMock, $this->calculator);
        $this->handler = new GetCategoryBreakdownHandler(
            $this->repositoryMock,
            $this->kpiService
        );
    }

    public function test_breakdown_derives_dynamic_comparative_period_and_calculates_yoy_when_date_range_is_null(): void
    {
        // Current records spanning 2026-01-01 to 2026-03-31
        $catPayroll = Category::opexPayroll();
        $catSoftware = Category::opexSoftware();

        $currentRecords = [
            $this->makeRecord('rec-c-1', $catPayroll, '50000.0000', '2026-01-05'),
            $this->makeRecord('rec-c-2', $catSoftware, '10000.0000', '2026-03-25'),
        ];

        // Comparative period records (2025-01-01 to 2025-03-25 or matching range)
        $prevRecords = [
            $this->makeRecord('rec-p-1', $catPayroll, '40000.0000', '2025-01-10'),
            $this->makeRecord('rec-p-2', $catSoftware, '8000.0000', '2025-03-10'),
        ];

        $this->repositoryMock->expects($this->exactly(2))
            ->method('findByCompanyId')
            ->willReturnCallback(function (string $companyId, ?DateRange $period) use ($currentRecords, $prevRecords): array {
                if ($period === null) {
                    return $currentRecords;
                }
                if ($period->startDate()->format('Y') === '2025') {
                    return $prevRecords;
                }
                return [];
            });

        $query = new GetCategoryBreakdownQuery(
            companyId: self::COMPANY_ID,
            startDate: null,
            endDate: null,
            recordType: 'EXPENSE',
            categoryType: 'OPEX',
            includeYoY: true
        );

        $result = $this->handler->handle($query);

        $this->assertCount(2, $result);

        $payroll = $result[0]['category_code'] === 'PAYROLL' ? $result[0] : $result[1];
        $software = $result[0]['category_code'] === 'SOFTWARE' ? $result[0] : $result[1];

        // Payroll: 50k current, 40k previous -> +25.0%
        $this->assertSame(50000.0, $payroll['amount']);
        $this->assertSame(40000.0, $payroll['previous_amount']);
        $this->assertSame(10000.0, $payroll['amount_change']);
        $this->assertSame(25.0, $payroll['yoy_growth_pct']);

        // Software: 10k current, 8k previous -> +25.0%
        $this->assertSame(10000.0, $software['amount']);
        $this->assertSame(8000.0, $software['previous_amount']);
        $this->assertSame(2000.0, $software['amount_change']);
        $this->assertSame(25.0, $software['yoy_growth_pct']);
    }

    public function test_breakdown_handles_boundary_leap_year_february_date_ranges(): void
    {
        // 2024 is a leap year (Feb 29). Current period: 2024-02-01 to 2024-02-29
        $catOffice = Category::opexOffice();

        $currentRecords = [
            $this->makeRecord('rec-leap-1', $catOffice, '12000.0000', '2024-02-29'),
        ];

        // Comparative period 2023 (Feb has 28 days)
        $prevRecords = [
            $this->makeRecord('rec-leap-p1', $catOffice, '10000.0000', '2023-02-28'),
        ];

        $this->repositoryMock->expects($this->exactly(2))
            ->method('findByCompanyId')
            ->willReturnCallback(function (string $companyId, ?DateRange $period) use ($currentRecords, $prevRecords): array {
                if ($period !== null && $period->startDate()->format('Y') === '2024') {
                    return $currentRecords;
                }
                if ($period !== null && $period->startDate()->format('Y') === '2023') {
                    return $prevRecords;
                }
                return [];
            });

        $query = new GetCategoryBreakdownQuery(
            companyId: self::COMPANY_ID,
            startDate: '2024-02-01',
            endDate: '2024-02-29',
            recordType: 'EXPENSE',
            categoryType: 'OPEX',
            includeYoY: true
        );

        $result = $this->handler->handle($query);

        $this->assertCount(1, $result);
        $office = $result[0];

        $this->assertSame(12000.0, $office['amount']);
        $this->assertSame(10000.0, $office['previous_amount']);
        $this->assertSame(2000.0, $office['amount_change']);
        $this->assertSame(20.0, $office['yoy_growth_pct']);
    }

    public function test_breakdown_handles_single_day_boundary_query(): void
    {
        $catMarketing = Category::opexMarketing();

        $currentRecords = [
            $this->makeRecord('rec-day-1', $catMarketing, '1500.0000', '2026-06-30'),
        ];

        $prevRecords = [
            $this->makeRecord('rec-day-p1', $catMarketing, '1200.0000', '2025-06-30'),
        ];

        $this->repositoryMock->expects($this->exactly(2))
            ->method('findByCompanyId')
            ->willReturnCallback(function (string $companyId, ?DateRange $period) use ($currentRecords, $prevRecords): array {
                if ($period !== null && $period->startDate()->format('Y') === '2026') {
                    return $currentRecords;
                }
                if ($period !== null && $period->startDate()->format('Y') === '2025') {
                    return $prevRecords;
                }
                return [];
            });

        $query = new GetCategoryBreakdownQuery(
            companyId: self::COMPANY_ID,
            startDate: '2026-06-30',
            endDate: '2026-06-30',
            recordType: 'EXPENSE',
            categoryType: 'OPEX',
            includeYoY: true
        );

        $result = $this->handler->handle($query);

        $this->assertCount(1, $result);
        $item = $result[0];

        $this->assertSame(1500.0, $item['amount']);
        $this->assertSame(1200.0, $item['previous_amount']);
        $this->assertSame(300.0, $item['amount_change']);
        $this->assertSame(25.0, $item['yoy_growth_pct']);
    }

    public function test_breakdown_handles_open_ended_empty_records_without_fatal_error(): void
    {
        $this->repositoryMock->expects($this->once())
            ->method('findByCompanyId')
            ->with(self::COMPANY_ID, null)
            ->willReturn([]);

        $query = new GetCategoryBreakdownQuery(
            companyId: self::COMPANY_ID,
            startDate: null,
            endDate: null,
            recordType: 'EXPENSE',
            includeYoY: true
        );

        $result = $this->handler->handle($query);

        $this->assertSame([], $result);
    }

    private function makeRecord(string $id, Category $category, string $amount, string $date): FinancialRecord
    {
        return FinancialRecord::create(
            id: FinancialRecordId::generate(),
            companyId: self::COMPANY_ID,
            category: $category,
            amount: Money::fromDecimal($amount, Currency::PLN),
            recordDate: new DateTimeImmutable($date),
            description: 'Breakdown unit test record'
        );
    }
}
