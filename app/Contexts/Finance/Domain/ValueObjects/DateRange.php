<?php

declare(strict_types=1);

namespace App\Contexts\Finance\Domain\ValueObjects;

use App\Contexts\Finance\Domain\Exceptions\InvalidDateRangeException;
use App\Shared\Domain\ValueObject;
use DateTimeImmutable;
use InvalidArgumentException;

final class DateRange implements ValueObject
{
    private DateTimeImmutable $startDate;
    private DateTimeImmutable $endDate;

    public function __construct(DateTimeImmutable $startDate, DateTimeImmutable $endDate)
    {
        $start = $startDate->setTime(0, 0, 0);
        $end = $endDate->setTime(23, 59, 59);

        if ($start > $end) {
            throw InvalidDateRangeException::startAfterEnd($startDate, $endDate);
        }

        $this->startDate = $start;
        $this->endDate = $end;
    }

    public static function fromDates(DateTimeImmutable $startDate, DateTimeImmutable $endDate): self
    {
        return new self($startDate, $endDate);
    }

    public static function fromStrings(string $startDate, string $endDate): self
    {
        $start = new DateTimeImmutable($startDate);
        $end = new DateTimeImmutable($endDate);

        return new self($start, $end);
    }

    public static function forMonth(int $year, int $month): self
    {
        if ($month < 1 || $month > 12) {
            throw new InvalidArgumentException(sprintf('Invalid month "%d", expected value between 1 and 12.', $month));
        }

        $start = (new DateTimeImmutable())->setDate($year, $month, 1)->setTime(0, 0, 0);
        $lastDay = (int) $start->format('t');
        $end = (new DateTimeImmutable())->setDate($year, $month, $lastDay)->setTime(23, 59, 59);

        return new self($start, $end);
    }

    public static function forQuarter(int $year, int $quarter): self
    {
        if ($quarter < 1 || $quarter > 4) {
            throw new InvalidArgumentException(sprintf('Invalid quarter "%d", expected value between 1 and 4.', $quarter));
        }

        $startMonth = ($quarter - 1) * 3 + 1;
        $endMonth = $startMonth + 2;

        $start = (new DateTimeImmutable())->setDate($year, $startMonth, 1)->setTime(0, 0, 0);
        $lastDay = (int) (new DateTimeImmutable())->setDate($year, $endMonth, 1)->format('t');
        $end = (new DateTimeImmutable())->setDate($year, $endMonth, $lastDay)->setTime(23, 59, 59);

        return new self($start, $end);
    }

    public static function forYear(int $year): self
    {
        $start = (new DateTimeImmutable())->setDate($year, 1, 1)->setTime(0, 0, 0);
        $end = (new DateTimeImmutable())->setDate($year, 12, 31)->setTime(23, 59, 59);

        return new self($start, $end);
    }

    public function startDate(): DateTimeImmutable
    {
        return $this->startDate;
    }

    public function endDate(): DateTimeImmutable
    {
        return $this->endDate;
    }

    public function days(): int
    {
        $diff = $this->startDate->diff($this->endDate);

        return (int) $diff->days + 1;
    }

    public function contains(DateTimeImmutable $date): bool
    {
        return $date >= $this->startDate && $date <= $this->endDate;
    }

    public function overlaps(self $other): bool
    {
        return $this->startDate <= $other->endDate && $this->endDate >= $other->startDate;
    }

    public function previousYear(): self
    {
        $isFullYear = $this->startDate->format('m-d') === '01-01' && $this->endDate->format('m-d') === '12-31';
        if ($isFullYear) {
            return self::forYear((int) $this->startDate->format('Y') - 1);
        }

        $isFullMonth = ((int) $this->startDate->format('j') === 1) && ((int) $this->endDate->format('j') === (int) $this->startDate->format('t'));
        if ($isFullMonth) {
            $prevYear = (int) $this->startDate->format('Y') - 1;
            $month = (int) $this->startDate->format('m');

            return self::forMonth($prevYear, $month);
        }

        return new self(
            $this->shiftDateYears($this->startDate, -1),
            $this->shiftDateYears($this->endDate, -1)
        );
    }

    public function previousMonth(): self
    {
        $isFullMonth = ((int) $this->startDate->format('j') === 1) && ((int) $this->endDate->format('j') === (int) $this->startDate->format('t'));
        if ($isFullMonth) {
            $firstOfCurrent = $this->startDate->setDate((int) $this->startDate->format('Y'), (int) $this->startDate->format('m'), 1);
            $lastOfPrev = $firstOfCurrent->modify('-1 day');
            $year = (int) $lastOfPrev->format('Y');
            $month = (int) $lastOfPrev->format('m');

            return self::forMonth($year, $month);
        }

        $days = $this->days();
        $newEnd = $this->startDate->modify('-1 day')->setTime(23, 59, 59);
        $newStart = $newEnd->modify(sprintf('-%d days', $days - 1))->setTime(0, 0, 0);

        return new self($newStart, $newEnd);
    }

    public function equals(ValueObject $other): bool
    {
        if (!$other instanceof self) {
            return false;
        }

        return $this->startDate->format('Y-m-d H:i:s') === $other->startDate->format('Y-m-d H:i:s')
            && $this->endDate->format('Y-m-d H:i:s') === $other->endDate->format('Y-m-d H:i:s');
    }

    public function toPeriodString(): string
    {
        return sprintf('%s do %s', $this->startDate->format('Y-m-d'), $this->endDate->format('Y-m-d'));
    }

    public function __toString(): string
    {
        return $this->toPeriodString();
    }

    private function shiftDateYears(DateTimeImmutable $date, int $years): DateTimeImmutable
    {
        $targetYear = (int) $date->format('Y') + $years;
        $month = (int) $date->format('m');
        $day = (int) $date->format('d');

        if ($month === 2 && $day === 29 && !checkdate(2, 29, $targetYear)) {
            $day = 28;
        }

        return $date->setDate($targetYear, $month, $day);
    }
}
