<?php

declare(strict_types=1);

namespace App\Contexts\Finance\Domain\Events;

use App\Contexts\Finance\Domain\ValueObjects\FinancialRecordId;
use App\Shared\Domain\DomainEvent;
use DateTimeImmutable;

final class FinancialRecordDeleted implements DomainEvent
{
    private DateTimeImmutable $occurredAt;

    public function __construct(
        private readonly FinancialRecordId $recordId,
        private readonly string $companyId,
        private readonly ?string $deletedBy = null,
        private readonly ?array $payload = null,
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

    public function companyId(): string
    {
        return $this->companyId;
    }

    public function deletedBy(): ?string
    {
        return $this->deletedBy;
    }

    public function payload(): ?array
    {
        return $this->payload;
    }

    public function toPayload(): array
    {
        return [
            'record_id' => $this->recordId->value(),
            'company_id' => $this->companyId,
            'deleted_by' => $this->deletedBy,
            'payload' => $this->payload,
            'occurred_at' => $this->occurredAt->format(DateTimeImmutable::ATOM),
        ];
    }
}
