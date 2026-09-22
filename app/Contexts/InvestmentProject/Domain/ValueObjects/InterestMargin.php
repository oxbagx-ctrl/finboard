<?php

declare(strict_types=1);

namespace App\Contexts\InvestmentProject\Domain\ValueObjects;

use App\Shared\Domain\ValueObject;
use InvalidArgumentException;

final class InterestMargin implements ValueObject
{
    private float $percentage;

    public function __construct(float $percentage)
    {
        if ($percentage < 0.0 || $percentage > 50.0) {
            throw new InvalidArgumentException(
                sprintf('Interest margin must be between 0.0%% and 50.0%%, %.4f%% given.', $percentage)
            );
        }

        $this->percentage = round($percentage, 4);
    }

    public static function fromPercentage(float $percentage): self
    {
        return new self($percentage);
    }

    public static function fromBasisPoints(int $bps): self
    {
        return new self($bps / 100.0);
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

    public function toBasisPoints(): int
    {
        return (int) round($this->percentage * 100);
    }

    /**
     * Calculate combined nominal annual rate given a base rate (e.g., WIBOR 3M).
     */
    public function combinedRate(float $baseRatePercentage): float
    {
        if ($baseRatePercentage < 0.0) {
            throw new InvalidArgumentException('Base interest rate cannot be negative.');
        }

        return round($baseRatePercentage + $this->percentage, 4);
    }

    /**
     * Calculate monthly nominal interest rate given a base rate.
     */
    public function monthlyRate(float $baseRatePercentage): float
    {
        return $this->combinedRate($baseRatePercentage) / 100.0 / 12.0;
    }

    public function equals(ValueObject $other): bool
    {
        return $other instanceof self
            && abs($this->percentage - $other->percentage) < 0.00001;
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
