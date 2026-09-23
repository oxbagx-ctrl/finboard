<?php

declare(strict_types=1);

namespace App\Contexts\InvestmentProject\Domain\ValueObjects;

use App\Contexts\Finance\Domain\ValueObjects\Currency;
use App\Contexts\Finance\Domain\ValueObjects\Money;
use App\Shared\Domain\ValueObject;
use InvalidArgumentException;

final class TaxLossVintage implements ValueObject
{
    public const MAX_CARRY_FORWARD_YEARS = 5;

    public function __construct(
        private readonly int $originYear,
        private readonly Money $initialAmount,
        private readonly Money $remainingAmount,
        private readonly Money $settledAmount,
        private readonly int $expiryYear,
        private readonly bool $hasUsedOneOffDeduction = false
    ) {
        if ($this->originYear < 1) {
            throw new InvalidArgumentException(
                sprintf('Origin year must be >= 1, %d given.', $this->originYear)
            );
        }

        if ($this->expiryYear !== $this->originYear + self::MAX_CARRY_FORWARD_YEARS) {
            throw new InvalidArgumentException(
                sprintf(
                    'Expiry year must be originYear + %d (%d), %d given.',
                    self::MAX_CARRY_FORWARD_YEARS,
                    $this->originYear + self::MAX_CARRY_FORWARD_YEARS,
                    $this->expiryYear
                )
            );
        }

        if ($this->initialAmount->isNegative()) {
            throw new InvalidArgumentException('Initial loss amount cannot be negative.');
        }

        if ($this->remainingAmount->isNegative()) {
            throw new InvalidArgumentException('Remaining loss amount cannot be negative.');
        }

        if ($this->settledAmount->isNegative()) {
            throw new InvalidArgumentException('Settled loss amount cannot be negative.');
        }
    }

    public static function create(int $originYear, Money $amount): self
    {
        return new self(
            originYear: $originYear,
            initialAmount: $amount,
            remainingAmount: $amount,
            settledAmount: Money::zero($amount->currency()),
            expiryYear: $originYear + self::MAX_CARRY_FORWARD_YEARS,
            hasUsedOneOffDeduction: false
        );
    }

    public function originYear(): int
    {
        return $this->originYear;
    }

    public function initialAmount(): Money
    {
        return $this->initialAmount;
    }

    public function remainingAmount(): Money
    {
        return $this->remainingAmount;
    }

    public function settledAmount(): Money
    {
        return $this->settledAmount;
    }

    public function expiryYear(): int
    {
        return $this->expiryYear;
    }

    public function hasUsedOneOffDeduction(): bool
    {
        return $this->hasUsedOneOffDeduction;
    }

    public function currency(): Currency
    {
        return $this->initialAmount->currency();
    }

    /**
     * Determines whether the loss vintage has expired (beyond the 5-year statutory period).
     * For example, a loss from Year 1 can be deducted in Years 2, 3, 4, 5, 6.
     * In Year 7 (7 > 6), it is permanently expired.
     */
    public function isExpired(int $currentYear): bool
    {
        return $currentYear > $this->expiryYear;
    }

    /**
     * Determines whether the loss vintage is legally available for deduction in the current year.
     * - Must be after the year the loss was incurred ($currentYear > $originYear)
     * - Must not have expired ($currentYear <= $expiryYear)
     * - Must have unutilized remaining loss ($remainingAmount > 0)
     */
    public function isAvailable(int $currentYear): bool
    {
        return $currentYear > $this->originYear
            && $currentYear <= $this->expiryYear
            && $this->remainingAmount->isPositive();
    }

    /**
     * Calculates the maximum deduction allowed from this vintage in the given year,
     * considering statutory caps under art. 7 ust. 5 CIT.
     */
    public function maxDeductibleInYear(
        int $currentYear,
        TaxLossSettlementMode $mode = TaxLossSettlementMode::STANDARD_LOSS_CAP,
        float $annualCapPercent = 50.0,
        ?Money $oneOffCap = null
    ): Money {
        if (! $this->isAvailable($currentYear)) {
            return Money::zero($this->currency());
        }

        // Standard 50% cap of initial loss (art. 7 ust. 5 pkt 1 CIT)
        $standardFactor = (string) round($annualCapPercent / 100.0, 6);
        $standardMax = $this->initialAmount->multiply($standardFactor);

        if ($mode === TaxLossSettlementMode::STANDARD_LOSS_CAP) {
            return $this->remainingAmount->lessThan($standardMax)
                ? $this->remainingAmount
                : $standardMax;
        }

        if ($mode === TaxLossSettlementMode::ONE_OFF_5M) {
            if (! $this->hasUsedOneOffDeduction) {
                // Eligible for one-off up to 5,000,000 PLN (or custom one-off cap)
                $defaultOneOff = new Money('5000000.0000', $this->currency());
                $effectiveOneOffCap = $oneOffCap ?? $defaultOneOff;

                // Under art. 7 ust. 5 pkt 2, the taxpayer can deduct up to 5M, but cannot deduct more than the remaining loss
                return $this->remainingAmount->lessThan($effectiveOneOffCap)
                    ? $this->remainingAmount
                    : $effectiveOneOffCap;
            }

            // Once the one-off option is used for this vintage, remaining amount is capped at 50% of initial loss
            return $this->remainingAmount->lessThan($standardMax)
                ? $this->remainingAmount
                : $standardMax;
        }

        // EBT_CAP mode: The vintage itself is bounded only by its remaining amount;
        // the 50% limit is applied at the overall EBT/profit level by the settlement engine.
        return $this->remainingAmount;
    }

    /**
     * Deducts an amount from this vintage, returning a new updated vintage instance.
     */
    public function settle(Money $amountDeducted, bool $usedOneOff = false): self
    {
        if ($amountDeducted->isNegative()) {
            throw new InvalidArgumentException('Deducted amount cannot be negative.');
        }

        if ($amountDeducted->greaterThan($this->remainingAmount)) {
            throw new InvalidArgumentException(
                sprintf(
                    'Cannot deduct %s from vintage with remaining balance %s.',
                    $amountDeducted->amount(),
                    $this->remainingAmount->amount()
                )
            );
        }

        return new self(
            originYear: $this->originYear,
            initialAmount: $this->initialAmount,
            remainingAmount: $this->remainingAmount->subtract($amountDeducted),
            settledAmount: $this->settledAmount->add($amountDeducted),
            expiryYear: $this->expiryYear,
            hasUsedOneOffDeduction: $this->hasUsedOneOffDeduction || $usedOneOff
        );
    }

    /**
     * Permanently expires any remaining unutilized loss from this vintage.
     */
    public function expire(): self
    {
        return new self(
            originYear: $this->originYear,
            initialAmount: $this->initialAmount,
            remainingAmount: Money::zero($this->currency()),
            settledAmount: $this->settledAmount,
            expiryYear: $this->expiryYear,
            hasUsedOneOffDeduction: $this->hasUsedOneOffDeduction
        );
    }

    /**
     * @param  self  $other
     */
    public function equals(ValueObject $other): bool
    {
        if (! $other instanceof self) {
            return false;
        }

        return $this->originYear === $other->originYear
            && $this->expiryYear === $other->expiryYear
            && $this->hasUsedOneOffDeduction === $other->hasUsedOneOffDeduction
            && $this->initialAmount->equals($other->initialAmount)
            && $this->remainingAmount->equals($other->remainingAmount)
            && $this->settledAmount->equals($other->settledAmount);
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'origin_year' => $this->originYear,
            'initial_amount' => $this->initialAmount->amount(),
            'remaining_amount' => $this->remainingAmount->amount(),
            'settled_amount' => $this->settledAmount->amount(),
            'expiry_year' => $this->expiryYear,
            'has_used_one_off_deduction' => $this->hasUsedOneOffDeduction,
            'currency' => $this->currency()->value,
        ];
    }
}
