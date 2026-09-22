<?php

declare(strict_types=1);

namespace App\Contexts\InvestmentProject\Domain\ValueObjects;

use App\Contexts\Finance\Domain\ValueObjects\Currency;
use App\Contexts\Finance\Domain\ValueObjects\Money;
use App\Shared\Domain\ValueObject;
use InvalidArgumentException;

final class WaterfallAnnualPeriod implements ValueObject
{
    public function __construct(
        private readonly int $year,
        private readonly Money $totalCashAvailable,
        private readonly Money $investor1Distribution,
        private readonly Money $investor2Distribution,
        private readonly bool $isExitYear = false
    ) {
        if ($this->year < 1) {
            throw new InvalidArgumentException(
                sprintf('Year must be >= 1, %d given.', $this->year)
            );
        }
    }

    public function year(): int
    {
        return $this->year;
    }

    public function totalCashAvailable(): Money
    {
        return $this->totalCashAvailable;
    }

    public function investor1Distribution(): Money
    {
        return $this->investor1Distribution;
    }

    public function investor2Distribution(): Money
    {
        return $this->investor2Distribution;
    }

    public function isExitYear(): bool
    {
        return $this->isExitYear;
    }

    public function currency(): Currency
    {
        return $this->totalCashAvailable->currency();
    }

    public function isBalanced(): bool
    {
        $sum = $this->investor1Distribution->add($this->investor2Distribution);

        return $sum->equals($this->totalCashAvailable);
    }

    public function equals(ValueObject $other): bool
    {
        if (!$other instanceof self) {
            return false;
        }

        return $this->year === $other->year
            && $this->totalCashAvailable->equals($other->totalCashAvailable)
            && $this->investor1Distribution->equals($other->investor1Distribution)
            && $this->investor2Distribution->equals($other->investor2Distribution)
            && $this->isExitYear === $other->isExitYear;
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'year' => $this->year,
            'total_cash_available' => $this->totalCashAvailable->amount(),
            'investor1_distribution' => $this->investor1Distribution->amount(),
            'investor2_distribution' => $this->investor2Distribution->amount(),
            'is_exit_year' => $this->isExitYear,
            'is_balanced' => $this->isBalanced(),
            'currency' => $this->currency()->value,
        ];
    }
}
