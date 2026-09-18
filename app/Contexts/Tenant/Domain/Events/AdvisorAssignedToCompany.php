<?php

declare(strict_types=1);

namespace App\Contexts\Tenant\Domain\Events;

use App\Shared\Domain\DomainEvent;
use DateTimeImmutable;

final class AdvisorAssignedToCompany implements DomainEvent
{
    public function __construct(
        private readonly string $companyId,
        private readonly string $advisorId,
        private readonly ?string $assignedBy = null,
        private readonly DateTimeImmutable $assignedAt = new DateTimeImmutable()
    ) {
    }

    public function aggregateId(): string
    {
        return "{$this->companyId}:{$this->advisorId}";
    }

    public function companyId(): string
    {
        return $this->companyId;
    }

    public function advisorId(): string
    {
        return $this->advisorId;
    }

    public function assignedBy(): ?string
    {
        return $this->assignedBy;
    }

    public function occurredAt(): DateTimeImmutable
    {
        return $this->assignedAt;
    }

    public function toPayload(): array
    {
        return [
            'company_id' => $this->companyId,
            'advisor_id' => $this->advisorId,
            'assigned_by' => $this->assignedBy,
            'assigned_at' => $this->assignedAt->format(DateTimeImmutable::ATOM),
        ];
    }
}
