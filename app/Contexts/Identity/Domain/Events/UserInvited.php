<?php

declare(strict_types=1);

namespace App\Contexts\Identity\Domain\Events;

use App\Contexts\Identity\Domain\ValueObjects\InvitationId;
use App\Contexts\Identity\Domain\ValueObjects\UserId;
use App\Shared\Domain\DomainEvent;
use DateTimeImmutable;

final class UserInvited implements DomainEvent
{
    private DateTimeImmutable $occurredAt;

    /**
     * @param array<string> $assignedCompanyIds
     */
    public function __construct(
        private readonly InvitationId $invitationId,
        private readonly string $email,
        private readonly string $role,
        private readonly ?string $companyId,
        private readonly array $assignedCompanyIds,
        private readonly UserId $invitedBy,
        private readonly string $token,
        private readonly DateTimeImmutable $expiresAt,
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

    public function role(): string
    {
        return $this->role;
    }

    public function companyId(): ?string
    {
        return $this->companyId;
    }

    /**
     * @return array<string>
     */
    public function assignedCompanyIds(): array
    {
        return $this->assignedCompanyIds;
    }

    public function invitedBy(): string
    {
        return $this->invitedBy->value();
    }

    public function token(): string
    {
        return $this->token;
    }

    public function expiresAt(): DateTimeImmutable
    {
        return $this->expiresAt;
    }

    public function toPayload(): array
    {
        return [
            'invitation_id' => $this->invitationId->value(),
            'email' => $this->email,
            'role' => $this->role,
            'company_id' => $this->companyId,
            'assigned_company_ids' => $this->assignedCompanyIds,
            'invited_by' => $this->invitedBy->value(),
            'token' => $this->token,
            'expires_at' => $this->expiresAt->format(DateTimeImmutable::ATOM),
            'occurred_at' => $this->occurredAt->format(DateTimeImmutable::ATOM),
        ];
    }
}
