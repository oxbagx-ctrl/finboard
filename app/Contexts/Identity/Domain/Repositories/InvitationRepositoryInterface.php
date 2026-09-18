<?php

declare(strict_types=1);

namespace App\Contexts\Identity\Domain\Repositories;

use App\Contexts\Identity\Domain\Entities\Invitation;
use App\Contexts\Identity\Domain\ValueObjects\Email;
use App\Contexts\Identity\Domain\ValueObjects\InvitationId;
use App\Contexts\Identity\Domain\ValueObjects\UserId;

interface InvitationRepositoryInterface
{
    /**
     * Find an invitation by its unique identifier.
     */
    public function findById(InvitationId $id): ?Invitation;

    /**
     * Find an invitation by its raw token string.
     */
    public function findByToken(string $token): ?Invitation;

    /**
     * Find the active pending invitation for an email address, if any.
     */
    public function findPendingByEmail(Email $email): ?Invitation;

    /**
     * Persist the invitation aggregate and dispatch any recorded domain events.
     */
    public function save(Invitation $invitation): void;

    /**
     * Delete an invitation by identifier.
     */
    public function delete(InvitationId $id): void;

    /**
     * Return all invitations.
     *
     * @return array<Invitation>
     */
    public function findAll(): array;

    /**
     * Return all pending invitations.
     *
     * @return array<Invitation>
     */
    public function findPending(): array;

    /**
     * Find all invitations associated with a given company.
     *
     * @return array<Invitation>
     */
    public function findByCompanyId(string $companyId): array;

    /**
     * Find all invitations issued by a specific user.
     *
     * @return array<Invitation>
     */
    public function findByInvitedBy(UserId $userId): array;
}
