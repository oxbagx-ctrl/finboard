<?php

declare(strict_types=1);

namespace App\Contexts\Tenant\Domain\Events;

use App\Shared\Domain\DomainEvent;
use DateTimeImmutable;

final class AdvisorRevokedFromCompany implements DomainEvent
{
    public function __construct(
        private readonly string $companyId,
        private readonly string $advisorId,
        private readonly ?string $revokedBy = null,
        private readonly DateTimeImmutable $revokedAt = new DateTimeImmutable()
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

    public function revokedBy(): ?string
    {
        return $this->revokedBy;
    }

    public function occurredAt(): DateTimeImmutable
    {
        return $this->revokedAt;
    }

    public function toPayload(): array
    {
        return [
            'company_id' => $this->companyId,
            'advisor_id' => $this->advisorId,
            'revoked_by' => $this->revokedBy,
            'revoked_at' => $this->revokedAt->format(DateTimeImmutable::ATOM),
        ];
    }
}
