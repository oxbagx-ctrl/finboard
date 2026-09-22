<?php

declare(strict_types=1);

namespace App\Contexts\InvestmentProject\Domain\ValueObjects;

use App\Contexts\Finance\Domain\ValueObjects\Currency;
use App\Contexts\Finance\Domain\ValueObjects\Money;
use App\Shared\Domain\ValueObject;
use DateTimeImmutable;
use InvalidArgumentException;

final class FixedAssetPeriod implements ValueObject
{
    public function __construct(
        private readonly int $periodNumber,
        private readonly int $year,
        private readonly int $monthInYear,
        private readonly DateTimeImmutable $date,
        private readonly Money $constructionInProgressOpening,
        private readonly Money $capexIncurred,
        private readonly Money $capitalizedAmount,
        private readonly Money $constructionInProgressClosing,
        private readonly Money $grossBookValueOpening,
        private readonly Money $grossBookValueAdditions,
        private readonly Money $grossBookValueClosing,
        private readonly Money $accumulatedDepreciationOpening,
        private readonly Money $depreciationCharge,
        private readonly Money $accumulatedDepreciationClosing,
        private readonly Money $netBookValueClosing
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

    public function constructionInProgressOpening(): Money
    {
        return $this->constructionInProgressOpening;
    }

    public function capexIncurred(): Money
    {
        return $this->capexIncurred;
    }

    public function capitalizedAmount(): Money
    {
        return $this->capitalizedAmount;
    }

    public function constructionInProgressClosing(): Money
    {
        return $this->constructionInProgressClosing;
    }

    public function grossBookValueOpening(): Money
    {
        return $this->grossBookValueOpening;
    }

    public function grossBookValueAdditions(): Money
    {
        return $this->grossBookValueAdditions;
    }

    public function grossBookValueClosing(): Money
    {
        return $this->grossBookValueClosing;
    }

    public function accumulatedDepreciationOpening(): Money
    {
        return $this->accumulatedDepreciationOpening;
    }

    public function depreciationCharge(): Money
    {
        return $this->depreciationCharge;
    }

    public function accumulatedDepreciationClosing(): Money
    {
        return $this->accumulatedDepreciationClosing;
    }

    public function netBookValueClosing(): Money
    {
        return $this->netBookValueClosing;
    }

    /**
     * Total Property, Plant & Equipment (Środki Trwałe + Środki Trwałe w Budowie) at end of period.
     */
    public function totalFixedAssetsClosing(): Money
    {
        return $this->netBookValueClosing->add($this->constructionInProgressClosing);
    }

    public function currency(): Currency
    {
        return $this->capexIncurred->currency();
    }

    public function equals(ValueObject $other): bool
    {
        if (!$other instanceof self) {
            return false;
        }

        return $this->periodNumber === $other->periodNumber
            && $this->year === $other->year
            && $this->monthInYear === $other->monthInYear
            && $this->capexIncurred->equals($other->capexIncurred)
            && $this->capitalizedAmount->equals($other->capitalizedAmount)
            && $this->depreciationCharge->equals($other->depreciationCharge)
            && $this->netBookValueClosing->equals($other->netBookValueClosing);
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
            'cip_opening' => $this->constructionInProgressOpening->amount(),
            'capex_incurred' => $this->capexIncurred->amount(),
            'capitalized_amount' => $this->capitalizedAmount->amount(),
            'cip_closing' => $this->constructionInProgressClosing->amount(),
            'gross_book_value_opening' => $this->grossBookValueOpening->amount(),
            'gross_book_value_additions' => $this->grossBookValueAdditions->amount(),
            'gross_book_value_closing' => $this->grossBookValueClosing->amount(),
            'accumulated_depreciation_opening' => $this->accumulatedDepreciationOpening->amount(),
            'depreciation_charge' => $this->depreciationCharge->amount(),
            'accumulated_depreciation_closing' => $this->accumulatedDepreciationClosing->amount(),
            'net_book_value_closing' => $this->netBookValueClosing->amount(),
            'total_fixed_assets_closing' => $this->totalFixedAssetsClosing()->amount(),
            'currency' => $this->currency()->value,
        ];
    }
}
