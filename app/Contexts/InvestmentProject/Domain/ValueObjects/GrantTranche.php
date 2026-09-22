<?php

declare(strict_types=1);

namespace App\Contexts\InvestmentProject\Domain\ValueObjects;

use App\Contexts\Finance\Domain\ValueObjects\Money;
use App\Shared\Domain\ValueObject;
use DateTimeImmutable;
use InvalidArgumentException;

final class GrantTranche implements ValueObject
{
    public function __construct(
        private readonly int $trancheNumber,
        private readonly int $month,
        private readonly DateTimeImmutable $disbursementDate,
        private readonly GrantTrancheType $type,
        private readonly Money $eligibleCostBasis,
        private readonly Money $disbursementAmount,
        private readonly Money $cumulativeDisbursed,
        private readonly ?string $notes = null
    ) {
        if ($this->trancheNumber < 1) {
            throw new InvalidArgumentException(
                sprintf('Tranche number must be >= 1, %d given.', $this->trancheNumber)
            );
        }

        if ($this->month < 0) {
            throw new InvalidArgumentException(
                sprintf('Tranche month cannot be negative, %d given.', $this->month)
            );
        }

        if ($this->disbursementAmount->isNegative()) {
            throw new InvalidArgumentException('Disbursement amount cannot be negative.');
        }

        if ($this->eligibleCostBasis->isNegative()) {
            throw new InvalidArgumentException('Eligible cost basis cannot be negative.');
        }
    }

    public function trancheNumber(): int
    {
        return $this->trancheNumber;
    }

    public function month(): int
    {
        return $this->month;
    }

    public function disbursementDate(): DateTimeImmutable
    {
        return $this->disbursementDate;
    }

    public function type(): GrantTrancheType
    {
        return $this->type;
    }

    public function eligibleCostBasis(): Money
    {
        return $this->eligibleCostBasis;
    }

    public function disbursementAmount(): Money
    {
        return $this->disbursementAmount;
    }

    public function cumulativeDisbursed(): Money
    {
        return $this->cumulativeDisbursed;
    }

    public function notes(): ?string
    {
        return $this->notes;
    }

    public function isAdvance(): bool
    {
        return $this->type->isAdvance();
    }

    public function isInterim(): bool
    {
        return $this->type->isInterim();
    }

    public function isFinal(): bool
    {
        return $this->type->isFinal();
    }

    public function equals(ValueObject $other): bool
    {
        if (!$other instanceof self) {
            return false;
        }

        return $this->trancheNumber === $other->trancheNumber
            && $this->month === $other->month
            && $this->disbursementDate->format('Y-m-d') === $other->disbursementDate->format('Y-m-d')
            && $this->type === $other->type
            && $this->eligibleCostBasis->equals($other->eligibleCostBasis)
            && $this->disbursementAmount->equals($other->disbursementAmount)
            && $this->cumulativeDisbursed->equals($other->cumulativeDisbursed);
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'tranche_number' => $this->trancheNumber,
            'month' => $this->month,
            'disbursement_date' => $this->disbursementDate->format('Y-m-d'),
            'type' => $this->type->value,
            'type_label' => $this->type->label(),
            'eligible_cost_basis' => $this->eligibleCostBasis->amount(),
            'disbursement_amount' => $this->disbursementAmount->amount(),
            'cumulative_disbursed' => $this->cumulativeDisbursed->amount(),
            'currency' => $this->disbursementAmount->currency()->value,
            'notes' => $this->notes,
        ];
    }
}
