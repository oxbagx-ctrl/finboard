<?php

declare(strict_types=1);

namespace App\Contexts\InvestmentProject\Domain\ValueObjects;

use App\Contexts\Finance\Domain\ValueObjects\Money;
use App\Shared\Domain\ValueObject;
use DateTimeImmutable;

final class VatBridgePeriod implements ValueObject
{
    public function __construct(
        private readonly int $periodNumber,
        private readonly DateTimeImmutable $date,
        private readonly Money $capexNet,
        private readonly Money $vatIncurred,
        private readonly Money $vatRefunded,
        private readonly Money $openingBalance,
        private readonly Money $drawdown,
        private readonly Money $repayment,
        private readonly Money $interestPayment,
        private readonly Money $closingBalance,
        private readonly float $monthlyInterestRate
    ) {
    }

    public function periodNumber(): int
    {
        return $this->periodNumber;
    }

    public function date(): DateTimeImmutable
    {
        return $this->date;
    }

    public function capexNet(): Money
    {
        return $this->capexNet;
    }

    public function vatIncurred(): Money
    {
        return $this->vatIncurred;
    }

    public function vatRefunded(): Money
    {
        return $this->vatRefunded;
    }

    public function openingBalance(): Money
    {
        return $this->openingBalance;
    }

    public function drawdown(): Money
    {
        return $this->drawdown;
    }

    public function repayment(): Money
    {
        return $this->repayment;
    }

    public function interestPayment(): Money
    {
        return $this->interestPayment;
    }

    public function closingBalance(): Money
    {
        return $this->closingBalance;
    }

    public function monthlyInterestRate(): float
    {
        return $this->monthlyInterestRate;
    }

    public function yearNumber(): int
    {
        return (int) ceil($this->periodNumber / 12);
    }

    public function equals(ValueObject $other): bool
    {
        return $other instanceof self
            && $this->periodNumber === $other->periodNumber
            && $this->drawdown->equals($other->drawdown)
            && $this->repayment->equals($other->repayment)
            && $this->closingBalance->equals($other->closingBalance);
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'period' => $this->periodNumber,
            'year' => $this->yearNumber(),
            'date' => $this->date->format('Y-m-d'),
            'capex_net' => $this->capexNet->amount(),
            'vat_incurred' => $this->vatIncurred->amount(),
            'vat_refunded' => $this->vatRefunded->amount(),
            'opening_balance' => $this->openingBalance->amount(),
            'drawdown' => $this->drawdown->amount(),
            'repayment' => $this->repayment->amount(),
            'interest' => $this->interestPayment->amount(),
            'closing_balance' => $this->closingBalance->amount(),
            'currency' => $this->openingBalance->currency()->value,
        ];
    }
}
