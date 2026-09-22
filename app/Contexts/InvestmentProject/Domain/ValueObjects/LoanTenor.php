<?php

declare(strict_types=1);

namespace App\Contexts\InvestmentProject\Domain\ValueObjects;

use App\Shared\Domain\ValueObject;
use InvalidArgumentException;

final class LoanTenor implements ValueObject
{
    private int $tenorMonths;
    private int $gracePeriodMonths;

    public function __construct(int $tenorMonths, int $gracePeriodMonths = 0)
    {
        if ($tenorMonths <= 0) {
            throw new InvalidArgumentException(
                sprintf('Loan tenor must be greater than zero months, %d given.', $tenorMonths)
            );
        }

        if ($tenorMonths > 360) {
            throw new InvalidArgumentException(
                sprintf('Loan tenor cannot exceed 360 months (30 years), %d given.', $tenorMonths)
            );
        }

        if ($gracePeriodMonths < 0) {
            throw new InvalidArgumentException(
                sprintf('Grace period cannot be negative, %d given.', $gracePeriodMonths)
            );
        }

        if ($gracePeriodMonths >= $tenorMonths) {
            throw new InvalidArgumentException(
                sprintf(
                    'Grace period (%d months) must be strictly less than total loan tenor (%d months).',
                    $gracePeriodMonths,
                    $tenorMonths
                )
            );
        }

        $this->tenorMonths = $tenorMonths;
        $this->gracePeriodMonths = $gracePeriodMonths;
    }

    public static function fromMonths(int $tenorMonths, int $gracePeriodMonths = 0): self
    {
        return new self($tenorMonths, $gracePeriodMonths);
    }

    public static function fromYears(int $tenorYears, int $gracePeriodMonths = 0): self
    {
        return new self($tenorYears * 12, $gracePeriodMonths);
    }

    public function tenorMonths(): int
    {
        return $this->tenorMonths;
    }

    public function gracePeriodMonths(): int
    {
        return $this->gracePeriodMonths;
    }

    public function repaymentMonths(): int
    {
        return $this->tenorMonths - $this->gracePeriodMonths;
    }

    public function tenorYears(): float
    {
        return round($this->tenorMonths / 12.0, 2);
    }

    public function hasGracePeriod(): bool
    {
        return $this->gracePeriodMonths > 0;
    }

    public function equals(ValueObject $other): bool
    {
        return $other instanceof self
            && $this->tenorMonths === $other->tenorMonths
            && $this->gracePeriodMonths === $other->gracePeriodMonths;
    }

    public function __toString(): string
    {
        if ($this->hasGracePeriod()) {
            return sprintf('%d msc (karencja: %d msc)', $this->tenorMonths, $this->gracePeriodMonths);
        }

        return sprintf('%d msc', $this->tenorMonths);
    }
}
