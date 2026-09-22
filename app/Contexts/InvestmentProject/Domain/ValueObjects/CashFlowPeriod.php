<?php

declare(strict_types=1);

namespace App\Contexts\InvestmentProject\Domain\ValueObjects;

use App\Contexts\Finance\Domain\ValueObjects\Currency;
use App\Contexts\Finance\Domain\ValueObjects\Money;
use App\Shared\Domain\ValueObject;
use DateTimeImmutable;
use InvalidArgumentException;

final class CashFlowPeriod implements ValueObject
{
    public function __construct(
        private readonly int $periodNumber,
        private readonly int $year,
        private readonly int $monthInYear,
        private readonly DateTimeImmutable $date,
        // Operating Activities (CFO)
        private readonly Money $netIncome,
        private readonly Money $depreciation,
        private readonly Money $workingCapitalChange,
        private readonly Money $operatingCashFlow,
        // Investing Activities (CFI)
        private readonly Money $capexIncurred,
        private readonly Money $investingCashFlow,
        // Financing Activities (CFF)
        private readonly Money $equityInjected,
        private readonly Money $debtDrawdown,
        private readonly Money $debtPrincipalRepaid,
        private readonly Money $upfrontFees,
        private readonly Money $vatLoanDrawdown,
        private readonly Money $vatLoanRepaid,
        private readonly Money $grantReceived,
        private readonly Money $financingCashFlow,
        // Net Cash Flow & Balance
        private readonly Money $netCashFlow,
        private readonly Money $openingCashBalance,
        private readonly Money $closingCashBalance
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

    public function netIncome(): Money
    {
        return $this->netIncome;
    }

    public function depreciation(): Money
    {
        return $this->depreciation;
    }

    public function workingCapitalChange(): Money
    {
        return $this->workingCapitalChange;
    }

    public function operatingCashFlow(): Money
    {
        return $this->operatingCashFlow;
    }

    public function capexIncurred(): Money
    {
        return $this->capexIncurred;
    }

    public function investingCashFlow(): Money
    {
        return $this->investingCashFlow;
    }

    public function equityInjected(): Money
    {
        return $this->equityInjected;
    }

    public function debtDrawdown(): Money
    {
        return $this->debtDrawdown;
    }

    public function debtPrincipalRepaid(): Money
    {
        return $this->debtPrincipalRepaid;
    }

    public function upfrontFees(): Money
    {
        return $this->upfrontFees;
    }

    public function vatLoanDrawdown(): Money
    {
        return $this->vatLoanDrawdown;
    }

    public function vatLoanRepaid(): Money
    {
        return $this->vatLoanRepaid;
    }

    public function grantReceived(): Money
    {
        return $this->grantReceived;
    }

    public function financingCashFlow(): Money
    {
        return $this->financingCashFlow;
    }

    public function netCashFlow(): Money
    {
        return $this->netCashFlow;
    }

    public function openingCashBalance(): Money
    {
        return $this->openingCashBalance;
    }

    public function closingCashBalance(): Money
    {
        return $this->closingCashBalance;
    }

    public function currency(): Currency
    {
        return $this->netIncome->currency();
    }

    public function equals(ValueObject $other): bool
    {
        if (!$other instanceof self) {
            return false;
        }

        return $this->periodNumber === $other->periodNumber
            && $this->year === $other->year
            && $this->monthInYear === $other->monthInYear
            && $this->operatingCashFlow->equals($other->operatingCashFlow)
            && $this->investingCashFlow->equals($other->investingCashFlow)
            && $this->financingCashFlow->equals($other->financingCashFlow)
            && $this->closingCashBalance->equals($other->closingCashBalance);
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
            'net_income' => $this->netIncome->amount(),
            'depreciation' => $this->depreciation->amount(),
            'working_capital_change' => $this->workingCapitalChange->amount(),
            'cfo' => $this->operatingCashFlow->amount(),
            'capex_incurred' => $this->capexIncurred->amount(),
            'cfi' => $this->investingCashFlow->amount(),
            'equity_injected' => $this->equityInjected->amount(),
            'debt_drawdown' => $this->debtDrawdown->amount(),
            'debt_principal_repaid' => $this->debtPrincipalRepaid->amount(),
            'upfront_fees' => $this->upfrontFees->amount(),
            'vat_loan_drawdown' => $this->vatLoanDrawdown->amount(),
            'vat_loan_repaid' => $this->vatLoanRepaid->amount(),
            'grant_received' => $this->grantReceived->amount(),
            'cff' => $this->financingCashFlow->amount(),
            'net_cash_flow' => $this->netCashFlow->amount(),
            'opening_cash_balance' => $this->openingCashBalance->amount(),
            'closing_cash_balance' => $this->closingCashBalance->amount(),
            'currency' => $this->currency()->value,
        ];
    }
}
