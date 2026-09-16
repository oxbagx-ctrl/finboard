<?php

declare(strict_types=1);

namespace App\Contexts\Identity\Domain\Events;

use App\Contexts\Identity\Domain\ValueObjects\UserId;
use App\Shared\Domain\DomainEvent;
use DateTimeImmutable;

final class UserRegistered implements DomainEvent
{
    private DateTimeImmutable $occurredAt;

    public function __construct(
        private readonly UserId $userId,
        private readonly string $email,
        private readonly string $role,
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
        return $this->userId->value();
    }

    public function email(): string
    {
        return $this->email;
    }

    public function role(): string
    {
        return $this->role;
    }

    public function companyId(): ?string
    {
        return $this->companyId;
    }

    public function toPayload(): array
    {
        return [
            'user_id' => $this->userId->value(),
            'email' => $this->email,
            'role' => $this->role,
            'company_id' => $this->companyId,
            'occurred_at' => $this->occurredAt->format(DateTimeImmutable::ATOM),
        ];
    }
}
