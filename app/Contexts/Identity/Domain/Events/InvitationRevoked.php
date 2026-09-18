<?php

declare(strict_types=1);

namespace App\Contexts\Identity\Domain\Events;

use App\Contexts\Identity\Domain\ValueObjects\InvitationId;
use App\Contexts\Identity\Domain\ValueObjects\UserId;
use App\Shared\Domain\DomainEvent;
use DateTimeImmutable;

final class InvitationRevoked implements DomainEvent
{
    private DateTimeImmutable $occurredAt;

    public function __construct(
        private readonly InvitationId $invitationId,
        private readonly UserId $revokedBy,
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
        return $this->invitationId->value();
    }

    public function invitationId(): string
    {
        return $this->invitationId->value();
    }

    public function revokedBy(): string
    {
        return $this->revokedBy->value();
    }

    public function toPayload(): array
    {
        return [
            'invitation_id' => $this->invitationId->value(),
            'revoked_by' => $this->revokedBy->value(),
            'occurred_at' => $this->occurredAt->format(DateTimeImmutable::ATOM),
        ];
    }
}
