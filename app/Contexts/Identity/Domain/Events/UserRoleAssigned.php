<?php

declare(strict_types=1);

namespace App\Contexts\Identity\Domain\Events;

use App\Contexts\Identity\Domain\ValueObjects\UserId;
use App\Shared\Domain\DomainEvent;
use DateTimeImmutable;

final class UserRoleAssigned implements DomainEvent
{
    private DateTimeImmutable $occurredAt;

    public function __construct(
        private readonly UserId $userId,
        private readonly string $previousRole,
        private readonly string $newRole,
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
        return $this->userId->value();
    }

    public function previousRole(): string
    {
        return $this->previousRole;
    }

    public function newRole(): string
    {
        return $this->newRole;
    }

    public function toPayload(): array
    {
        return [
            'user_id' => $this->userId->value(),
            'previous_role' => $this->previousRole,
            'new_role' => $this->newRole,
            'occurred_at' => $this->occurredAt->format(DateTimeImmutable::ATOM),
        ];
    }
}
