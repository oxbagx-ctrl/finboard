<?php

declare(strict_types=1);

namespace App\Contexts\Identity\Domain\Events;

use App\Contexts\Identity\Domain\ValueObjects\InvitationId;
use App\Shared\Domain\DomainEvent;
use DateTimeImmutable;

final class InvitationAccepted implements DomainEvent
{
    private DateTimeImmutable $occurredAt;

    public function __construct(
        private readonly InvitationId $invitationId,
        private readonly string $email,
        private readonly string $registeredUserId,
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

    public function email(): string
    {
        return $this->email;
    }

    public function registeredUserId(): string
    {
        return $this->registeredUserId;
    }

    public function toPayload(): array
    {
        return [
            'invitation_id' => $this->invitationId->value(),
            'email' => $this->email,
            'registered_user_id' => $this->registeredUserId,
            'occurred_at' => $this->occurredAt->format(DateTimeImmutable::ATOM),
        ];
    }
}
