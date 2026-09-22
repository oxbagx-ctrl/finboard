<?php

declare(strict_types=1);

namespace App\Contexts\InvestmentProject\Domain\ValueObjects;

use App\Contexts\Finance\Domain\ValueObjects\Currency;
use App\Contexts\Finance\Domain\ValueObjects\Money;
use App\Shared\Domain\ValueObject;
use DateTimeImmutable;
use InvalidArgumentException;

final class IncomeStatementPeriod implements ValueObject
{
    public function __construct(
        private readonly int $periodNumber,
        private readonly int $year,
        private readonly int $monthInYear,
        private readonly DateTimeImmutable $date,
        private readonly bool $isCommercialOperation,
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
        if ($this->periodNumber < 1) {
            throw new InvalidArgumentException(
                sprintf('Period number must be >= 1, %d given.', $this->periodNumber)
            );
        }

        if ($this->year < 1) {
            throw new InvalidArgumentException(
                sprintf('Year must be >= 1, %d given.', $this->year)
            );
        }

        if ($this->monthInYear < 1 || $this->monthInYear > 12) {
            throw new InvalidArgumentException(
                sprintf('Month in year must be between 1 and 12, %d given.', $this->monthInYear)
            );
        }
    }

    public function periodNumber(): int
    {
        return $this->periodNumber;
    }

    public function year(): int
    {
        return $this->year;
    }

    public function monthInYear(): int
    {
        return $this->monthInYear;
    }

    public function date(): DateTimeImmutable
    {
        return $this->date;
    }

    public function isCommercialOperation(): bool
    {
        return $this->isCommercialOperation;
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

    public function currency(): Currency
    {
        return $this->revenue->currency();
    }

    public function equals(ValueObject $other): bool
    {
        if (!$other instanceof self) {
            return false;
        }

        return $this->periodNumber === $other->periodNumber
            && $this->year === $other->year
            && $this->monthInYear === $other->monthInYear
            && $this->isCommercialOperation === $other->isCommercialOperation
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
            'period_number' => $this->periodNumber,
            'year' => $this->year,
            'month_in_year' => $this->monthInYear,
            'date' => $this->date->format('Y-m-d'),
            'is_commercial_operation' => $this->isCommercialOperation,
            'revenue' => $this->revenue->amount(),
            'variable_costs' => $this->variableCosts->amount(),
            'fixed_costs' => $this->fixedCosts->amount(),
            'payroll_costs' => $this->payrollCosts->amount(),
            'total_opex' => $this->totalOpex->amount(),
            'ebitda' => $this->ebitda->amount(),
            'depreciation' => $this->depreciation->amount(),
            'ebit' => $this->ebit->amount(),
            'interest_expense' => $this->interestExpense->amount(),
            'ebt' => $this->ebt->amount(),
            'tax_loss_used' => $this->taxLossUsed->amount(),
            'taxable_income' => $this->taxableIncome->amount(),
            'income_tax' => $this->incomeTax->amount(),
            'net_income' => $this->netIncome->amount(),
            'tax_loss_carry_forward_closing' => $this->taxLossCarryForwardClosing->amount(),
            'currency' => $this->currency()->value,
        ];
    }
}
