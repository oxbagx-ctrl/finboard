<?php

declare(strict_types=1);

namespace App\Contexts\InvestmentProject\Domain\ValueObjects;

use App\Contexts\Finance\Domain\ValueObjects\Money;
use App\Shared\Domain\ValueObject;
use InvalidArgumentException;

final class ValuationMultiple implements ValueObject
{
    private float $multiple;

    public function __construct(float $multiple)
    {
        if ($multiple <= 0.0 || $multiple > 100.0) {
            throw new InvalidArgumentException(
                sprintf('Valuation multiple must be strictly positive and at most 100.0x, %.2fx given.', $multiple)
            );
        }

        $this->multiple = round($multiple, 2);
    }

    public static function fromFloat(float $multiple): self
    {
        return new self($multiple);
    }

    public function multiple(): float
    {
        return $this->multiple;
    }

    /**
     * Compute Enterprise Value: EV = EBITDA * Multiple
     */
    public function enterpriseValue(Money $ebitda): Money
    {
        return $ebitda->multiply($this->multiple);
    }

    /**
     * Compute Equity Value: Equity = EV - Net Debt
     */
    public function equityValue(Money $ebitda, Money $netDebt): Money
    {
        $ev = $this->enterpriseValue($ebitda);

        return $ev->subtract($netDebt);
    }

    public function equals(ValueObject $other): bool
    {
        return $other instanceof self
            && abs($this->multiple - $other->multiple) < 0.001;
    }

    public function format(): string
    {
        return number_format($this->multiple, 1, ',', ' ') . 'x';
    }

    public function __toString(): string
    {
        return $this->format();
    }
}
