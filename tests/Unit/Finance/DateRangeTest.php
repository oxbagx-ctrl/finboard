<?php

declare(strict_types=1);

namespace Tests\Unit\Finance;

use App\Contexts\Finance\Domain\Exceptions\InvalidDateRangeException;
use App\Contexts\Finance\Domain\ValueObjects\DateRange;
use DateTimeImmutable;
use InvalidArgumentException;
use PHPUnit\Framework\TestCase;

final class DateRangeTest extends TestCase
{
    public function test_valid_date_range_creation(): void
    {
        $range = DateRange::fromStrings('2026-01-01', '2026-01-31');

        $this->assertSame('2026-01-01 00:00:00', $range->startDate()->format('Y-m-d H:i:s'));
        $this->assertSame('2026-01-31 23:59:59', $range->endDate()->format('Y-m-d H:i:s'));
        $this->assertSame(31, $range->days());
    }

    public function test_start_after_end_throws_exception(): void
    {
        $this->expectException(InvalidDateRangeException::class);
        $this->expectExceptionMessage('must be before or equal');

        DateRange::fromStrings('2026-02-01', '2026-01-01');
    }

    public function test_for_month_factory(): void
    {
        $february2026 = DateRange::forMonth(2026, 2); // 2026 is not a leap year -> 28 days

        $this->assertSame('2026-02-01', $february2026->startDate()->format('Y-m-d'));
        $this->assertSame('2026-02-28', $february2026->endDate()->format('Y-m-d'));
        $this->assertSame(28, $february2026->days());
    }

    public function test_for_quarter_factory(): void
    {
        $q1 = DateRange::forQuarter(2026, 1);
        $this->assertSame('2026-01-01', $q1->startDate()->format('Y-m-d'));
        $this->assertSame('2026-03-31', $q1->endDate()->format('Y-m-d'));

        $q4 = DateRange::forQuarter(2026, 4);
        $this->assertSame('2026-10-01', $q4->startDate()->format('Y-m-d'));
        $this->assertSame('2026-12-31', $q4->endDate()->format('Y-m-d'));
    }

    public function test_invalid_quarter_throws_exception(): void
    {
        $this->expectException(InvalidArgumentException::class);
        DateRange::forQuarter(2026, 5);
    }

    public function test_for_year_factory(): void
    {
        $year2026 = DateRange::forYear(2026);
        $this->assertSame('2026-01-01', $year2026->startDate()->format('Y-m-d'));
        $this->assertSame('2026-12-31', $year2026->endDate()->format('Y-m-d'));
        $this->assertSame(365, $year2026->days());
    }

    public function test_contains_and_overlaps(): void
    {
        $q1 = DateRange::forQuarter(2026, 1);

        $this->assertTrue($q1->contains(new DateTimeImmutable('2026-01-15')));
        $this->assertTrue($q1->contains(new DateTimeImmutable('2026-03-31')));
        $this->assertFalse($q1->contains(new DateTimeImmutable('2026-04-01')));

        $overlapRange = DateRange::fromStrings('2026-03-15', '2026-04-15');
        $disjointRange = DateRange::fromStrings('2026-04-01', '2026-04-30');

        $this->assertTrue($q1->overlaps($overlapRange));
        $this->assertFalse($q1->overlaps($disjointRange));
    }

    public function test_previous_year_and_previous_month(): void
    {
        $march2026 = DateRange::forMonth(2026, 3);
        $prevYear = $march2026->previousYear();
        $this->assertSame('2025-03-01', $prevYear->startDate()->format('Y-m-d'));
        $this->assertSame('2025-03-31', $prevYear->endDate()->format('Y-m-d'));

        $prevMonth = $march2026->previousMonth();
        $this->assertSame('2026-02-01', $prevMonth->startDate()->format('Y-m-d'));
        $this->assertSame('2026-02-28', $prevMonth->endDate()->format('Y-m-d'));

        $fullYear2026 = DateRange::forYear(2026);
        $prevFullYear = $fullYear2026->previousYear();
        $this->assertSame('2025-01-01', $prevFullYear->startDate()->format('Y-m-d'));
        $this->assertSame('2025-12-31', $prevFullYear->endDate()->format('Y-m-d'));
    }
}
