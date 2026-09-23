<?php

declare(strict_types=1);

namespace App\Contexts\InvestmentProject\Domain\ValueObjects;

use App\Contexts\Finance\Domain\ValueObjects\Currency;
use App\Contexts\Finance\Domain\ValueObjects\Money;
use App\Shared\Domain\ValueObject;
use InvalidArgumentException;

final class TaxLossPool implements ValueObject
{
    /**
     * @var array<int, TaxLossVintage>
     */
    private readonly array $vintages;

    /**
     * @param  array<int, TaxLossVintage>  $vintages
     */
    public function __construct(
        private readonly Currency $currency,
        array $vintages = []
    ) {
        $sorted = [];
        foreach ($vintages as $v) {
            if ($v->currency() !== $this->currency) {
                throw new InvalidArgumentException(
                    sprintf(
                        'Currency mismatch: expected %s, vintage has %s.',
                        $this->currency->value,
                        $v->currency()->value
                    )
                );
            }
            $sorted[$v->originYear()] = $v;
        }

        // Keep vintages sorted chronologically by originYear ascending for FIFO settlement
        ksort($sorted);
        $this->vintages = $sorted;
    }

    public static function empty(Currency $currency): self
    {
        return new self($currency, []);
    }

    public function currency(): Currency
    {
        return $this->currency;
    }

    /**
     * @return array<int, TaxLossVintage>
     */
    public function vintages(): array
    {
        return $this->vintages;
    }

    public function vintage(int $originYear): ?TaxLossVintage
    {
        return $this->vintages[$originYear] ?? null;
    }

    /**
     * Adds an incurred loss for a specific tax year to the pool.
     * If a vintage for that year already exists, increases its initial and remaining amount.
     */
    public function addLoss(int $year, Money $amount): self
    {
        if ($amount->currency() !== $this->currency) {
            throw new InvalidArgumentException(
                sprintf('Currency mismatch: pool has %s, amount has %s.', $this->currency->value, $amount->currency()->value)
            );
        }

        if ($amount->isNegative()) {
            throw new InvalidArgumentException('Loss amount to add cannot be negative.');
        }

        if ($amount->isZero()) {
            return $this;
        }

        $vintages = $this->vintages;
        if (isset($vintages[$year])) {
            $existing = $vintages[$year];
            $newInitial = $existing->initialAmount()->add($amount);
            $newRemaining = $existing->remainingAmount()->add($amount);

            $vintages[$year] = new TaxLossVintage(
                originYear: $year,
                initialAmount: $newInitial,
                remainingAmount: $newRemaining,
                settledAmount: $existing->settledAmount(),
                expiryYear: $existing->expiryYear(),
                hasUsedOneOffDeduction: $existing->hasUsedOneOffDeduction()
            );
        } else {
            $vintages[$year] = TaxLossVintage::create($year, $amount);
        }

        return new self($this->currency, $vintages);
    }

    /**
     * Sum of remaining loss across all vintages that have not expired in $currentYear.
     */
    public function closingBalance(int $currentYear): Money
    {
        $sum = Money::zero($this->currency);
        foreach ($this->vintages as $v) {
            if (! $v->isExpired($currentYear)) {
                $sum = $sum->add($v->remainingAmount());
            }
        }

        return $sum;
    }

    /**
     * Sum of remaining loss across all vintages before any expiration in $currentYear.
     */
    public function openingBalance(int $currentYear): Money
    {
        $sum = Money::zero($this->currency);
        foreach ($this->vintages as $v) {
            // Unexpired as of previous year (i.e. expiry year >= currentYear)
            if ($v->expiryYear() >= $currentYear) {
                $sum = $sum->add($v->remainingAmount());
            }
        }

        return $sum;
    }

    public function totalLossIncurred(): Money
    {
        $sum = Money::zero($this->currency);
        foreach ($this->vintages as $v) {
            $sum = $sum->add($v->initialAmount());
        }

        return $sum;
    }

    public function totalLossSettled(): Money
    {
        $sum = Money::zero($this->currency);
        foreach ($this->vintages as $v) {
            $sum = $sum->add($v->settledAmount());
        }

        return $sum;
    }

    /**
     * Settles tax losses against taxable income in $currentYear according to Polish CIT law (art. 7 ust. 5 CIT)
     * using FIFO chronological ordering.
     *
     * Returns an array containing the updated TaxLossPool and the TaxLossSettlementResult.
     *
     * @return array{result: TaxLossSettlementResult, pool: self}
     */
    public function settle(
        int $currentYear,
        Money $taxableIncome,
        TaxLossSettlementMode|string $mode = TaxLossSettlementMode::STANDARD_LOSS_CAP,
        float $annualCapPercent = 50.0,
        ?Money $oneOffCap = null
    ): array {
        if ($taxableIncome->currency() !== $this->currency) {
            throw new InvalidArgumentException('Currency mismatch between pool and taxable income.');
        }

        $enumMode = is_string($mode) ? TaxLossSettlementMode::fromOrDefault($mode) : $mode;

        $updatedVintages = $this->vintages;
        $totalExpired = Money::zero($this->currency);
        $expiredDetails = [];

        // 1. Process 5-year expiration for any vintage that reached expiry before or at $currentYear
        foreach ($updatedVintages as $yearKey => $v) {
            if ($v->isExpired($currentYear)) {
                if ($v->remainingAmount()->isPositive()) {
                    $totalExpired = $totalExpired->add($v->remainingAmount());
                    $expiredDetails[] = [
                        'vintage_year' => $v->originYear(),
                        'expired_amount' => $v->remainingAmount(),
                    ];
                    $updatedVintages[$yearKey] = $v->expire();
                }
            }
        }

        // Opening pool balance for this year (after expiries)
        $openingPool = Money::zero($this->currency);
        foreach ($updatedVintages as $v) {
            if (! $v->isExpired($currentYear)) {
                $openingPool = $openingPool->add($v->remainingAmount());
            }
        }

        $totalDeducted = Money::zero($this->currency);
        $settlementDetails = [];

        // 2. If positive taxable income exists, offset losses via FIFO
        if ($taxableIncome->isPositive() && $openingPool->isPositive()) {
            // Determine capacity ceiling based on settlement mode
            if ($enumMode === TaxLossSettlementMode::EBT_CAP) {
                $ebtCapFactor = (string) round($annualCapPercent / 100.0, 6);
                $maxEbtCap = $taxableIncome->multiply($ebtCapFactor);
                $remainingIncomeCapacity = $maxEbtCap->lessThan($taxableIncome) ? $maxEbtCap : $taxableIncome;
            } else {
                // In STANDARD_LOSS_CAP and ONE_OFF_5M, the deduction cannot exceed current taxable income
                $remainingIncomeCapacity = $taxableIncome;
            }

            foreach ($updatedVintages as $yearKey => $v) {
                if ($remainingIncomeCapacity->isZero()) {
                    break;
                }

                if (! $v->isAvailable($currentYear)) {
                    continue;
                }

                $maxVintageDeductible = $v->maxDeductibleInYear($currentYear, $enumMode, $annualCapPercent, $oneOffCap);
                if ($maxVintageDeductible->isZero()) {
                    continue;
                }

                $toDeduct = $maxVintageDeductible->lessThan($remainingIncomeCapacity)
                    ? $maxVintageDeductible
                    : $remainingIncomeCapacity;

                if ($toDeduct->isPositive()) {
                    // Determine if the one-off option was exercised
                    $standardCap = $v->initialAmount()->multiply((string) round($annualCapPercent / 100.0, 6));
                    $usedOneOff = ($enumMode === TaxLossSettlementMode::ONE_OFF_5M)
                        && ! $v->hasUsedOneOffDeduction()
                        && $toDeduct->greaterThan($standardCap);

                    $vBefore = $v->remainingAmount();
                    $updatedV = $v->settle($toDeduct, $usedOneOff);
                    $updatedVintages[$yearKey] = $updatedV;

                    $totalDeducted = $totalDeducted->add($toDeduct);
                    $remainingIncomeCapacity = $remainingIncomeCapacity->subtract($toDeduct);

                    $settlementDetails[] = [
                        'vintage_year' => $v->originYear(),
                        'deducted' => $toDeduct,
                        'remaining_before' => $vBefore,
                        'remaining_after' => $updatedV->remainingAmount(),
                        'used_one_off' => $usedOneOff,
                    ];
                }
            }
        }

        $taxableIncomeAfterDeduction = $taxableIncome->subtract($totalDeducted);
        if ($taxableIncomeAfterDeduction->isNegative()) {
            $taxableIncomeAfterDeduction = Money::zero($this->currency);
        }

        $closingPool = Money::zero($this->currency);
        foreach ($updatedVintages as $v) {
            if (! $v->isExpired($currentYear)) {
                $closingPool = $closingPool->add($v->remainingAmount());
            }
        }

        $result = new TaxLossSettlementResult(
            year: $currentYear,
            taxableIncomeBeforeDeduction: $taxableIncome,
            lossDeducted: $totalDeducted,
            lossExpired: $totalExpired,
            taxableIncomeAfterDeduction: $taxableIncomeAfterDeduction,
            openingPoolBalance: $openingPool,
            closingPoolBalance: $closingPool,
            settlementMode: $enumMode,
            settlementDetails: $settlementDetails,
            expiredDetails: $expiredDetails
        );

        $newPool = new self($this->currency, $updatedVintages);

        return [
            'result' => $result,
            'pool' => $newPool,
        ];
    }

    /**
     * @param  self  $other
     */
    public function equals(ValueObject $other): bool
    {
        if (! $other instanceof self) {
            return false;
        }

        if ($this->currency !== $other->currency || count($this->vintages) !== count($other->vintages)) {
            return false;
        }

        foreach ($this->vintages as $k => $v) {
            if (! isset($other->vintages[$k]) || ! $v->equals($other->vintages[$k])) {
                return false;
            }
        }

        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'currency' => $this->currency->value,
            'total_loss_incurred' => $this->totalLossIncurred()->amount(),
            'total_loss_settled' => $this->totalLossSettled()->amount(),
            'vintages' => array_map(
                static fn (TaxLossVintage $v): array => $v->toArray(),
                array_values($this->vintages)
            ),
        ];
    }
}
