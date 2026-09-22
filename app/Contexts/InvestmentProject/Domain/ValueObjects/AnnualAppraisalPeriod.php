<?php

declare(strict_types=1);

namespace App\Contexts\InvestmentProject\Domain\ValueObjects;

use App\Contexts\Finance\Domain\ValueObjects\Currency;
use App\Contexts\Finance\Domain\ValueObjects\Money;
use App\Shared\Domain\ValueObject;
use InvalidArgumentException;

final class AnnualAppraisalPeriod implements ValueObject
{
    public function __construct(
        private readonly int $year,
        // Enterprise Level (Unlevered - FCFF)
        private readonly Money $ebit,
        private readonly Money $nopat,
        private readonly Money $depreciation,
        private readonly Money $capex,
        private readonly Money $workingCapitalChange,
        private readonly Money $fcff,
        private readonly float $discountRatePercent,
        private readonly float $discountFactor,
        private readonly Money $discountedFcff,
        private readonly Money $cumulativeDiscountedFcff,
        // Equity Level (Levered - FCFE)
        private readonly Money $netIncome,
        private readonly Money $debtDrawdown,
        private readonly Money $debtPrincipalRepaid,
        private readonly Money $fcfe,
        private readonly float $costOfEquityPercent,
        private readonly float $discountFactorEquity,
        private readonly Money $discountedFcfe,
        private readonly Money $cumulativeDiscountedFcfe
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

    public function ebit(): Money
    {
        return $this->ebit;
    }

    public function nopat(): Money
    {
        return $this->nopat;
    }

    public function depreciation(): Money
    {
        return $this->depreciation;
    }

    public function capex(): Money
    {
        return $this->capex;
    }

    public function workingCapitalChange(): Money
    {
        return $this->workingCapitalChange;
    }

    public function fcff(): Money
    {
        return $this->fcff;
    }

    public function discountRatePercent(): float
    {
        return $this->discountRatePercent;
    }

    public function discountFactor(): float
    {
        return $this->discountFactor;
    }

    public function discountedFcff(): Money
    {
        return $this->discountedFcff;
    }

    public function cumulativeDiscountedFcff(): Money
    {
        return $this->cumulativeDiscountedFcff;
    }

    public function netIncome(): Money
    {
        return $this->netIncome;
    }

    public function debtDrawdown(): Money
    {
        return $this->debtDrawdown;
    }

    public function debtPrincipalRepaid(): Money
    {
        return $this->debtPrincipalRepaid;
    }

    public function fcfe(): Money
    {
        return $this->fcfe;
    }

    public function costOfEquityPercent(): float
    {
        return $this->costOfEquityPercent;
    }

    public function discountFactorEquity(): float
    {
        return $this->discountFactorEquity;
    }

    public function discountedFcfe(): Money
    {
        return $this->discountedFcfe;
    }

    public function cumulativeDiscountedFcfe(): Money
    {
        return $this->cumulativeDiscountedFcfe;
    }

    public function currency(): Currency
    {
        return $this->ebit->currency();
    }

    public function equals(ValueObject $other): bool
    {
        if (!$other instanceof self) {
            return false;
        }

        return $this->year === $other->year
            && $this->fcff->equals($other->fcff)
            && $this->discountedFcff->equals($other->discountedFcff)
            && $this->fcfe->equals($other->fcfe)
            && $this->discountedFcfe->equals($other->discountedFcfe);
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'year' => $this->year,
            'ebit' => $this->ebit->amount(),
            'nopat' => $this->nopat->amount(),
            'depreciation' => $this->depreciation->amount(),
            'capex' => $this->capex->amount(),
            'working_capital_change' => $this->workingCapitalChange->amount(),
            'fcff' => $this->fcff->amount(),
            'discount_rate_percent' => $this->discountRatePercent,
            'discount_factor' => $this->discountFactor,
            'discounted_fcff' => $this->discountedFcff->amount(),
            'cumulative_discounted_fcff' => $this->cumulativeDiscountedFcff->amount(),
            'net_income' => $this->netIncome->amount(),
            'debt_drawdown' => $this->debtDrawdown->amount(),
            'debt_principal_repaid' => $this->debtPrincipalRepaid->amount(),
            'fcfe' => $this->fcfe->amount(),
            'cost_of_equity_percent' => $this->costOfEquityPercent,
            'discount_factor_equity' => $this->discountFactorEquity,
            'discounted_fcfe' => $this->discountedFcfe->amount(),
            'cumulative_discounted_fcfe' => $this->cumulativeDiscountedFcfe->amount(),
            'currency' => $this->currency()->value,
        ];
    }
}
