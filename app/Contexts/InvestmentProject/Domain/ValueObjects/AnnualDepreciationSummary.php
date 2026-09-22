<?php

declare(strict_types=1);

namespace App\Contexts\InvestmentProject\Domain\ValueObjects;

use App\Contexts\Finance\Domain\ValueObjects\Currency;
use App\Contexts\Finance\Domain\ValueObjects\Money;
use App\Shared\Domain\ValueObject;
use InvalidArgumentException;

final class AnnualDepreciationSummary implements ValueObject
{
    public function __construct(
        private readonly int $year,
        private readonly Money $openingNetBookValue,
        private readonly Money $capexIncurred,
        private readonly Money $capitalizedAmount,
        private readonly Money $depreciationExpense,
        private readonly Money $grossBookValueClosing,
        private readonly Money $accumulatedDepreciationClosing,
        private readonly Money $closingNetBookValue,
        private readonly Money $closingConstructionInProgress
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

    public function openingNetBookValue(): Money
    {
        return $this->openingNetBookValue;
    }

    public function capexIncurred(): Money
    {
        return $this->capexIncurred;
    }

    public function capitalizedAmount(): Money
    {
        return $this->capitalizedAmount;
    }

    public function depreciationExpense(): Money
    {
        return $this->depreciationExpense;
    }

    public function grossBookValueClosing(): Money
    {
        return $this->grossBookValueClosing;
    }

    public function accumulatedDepreciationClosing(): Money
    {
        return $this->accumulatedDepreciationClosing;
    }

    public function closingNetBookValue(): Money
    {
        return $this->closingNetBookValue;
    }

    public function closingConstructionInProgress(): Money
    {
        return $this->closingConstructionInProgress;
    }

    /**
     * Total Fixed Assets on Balance Sheet (Net Book Value of in-service assets + CIP).
     */
    public function totalFixedAssetsClosing(): Money
    {
        return $this->closingNetBookValue->add($this->closingConstructionInProgress);
    }

    public function currency(): Currency
    {
        return $this->capexIncurred->currency();
    }

    public function equals(ValueObject $other): bool
    {
        if (!$other instanceof self) {
            return false;
        }

        return $this->year === $other->year
            && $this->openingNetBookValue->equals($other->openingNetBookValue)
            && $this->capexIncurred->equals($other->capexIncurred)
            && $this->capitalizedAmount->equals($other->capitalizedAmount)
            && $this->depreciationExpense->equals($other->depreciationExpense)
            && $this->closingNetBookValue->equals($other->closingNetBookValue)
            && $this->closingConstructionInProgress->equals($other->closingConstructionInProgress);
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'year' => $this->year,
            'opening_net_book_value' => $this->openingNetBookValue->amount(),
            'capex_incurred' => $this->capexIncurred->amount(),
            'capitalized_amount' => $this->capitalizedAmount->amount(),
            'depreciation_expense' => $this->depreciationExpense->amount(),
            'gross_book_value_closing' => $this->grossBookValueClosing->amount(),
            'accumulated_depreciation_closing' => $this->accumulatedDepreciationClosing->amount(),
            'closing_net_book_value' => $this->closingNetBookValue->amount(),
            'closing_cip' => $this->closingConstructionInProgress->amount(),
            'total_fixed_assets_closing' => $this->totalFixedAssetsClosing()->amount(),
            'currency' => $this->currency()->value,
        ];
    }
}
