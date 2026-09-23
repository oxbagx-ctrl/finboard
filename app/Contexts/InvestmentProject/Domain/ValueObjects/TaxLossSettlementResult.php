<?php

declare(strict_types=1);

namespace App\Contexts\InvestmentProject\Domain\ValueObjects;

use App\Contexts\Finance\Domain\ValueObjects\Currency;
use App\Contexts\Finance\Domain\ValueObjects\Money;
use App\Shared\Domain\ValueObject;

final class TaxLossSettlementResult implements ValueObject
{
    /**
     * @param  array<int, array{vintage_year: int, deducted: Money, remaining_before: Money, remaining_after: Money, used_one_off: bool}>  $settlementDetails
     * @param  array<int, array{vintage_year: int, expired_amount: Money}>  $expiredDetails
     */
    public function __construct(
        private readonly int $year,
        private readonly Money $taxableIncomeBeforeDeduction,
        private readonly Money $lossDeducted,
        private readonly Money $lossExpired,
        private readonly Money $taxableIncomeAfterDeduction,
        private readonly Money $openingPoolBalance,
        private readonly Money $closingPoolBalance,
        private readonly TaxLossSettlementMode $settlementMode,
        private readonly array $settlementDetails = [],
        private readonly array $expiredDetails = []
    ) {}

    public function year(): int
    {
        return $this->year;
    }

    public function taxableIncomeBeforeDeduction(): Money
    {
        return $this->taxableIncomeBeforeDeduction;
    }

    public function lossDeducted(): Money
    {
        return $this->lossDeducted;
    }

    public function lossExpired(): Money
    {
        return $this->lossExpired;
    }

    public function taxableIncomeAfterDeduction(): Money
    {
        return $this->taxableIncomeAfterDeduction;
    }

    public function openingPoolBalance(): Money
    {
        return $this->openingPoolBalance;
    }

    public function closingPoolBalance(): Money
    {
        return $this->closingPoolBalance;
    }

    public function settlementMode(): TaxLossSettlementMode
    {
        return $this->settlementMode;
    }

    /**
     * @return array<int, array{vintage_year: int, deducted: Money, remaining_before: Money, remaining_after: Money, used_one_off: bool}>
     */
    public function settlementDetails(): array
    {
        return $this->settlementDetails;
    }

    /**
     * @return array<int, array{vintage_year: int, expired_amount: Money}>
     */
    public function expiredDetails(): array
    {
        return $this->expiredDetails;
    }

    public function currency(): Currency
    {
        return $this->taxableIncomeBeforeDeduction->currency();
    }

    /**
     * @param  self  $other
     */
    public function equals(ValueObject $other): bool
    {
        if (! $other instanceof self) {
            return false;
        }

        return $this->year === $other->year
            && $this->settlementMode === $other->settlementMode
            && $this->taxableIncomeBeforeDeduction->equals($other->taxableIncomeBeforeDeduction)
            && $this->lossDeducted->equals($other->lossDeducted)
            && $this->lossExpired->equals($other->lossExpired)
            && $this->taxableIncomeAfterDeduction->equals($other->taxableIncomeAfterDeduction)
            && $this->openingPoolBalance->equals($other->openingPoolBalance)
            && $this->closingPoolBalance->equals($other->closingPoolBalance);
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'year' => $this->year,
            'taxable_income_before_deduction' => $this->taxableIncomeBeforeDeduction->amount(),
            'loss_deducted' => $this->lossDeducted->amount(),
            'loss_expired' => $this->lossExpired->amount(),
            'taxable_income_after_deduction' => $this->taxableIncomeAfterDeduction->amount(),
            'opening_pool_balance' => $this->openingPoolBalance->amount(),
            'closing_pool_balance' => $this->closingPoolBalance->amount(),
            'settlement_mode' => $this->settlementMode->value,
            'settlement_details' => array_map(static fn (array $d): array => [
                'vintage_year' => $d['vintage_year'],
                'deducted' => $d['deducted']->amount(),
                'remaining_before' => $d['remaining_before']->amount(),
                'remaining_after' => $d['remaining_after']->amount(),
                'used_one_off' => $d['used_one_off'],
            ], $this->settlementDetails),
            'expired_details' => array_map(static fn (array $d): array => [
                'vintage_year' => $d['vintage_year'],
                'expired_amount' => $d['expired_amount']->amount(),
            ], $this->expiredDetails),
            'currency' => $this->currency()->value,
        ];
    }
}
