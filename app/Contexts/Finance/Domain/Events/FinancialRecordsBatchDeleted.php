<?php

declare(strict_types=1);

namespace App\Contexts\Finance\Domain\Events;

use App\Shared\Domain\DomainEvent;
use DateTimeImmutable;

final class FinancialRecordsBatchDeleted implements DomainEvent
{
    private DateTimeImmutable $occurredAt;

    /**
     * @param string $companyId
     * @param array<string> $recordIds
     * @param int $deletedCount
     * @param float $totalAmount
     * @param string|null $userId
     * @param string|null $ipAddress
     * @param DateTimeImmutable|null $occurredAt
     */
    public function __construct(
        private readonly string $companyId,
        private readonly array $recordIds,
        private readonly int $deletedCount,
        private readonly float $totalAmount,
        private readonly ?string $userId = null,
        private readonly ?string $ipAddress = null,
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
        return $this->companyId;
    }

    public function companyId(): string
    {
        return $this->companyId;
    }

    /**
     * @return array<string>
     */
    public function recordIds(): array
    {
        return $this->recordIds;
    }

    public function deletedCount(): int
    {
        return $this->deletedCount;
    }

    public function totalAmount(): float
    {
        return $this->totalAmount;
    }

    public function userId(): ?string
    {
        return $this->userId;
    }

    public function ipAddress(): ?string
    {
        return $this->ipAddress;
    }

    /**
     * @return array<string, mixed>
     */
    public function toPayload(): array
    {
        return [
            'company_id' => $this->companyId,
            'record_ids' => $this->recordIds,
            'deleted_count' => $this->deletedCount,
            'total_amount' => $this->totalAmount,
            'user_id' => $this->userId,
            'ip_address' => $this->ipAddress,
            'occurred_at' => $this->occurredAt->format(DateTimeImmutable::ATOM),
        ];
    }
}
