<?php

declare(strict_types=1);

namespace App\Contexts\InvestmentProject\Domain\ValueObjects;

use App\Contexts\Finance\Domain\ValueObjects\Currency;
use App\Contexts\Finance\Domain\ValueObjects\Money;
use App\Shared\Domain\ValueObject;
use InvalidArgumentException;

final class AnnualIncomeStatement implements ValueObject
{
    public function __construct(
        private readonly int $year,
        private readonly Money $revenue,
        private readonly Money $variableCosts,
        private readonly Money $fixedCosts,
        private readonly Money $payrollCosts,
        private readonly Money $totalOpex,
        private readonly Money $ebitda,
        private readonly Money $depreciation,
        private readonly Money $ebit,
        private readonly Money $interestExpense,
        private readonly Money $ebt,
        private readonly Money $taxLossUsed,
        private readonly Money $taxableIncome,
        private readonly Money $incomeTax,
        private readonly Money $netIncome,
        private readonly Money $taxLossCarryForwardClosing
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

    public function revenue(): Money
    {
        return $this->revenue;
    }

    public function variableCosts(): Money
    {
        return $this->variableCosts;
    }

    public function fixedCosts(): Money
    {
        return $this->fixedCosts;
    }

    public function payrollCosts(): Money
    {
        return $this->payrollCosts;
    }

    public function totalOpex(): Money
    {
        return $this->totalOpex;
    }

    public function ebitda(): Money
    {
        return $this->ebitda;
    }

    public function depreciation(): Money
    {
        return $this->depreciation;
    }

    public function ebit(): Money
    {
        return $this->ebit;
    }

    public function interestExpense(): Money
    {
        return $this->interestExpense;
    }

    public function ebt(): Money
    {
        return $this->ebt;
    }

    public function taxLossUsed(): Money
    {
        return $this->taxLossUsed;
    }

    public function taxableIncome(): Money
    {
        return $this->taxableIncome;
    }

    public function incomeTax(): Money
    {
        return $this->incomeTax;
    }

    public function netIncome(): Money
    {
        return $this->netIncome;
    }

    public function taxLossCarryForwardClosing(): Money
    {
        return $this->taxLossCarryForwardClosing;
    }

    public function ebitdaMarginPercent(): float
    {
        if ($this->revenue->isZero()) {
            return 0.0;
        }

        return round(($this->ebitda->toDecimal() / $this->revenue->toDecimal()) * 100.0, 2);
    }

    public function ebitMarginPercent(): float
    {
        if ($this->revenue->isZero()) {
            return 0.0;
        }

        return round(($this->ebit->toDecimal() / $this->revenue->toDecimal()) * 100.0, 2);
    }

    public function netProfitMarginPercent(): float
    {
        if ($this->revenue->isZero()) {
            return 0.0;
        }

        return round(($this->netIncome->toDecimal() / $this->revenue->toDecimal()) * 100.0, 2);
    }

    public function currency(): Currency
    {
        return $this->revenue->currency();
    }

    public function equals(ValueObject $other): bool
    {
        if (!$other instanceof self) {
            return false;
        }

        return $this->year === $other->year
            && $this->revenue->equals($other->revenue)
            && $this->ebitda->equals($other->ebitda)
            && $this->ebit->equals($other->ebit)
            && $this->netIncome->equals($other->netIncome);
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'year' => $this->year,
            'revenue' => $this->revenue->amount(),
            'variable_costs' => $this->variableCosts->amount(),
            'fixed_costs' => $this->fixedCosts->amount(),
            'payroll_costs' => $this->payrollCosts->amount(),
            'total_opex' => $this->totalOpex->amount(),
            'ebitda' => $this->ebitda->amount(),
            'ebitda_margin_percent' => $this->ebitdaMarginPercent(),
            'depreciation' => $this->depreciation->amount(),
            'ebit' => $this->ebit->amount(),
            'ebit_margin_percent' => $this->ebitMarginPercent(),
            'interest_expense' => $this->interestExpense->amount(),
            'ebt' => $this->ebt->amount(),
            'tax_loss_used' => $this->taxLossUsed->amount(),
            'taxable_income' => $this->taxableIncome->amount(),
            'income_tax' => $this->incomeTax->amount(),
            'net_income' => $this->netIncome->amount(),
            'net_profit_margin_percent' => $this->netProfitMarginPercent(),
            'tax_loss_carry_forward_closing' => $this->taxLossCarryForwardClosing->amount(),
            'currency' => $this->currency()->value,
        ];
    }
}
