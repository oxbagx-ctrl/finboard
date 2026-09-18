<?php

declare(strict_types=1);

namespace App\Contexts\Identity\Domain\Entities;

use App\Contexts\Identity\Domain\Events\InvitationAccepted;
use App\Contexts\Identity\Domain\Events\InvitationRevoked;
use App\Contexts\Identity\Domain\Events\UserInvited;
use App\Contexts\Identity\Domain\Exceptions\InvitationAlreadyAcceptedException;
use App\Contexts\Identity\Domain\Exceptions\InvitationExpiredException;
use App\Contexts\Identity\Domain\Exceptions\InvitationRevokedException;
use App\Contexts\Identity\Domain\ValueObjects\Email;
use App\Contexts\Identity\Domain\ValueObjects\InvitationId;
use App\Contexts\Identity\Domain\ValueObjects\InvitationStatus;
use App\Contexts\Identity\Domain\ValueObjects\Token;
use App\Contexts\Identity\Domain\ValueObjects\UserId;
use App\Shared\Domain\AggregateRoot;
use DateTimeImmutable;
use DomainException;

final class Invitation extends AggregateRoot
{
    /**
     * @param array<string> $assignedCompanyIds
     */
    public function __construct(
        private readonly InvitationId $id,
        private readonly Email $email,
        private readonly Role $role,
        private readonly UserId $invitedBy,
        private ?string $companyId = null,
        private array $assignedCompanyIds = [],
        private Token $token = new Token('placeholder32charsrandomabcdefgh', new DateTimeImmutable()),
        private InvitationStatus $status = InvitationStatus::PENDING,
        private readonly DateTimeImmutable $createdAt = new DateTimeImmutable(),
        private ?DateTimeImmutable $acceptedAt = null,
        private ?DateTimeImmutable $revokedAt = null,
        private ?UserId $revokedBy = null
    ) {
    }

    /**
     * Factory method for creating a brand new invitation.
     *
     * @param array<string> $assignedCompanyIds
     */
    public static function create(
        InvitationId $id,
        Email $email,
        Role $role,
        UserId $invitedBy,
        ?string $companyId = null,
        array $assignedCompanyIds = [],
        ?Token $token = null,
        ?DateTimeImmutable $now = null
    ): self {
        $createdAt = $now ?? new DateTimeImmutable();
        $invitationToken = $token ?? Token::generate(Token::DEFAULT_VALIDITY_HOURS, $createdAt);

        $companies = array_values(array_unique(array_filter(array_map('strval', $assignedCompanyIds))));
        if ($companyId !== null && !in_array($companyId, $companies, true) && $role->isAdvisor()) {
            $companies[] = $companyId;
        }

        $invitation = new self(
            id: $id,
            email: $email,
            role: $role,
            invitedBy: $invitedBy,
            companyId: $companyId,
            assignedCompanyIds: $companies,
            token: $invitationToken,
            status: InvitationStatus::PENDING,
            createdAt: $createdAt
        );

        $invitation->recordThat(new UserInvited(
            invitationId: $id,
            email: $email->value(),
            role: $role->name()->value,
            companyId: $companyId,
            assignedCompanyIds: $companies,
            invitedBy: $invitedBy,
            token: $invitationToken->value(),
            expiresAt: $invitationToken->expiresAt(),
            occurredAt: $createdAt
        ));

        return $invitation;
    }

    public function id(): string
    {
        return $this->id->value();
    }

    public function invitationId(): InvitationId
    {
        return $this->id;
    }

    public function email(): Email
    {
        return $this->email;
    }

    public function role(): Role
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

    public function token(): Token
    {
        return $this->token;
    }

    public function invitedBy(): UserId
    {
        return $this->invitedBy;
    }

    public function status(): InvitationStatus
    {
        return $this->status;
    }

    public function createdAt(): DateTimeImmutable
    {
        return $this->createdAt;
    }

    public function acceptedAt(): ?DateTimeImmutable
    {
        return $this->acceptedAt;
    }

    public function revokedAt(): ?DateTimeImmutable
    {
        return $this->revokedAt;
    }

    public function revokedBy(): ?UserId
    {
        return $this->revokedBy;
    }

    public function isPending(?DateTimeImmutable $now = null): bool
    {
        return $this->status === InvitationStatus::PENDING && !$this->token->isExpired($now);
    }

    public function isAccepted(): bool
    {
        return $this->status === InvitationStatus::ACCEPTED;
    }

    public function isRevoked(): bool
    {
        return $this->status === InvitationStatus::REVOKED;
    }

    public function isExpired(?DateTimeImmutable $now = null): bool
    {
        if ($this->status === InvitationStatus::EXPIRED) {
            return true;
        }

        if ($this->isAccepted() || $this->isRevoked()) {
            return false;
        }

        return $this->token->isExpired($now);
    }

    public function canBeAccepted(?DateTimeImmutable $now = null): bool
    {
        return $this->isPending($now);
    }

    public function verifyToken(string $plainToken): bool
    {
        return $this->token->matches($plainToken);
    }

    /**
     * Accept the invitation and transition to ACCEPTED state.
     */
    public function accept(string $registeredUserId, ?DateTimeImmutable $now = null): void
    {
        $reference = $now ?? new DateTimeImmutable();

        if ($this->isAccepted()) {
            throw new InvitationAlreadyAcceptedException();
        }

        if ($this->isRevoked()) {
            throw new InvitationRevokedException();
        }

        if ($this->isExpired($reference)) {
            throw InvitationExpiredException::forDate($this->token->expiresAt());
        }

        $this->status = InvitationStatus::ACCEPTED;
        $this->acceptedAt = $reference;

        $this->recordThat(new InvitationAccepted(
            invitationId: $this->id,
            email: $this->email->value(),
            registeredUserId: $registeredUserId,
            occurredAt: $reference
        ));
    }

    /**
     * Revoke the invitation and transition to REVOKED state.
     */
    public function revoke(UserId $revokedBy, ?DateTimeImmutable $now = null): void
    {
        if ($this->isAccepted()) {
            throw new DomainException('Nie można cofnąć zaproszenia, które zostało już zaakceptowane.');
        }

        if ($this->isRevoked()) {
            return;
        }

        $reference = $now ?? new DateTimeImmutable();

        $this->status = InvitationStatus::REVOKED;
        $this->revokedBy = $revokedBy;
        $this->revokedAt = $reference;

        $this->recordThat(new InvitationRevoked(
            invitationId: $this->id,
            revokedBy: $revokedBy,
            occurredAt: $reference
        ));
    }

    /**
     * Renew an expired or pending invitation with a new token and extended expiration.
     */
    public function renewToken(Token $newToken, ?DateTimeImmutable $now = null): void
    {
        if ($this->isAccepted()) {
            throw new DomainException('Nie można odnowić tokenu dla zaakceptowanego zaproszenia.');
        }

        if ($this->isRevoked()) {
            throw new DomainException('Nie można odnowić tokenu dla unieważnionego zaproszenia.');
        }

        $this->token = $newToken;
        $this->status = InvitationStatus::PENDING;

        $reference = $now ?? new DateTimeImmutable();
        $this->recordThat(new UserInvited(
            invitationId: $this->id,
            email: $this->email->value(),
            role: $this->role->name()->value,
            companyId: $this->companyId,
            assignedCompanyIds: $this->assignedCompanyIds,
            invitedBy: $this->invitedBy,
            token: $newToken->value(),
            expiresAt: $newToken->expiresAt(),
            occurredAt: $reference
        ));
    }
}
