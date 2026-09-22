<?php

declare(strict_types=1);

namespace App\Contexts\InvestmentProject\Domain\ValueObjects;

use App\Contexts\Finance\Domain\ValueObjects\Currency;
use App\Contexts\Finance\Domain\ValueObjects\Money;
use App\Shared\Domain\ValueObject;
use DateTimeImmutable;
use InvalidArgumentException;

final class LiquidityPeriod implements ValueObject
{
    public function __construct(
        private readonly int $periodNumber,
        private readonly int $year,
        private readonly int $monthInYear,
        private readonly DateTimeImmutable $date,
        private readonly Money $cashBeforeBalancing,
        private readonly Money $minimumCashBuffer,
        private readonly Money $cashDeficit,
        private readonly Money $excessCash,
        private readonly Money $revolvingFacilityOpening,
        private readonly Money $revolvingDrawdown,
        private readonly Money $revolvingRepayment,
        private readonly Money $revolvingInterest,
        private readonly Money $revolvingFacilityClosing,
        private readonly Money $availableCreditLimit,
        private readonly Money $unfundedDeficit,
        private readonly Money $balancedCashClosing
    ) {
        if ($this->periodNumber < 1) {
            throw new InvalidArgumentException(
                sprintf('Period number must be >= 1, %d given.', $this->periodNumber)
            );
        }

        if ($this->year < 1) {
            throw new InvalidArgumentException(
                sprintf('Year must be >= 1, %d given.', $this->year)
            );
        }

        if ($this->monthInYear < 1 || $this->monthInYear > 12) {
            throw new InvalidArgumentException(
                sprintf('Month in year must be between 1 and 12, %d given.', $this->monthInYear)
            );
        }
    }

    public function periodNumber(): int
    {
        return $this->periodNumber;
    }

    public function year(): int
    {
        return $this->year;
    }

    public function monthInYear(): int
    {
        return $this->monthInYear;
    }

    public function date(): DateTimeImmutable
    {
        return $this->date;
    }

    public function cashBeforeBalancing(): Money
    {
        return $this->cashBeforeBalancing;
    }

    public function minimumCashBuffer(): Money
    {
        return $this->minimumCashBuffer;
    }

    public function cashDeficit(): Money
    {
        return $this->cashDeficit;
    }

    public function excessCash(): Money
    {
        return $this->excessCash;
    }

    public function revolvingFacilityOpening(): Money
    {
        return $this->revolvingFacilityOpening;
    }

    public function revolvingDrawdown(): Money
    {
        return $this->revolvingDrawdown;
    }

    public function revolvingRepayment(): Money
    {
        return $this->revolvingRepayment;
    }

    public function revolvingInterest(): Money
    {
        return $this->revolvingInterest;
    }

    public function revolvingFacilityClosing(): Money
    {
        return $this->revolvingFacilityClosing;
    }

    public function availableCreditLimit(): Money
    {
        return $this->availableCreditLimit;
    }

    public function unfundedDeficit(): Money
    {
        return $this->unfundedDeficit;
    }

    public function balancedCashClosing(): Money
    {
        return $this->balancedCashClosing;
    }

    public function hasDeficit(): bool
    {
        return $this->cashDeficit->isPositive();
    }

    public function hasExcessCash(): bool
    {
        return $this->excessCash->isPositive();
    }

    public function isFacilityUtilized(): bool
    {
        return $this->revolvingFacilityClosing->isPositive();
    }

    public function isLimitExceeded(): bool
    {
        return $this->unfundedDeficit->isPositive();
    }

    public function currency(): Currency
    {
        return $this->cashBeforeBalancing->currency();
    }

    public function equals(ValueObject $other): bool
    {
        if (!$other instanceof self) {
            return false;
        }

        return $this->periodNumber === $other->periodNumber
            && $this->year === $other->year
            && $this->monthInYear === $other->monthInYear
            && $this->cashBeforeBalancing->equals($other->cashBeforeBalancing)
            && $this->revolvingFacilityClosing->equals($other->revolvingFacilityClosing)
            && $this->balancedCashClosing->equals($other->balancedCashClosing);
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'period_number' => $this->periodNumber,
            'year' => $this->year,
            'month_in_year' => $this->monthInYear,
            'date' => $this->date->format('Y-m-d'),
            'cash_before_balancing' => $this->cashBeforeBalancing->amount(),
            'minimum_cash_buffer' => $this->minimumCashBuffer->amount(),
            'cash_deficit' => $this->cashDeficit->amount(),
            'excess_cash' => $this->excessCash->amount(),
            'revolving_facility_opening' => $this->revolvingFacilityOpening->amount(),
            'revolving_drawdown' => $this->revolvingDrawdown->amount(),
            'revolving_repayment' => $this->revolvingRepayment->amount(),
            'revolving_interest' => $this->revolvingInterest->amount(),
            'revolving_facility_closing' => $this->revolvingFacilityClosing->amount(),
            'available_credit_limit' => $this->availableCreditLimit->amount(),
            'unfunded_deficit' => $this->unfundedDeficit->amount(),
            'balanced_cash_closing' => $this->balancedCashClosing->amount(),
            'has_deficit' => $this->hasDeficit(),
            'is_facility_utilized' => $this->isFacilityUtilized(),
            'is_limit_exceeded' => $this->isLimitExceeded(),
            'currency' => $this->currency()->value,
        ];
    }
}
