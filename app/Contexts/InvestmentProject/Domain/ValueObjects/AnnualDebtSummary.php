<?php

declare(strict_types=1);

namespace App\Contexts\InvestmentProject\Domain\ValueObjects;

use App\Contexts\Finance\Domain\ValueObjects\Money;
use App\Shared\Domain\ValueObject;

final class AnnualDebtSummary implements ValueObject
{
    public function __construct(
        private readonly int $year,
        private readonly Money $openingBalance,
        private readonly Money $principalPaid,
        private readonly Money $interestPaid,
        private readonly Money $totalDebtService,
        private readonly Money $closingBalance
    ) {
    }

    public function year(): int
    {
        return $this->year;
    }

    public function openingBalance(): Money
    {
        return $this->openingBalance;
    }

    public function principalPaid(): Money
    {
        return $this->principalPaid;
    }

    public function interestPaid(): Money
    {
        return $this->interestPaid;
    }

    public function totalDebtService(): Money
    {
        return $this->totalDebtService;
    }

    public function closingBalance(): Money
    {
        return $this->closingBalance;
    }

    public function equals(ValueObject $other): bool
    {
        return $other instanceof self
            && $this->year === $other->year
            && $this->principalPaid->equals($other->principalPaid)
            && $this->interestPaid->equals($other->interestPaid);
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'year' => $this->year,
            'opening_balance' => $this->openingBalance->amount(),
            'principal_paid' => $this->principalPaid->amount(),
            'interest_paid' => $this->interestPaid->amount(),
            'total_debt_service' => $this->totalDebtService->amount(),
            'closing_balance' => $this->closingBalance->amount(),
            'currency' => $this->openingBalance->currency()->value,
        ];
    }
}
