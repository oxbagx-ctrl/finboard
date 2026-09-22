<?php

declare(strict_types=1);

namespace App\Contexts\InvestmentProject\Domain\ValueObjects;

use App\Contexts\Finance\Domain\ValueObjects\Money;
use App\Shared\Domain\ValueObject;
use DateTimeImmutable;

final class AmortizationPeriod implements ValueObject
{
    public function __construct(
        private readonly int $periodNumber,
        private readonly DateTimeImmutable $paymentDate,
        private readonly Money $openingBalance,
        private readonly Money $principalPayment,
        private readonly Money $interestPayment,
        private readonly Money $totalPayment,
        private readonly Money $closingBalance,
        private readonly float $nominalRate,
        private readonly bool $isGracePeriod
    ) {
    }

    public function periodNumber(): int
    {
        return $this->periodNumber;
    }

    public function paymentDate(): DateTimeImmutable
    {
        return $this->paymentDate;
    }

    public function openingBalance(): Money
    {
        return $this->openingBalance;
    }

    public function principalPayment(): Money
    {
        return $this->principalPayment;
    }

    public function interestPayment(): Money
    {
        return $this->interestPayment;
    }

    public function totalPayment(): Money
    {
        return $this->totalPayment;
    }

    public function closingBalance(): Money
    {
        return $this->closingBalance;
    }

    public function nominalRate(): float
    {
        return $this->nominalRate;
    }

    public function isGracePeriod(): bool
    {
        return $this->isGracePeriod;
    }

    public function yearNumber(): int
    {
        return (int) ceil($this->periodNumber / 12);
    }

    public function equals(ValueObject $other): bool
    {
        return $other instanceof self
            && $this->periodNumber === $other->periodNumber
            && $this->principalPayment->equals($other->principalPayment)
            && $this->interestPayment->equals($other->interestPayment);
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'period' => $this->periodNumber,
            'year' => $this->yearNumber(),
            'date' => $this->paymentDate->format('Y-m-d'),
            'opening_balance' => $this->openingBalance->amount(),
            'principal' => $this->principalPayment->amount(),
            'interest' => $this->interestPayment->amount(),
            'total_payment' => $this->totalPayment->amount(),
            'closing_balance' => $this->closingBalance->amount(),
            'nominal_rate' => $this->nominalRate,
            'is_grace_period' => $this->isGracePeriod,
            'currency' => $this->openingBalance->currency()->value,
        ];
    }
}
