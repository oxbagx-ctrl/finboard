<?php

declare(strict_types=1);

namespace App\Contexts\InvestmentProject\Domain\ValueObjects;

use App\Contexts\Finance\Domain\ValueObjects\Currency;
use App\Contexts\Finance\Domain\ValueObjects\Money;
use App\Shared\Domain\ValueObject;
use InvalidArgumentException;

final class AnnualCashFlowStatement implements ValueObject
{
    public function __construct(
        private readonly int $year,
        private readonly Money $netIncome,
        private readonly Money $depreciation,
        private readonly Money $workingCapitalChange,
        private readonly Money $operatingCashFlow,
        private readonly Money $capexIncurred,
        private readonly Money $investingCashFlow,
        private readonly Money $equityInjected,
        private readonly Money $debtDrawdown,
        private readonly Money $debtPrincipalRepaid,
        private readonly Money $upfrontFees,
        private readonly Money $vatLoanDrawdown,
        private readonly Money $vatLoanRepaid,
        private readonly Money $grantReceived,
        private readonly Money $financingCashFlow,
        private readonly Money $netCashFlow,
        private readonly Money $openingCashBalance,
        private readonly Money $closingCashBalance
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

        return $this->year === $other->year
            && $this->operatingCashFlow->equals($other->operatingCashFlow)
            && $this->investingCashFlow->equals($other->investingCashFlow)
            && $this->financingCashFlow->equals($other->financingCashFlow)
            && $this->netCashFlow->equals($other->netCashFlow)
            && $this->closingCashBalance->equals($other->closingCashBalance);
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'year' => $this->year,
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
