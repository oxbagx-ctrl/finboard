<?php

declare(strict_types=1);

namespace App\Contexts\InvestmentProject\Domain\ValueObjects;

use App\Contexts\Finance\Domain\ValueObjects\Currency;
use App\Contexts\Finance\Domain\ValueObjects\Money;
use App\Shared\Domain\ValueObject;
use InvalidArgumentException;

final class AnnualLiquiditySummary implements ValueObject
{
    public function __construct(
        private readonly int $year,
        private readonly Money $minCashBalanceBeforeBalancing,
        private readonly Money $maxCashDeficit,
        private readonly Money $totalRevolvingDrawdowns,
        private readonly Money $totalRevolvingRepayments,
        private readonly Money $totalRevolvingInterest,
        private readonly Money $closingRevolvingFacilityBalance,
        private readonly Money $closingBalancedCash,
        private readonly Money $maxUnfundedDeficit,
        private readonly int $deficitMonthsCount,
        private readonly bool $hasUnfundedDeficit
    ) {
        if ($this->year < 1) {
            throw new InvalidArgumentException(
                sprintf('Year must be >= 1, %d given.', $this->year)
            );
        }

        if ($this->deficitMonthsCount < 0 || $this->deficitMonthsCount > 12) {
            throw new InvalidArgumentException(
                sprintf('Deficit months count must be between 0 and 12, %d given.', $this->deficitMonthsCount)
            );
        }
    }

    public function year(): int
    {
        return $this->year;
    }

    public function minCashBalanceBeforeBalancing(): Money
    {
        return $this->minCashBalanceBeforeBalancing;
    }

    public function maxCashDeficit(): Money
    {
        return $this->maxCashDeficit;
    }

    public function totalRevolvingDrawdowns(): Money
    {
        return $this->totalRevolvingDrawdowns;
    }

    public function totalRevolvingRepayments(): Money
    {
        return $this->totalRevolvingRepayments;
    }

    public function totalRevolvingInterest(): Money
    {
        return $this->totalRevolvingInterest;
    }

    public function closingRevolvingFacilityBalance(): Money
    {
        return $this->closingRevolvingFacilityBalance;
    }

    public function closingBalancedCash(): Money
    {
        return $this->closingBalancedCash;
    }

    public function maxUnfundedDeficit(): Money
    {
        return $this->maxUnfundedDeficit;
    }

    public function deficitMonthsCount(): int
    {
        return $this->deficitMonthsCount;
    }

    public function hasUnfundedDeficit(): bool
    {
        return $this->hasUnfundedDeficit;
    }

    public function currency(): Currency
    {
        return $this->closingBalancedCash->currency();
    }

    public function equals(ValueObject $other): bool
    {
        if (!$other instanceof self) {
            return false;
        }

        return $this->year === $other->year
            && $this->deficitMonthsCount === $other->deficitMonthsCount
            && $this->hasUnfundedDeficit === $other->hasUnfundedDeficit
            && $this->closingRevolvingFacilityBalance->equals($other->closingRevolvingFacilityBalance)
            && $this->closingBalancedCash->equals($other->closingBalancedCash);
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'year' => $this->year,
            'min_cash_balance_before_balancing' => $this->minCashBalanceBeforeBalancing->amount(),
            'max_cash_deficit' => $this->maxCashDeficit->amount(),
            'total_revolving_drawdowns' => $this->totalRevolvingDrawdowns->amount(),
            'total_revolving_repayments' => $this->totalRevolvingRepayments->amount(),
            'total_revolving_interest' => $this->totalRevolvingInterest->amount(),
            'closing_revolving_facility_balance' => $this->closingRevolvingFacilityBalance->amount(),
            'closing_balanced_cash' => $this->closingBalancedCash->amount(),
            'max_unfunded_deficit' => $this->maxUnfundedDeficit->amount(),
            'deficit_months_count' => $this->deficitMonthsCount,
            'has_unfunded_deficit' => $this->hasUnfundedDeficit,
            'currency' => $this->currency()->value,
        ];
    }
}
