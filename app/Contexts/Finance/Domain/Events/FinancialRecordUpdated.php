<?php

declare(strict_types=1);

namespace App\Contexts\Finance\Domain\Events;

use App\Contexts\Finance\Domain\ValueObjects\FinancialRecordId;
use App\Shared\Domain\DomainEvent;
use DateTimeImmutable;

final class FinancialRecordUpdated implements DomainEvent
{
    private DateTimeImmutable $occurredAt;

    public function __construct(
        private readonly FinancialRecordId $recordId,
        private readonly string $previousAmount,
        private readonly string $newAmount,
        private readonly string $currency,
        private readonly ?string $companyId = null,
        ?DateTimeImmutable $occurredAt = null
    ) {
        $this->occurredAt = $occurredAt ?? new DateTimeImmutable();
    }

    public function occurredAt(): DateTimeImmutable
    {
        return $this->occurredAt;
    }

    public function aggregateId(): string
    {
        return $this->recordId->value();
    }

    public function recordId(): FinancialRecordId
    {
        return $this->recordId;
    }

    public function companyId(): ?string
    {
        return $this->companyId;
    }

    public function previousAmount(): string
    {
        return $this->previousAmount;
    }

    public function newAmount(): string
    {
        return $this->newAmount;
    }

    public function currency(): string
    {
        return $this->currency;
    }

    public function toPayload(): array
    {
        return [
            'record_id' => $this->recordId->value(),
            'company_id' => $this->companyId,
            'previous_amount' => $this->previousAmount,
            'new_amount' => $this->newAmount,
            'currency' => $this->currency,
            'occurred_at' => $this->occurredAt->format(DateTimeImmutable::ATOM),
        ];
    }
}
