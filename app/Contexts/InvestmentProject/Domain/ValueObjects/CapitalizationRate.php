<?php

declare(strict_types=1);

namespace App\Contexts\InvestmentProject\Domain\ValueObjects;

use App\Contexts\Finance\Domain\ValueObjects\Money;
use App\Shared\Domain\ValueObject;
use InvalidArgumentException;

final class CapitalizationRate implements ValueObject
{
    private float $percentage;

    public function __construct(float $percentage)
    {
        if ($percentage <= 0.0 || $percentage > 50.0) {
            throw new InvalidArgumentException(
                sprintf('Capitalization rate must be strictly positive and at most 50.0%%, %.4f%% given.', $percentage)
            );
        }

        $this->percentage = round($percentage, 4);
    }

    public static function fromPercentage(float $percentage): self
    {
        return new self($percentage);
    }

    public static function fromDecimal(float $decimal): self
    {
        return new self($decimal * 100.0);
    }

    public function percentage(): float
    {
        return $this->percentage;
    }

    public function toDecimal(): float
    {
        return $this->percentage / 100.0;
    }

    /**
     * Calculate property or asset capitalized value based on Net Operating Income (NOI).
     * Formula: Capitalized Value = NOI / CapRate
     */
    public function capitalizedValue(Money $netOperatingIncome): Money
    {
        return $netOperatingIncome->divide($this->toDecimal());
    }

    public function equals(ValueObject $other): bool
    {
        return $other instanceof self
            && abs($this->percentage - $other->percentage) < 0.0001;
    }

    public function format(): string
    {
        return number_format($this->percentage, 2, ',', ' ') . '%';
    }

    public function __toString(): string
    {
        return $this->format();
    }
}
