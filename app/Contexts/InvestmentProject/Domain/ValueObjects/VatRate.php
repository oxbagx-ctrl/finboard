<?php

declare(strict_types=1);

namespace App\Contexts\InvestmentProject\Domain\ValueObjects;

use App\Contexts\Finance\Domain\ValueObjects\Money;
use App\Shared\Domain\ValueObject;
use InvalidArgumentException;

final class VatRate implements ValueObject
{
    public const STANDARD_RATE = 23.0;
    public const REDUCED_RATE = 8.0;
    public const ZERO_RATE = 0.0;

    private float $percentage;

    public function __construct(float $percentage)
    {
        if ($percentage < 0.0 || $percentage > 100.0) {
            throw new InvalidArgumentException(
                sprintf('VAT rate must be between 0.0%% and 100.0%%, %.2f%% given.', $percentage)
            );
        }

        $this->percentage = round($percentage, 2);
    }

    public static function standard(): self
    {
        return new self(self::STANDARD_RATE);
    }

    public static function reduced(): self
    {
        return new self(self::REDUCED_RATE);
    }

    public static function zero(): self
    {
        return new self(self::ZERO_RATE);
    }

    public static function fromPercentage(float $percentage): self
    {
        return new self($percentage);
    }

    public function percentage(): float
    {
        return $this->percentage;
    }

    public function toDecimal(): float
    {
        return $this->percentage / 100.0;
    }

    public function code(): string
    {
        return match ((int) round($this->percentage)) {
            23 => 'standard',
            8 => 'reduced',
            0 => 'zero',
            default => 'custom',
        };
    }

    /**
     * Calculate VAT tax amount from a net amount.
     */
    public function calculateVat(Money $net): Money
    {
        return $net->multiply($this->toDecimal());
    }

    /**
     * Calculate gross amount from a net amount (Net + VAT).
     */
    public function calculateGross(Money $net): Money
    {
        return $net->multiply(1.0 + $this->toDecimal());
    }

    /**
     * Extract net amount from a gross amount (Gross / (1 + VAT)).
     */
    public function extractNet(Money $gross): Money
    {
        return $gross->divide(1.0 + $this->toDecimal());
    }

    /**
     * Extract VAT amount contained in a gross amount (Gross - Net).
     */
    public function extractVat(Money $gross): Money
    {
        $net = $this->extractNet($gross);

        return $gross->subtract($net);
    }

    public function equals(ValueObject $other): bool
    {
        return $other instanceof self
            && abs($this->percentage - $other->percentage) < 0.001;
    }

    public function __toString(): string
    {
        return number_format($this->percentage, 0) . '%';
    }
}
