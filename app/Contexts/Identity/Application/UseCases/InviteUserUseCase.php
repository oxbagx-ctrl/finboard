<?php

declare(strict_types=1);

namespace App\Contexts\Identity\Application\UseCases;

use App\Contexts\Identity\Application\Commands\InviteUserCommand;
use App\Contexts\Identity\Application\Exceptions\InvalidInvitationTargetException;
use App\Contexts\Identity\Application\Exceptions\UnauthorizedInvitationException;
use App\Contexts\Identity\Application\Exceptions\UserAlreadyExistsException;
use App\Contexts\Identity\Domain\Entities\Invitation;
use App\Contexts\Identity\Domain\Entities\Role;
use App\Contexts\Identity\Domain\Repositories\InvitationRepositoryInterface;
use App\Contexts\Identity\Domain\Repositories\UserRepositoryInterface;
use App\Contexts\Identity\Domain\ValueObjects\Email;
use App\Contexts\Identity\Domain\ValueObjects\InvitationId;
use App\Contexts\Identity\Domain\ValueObjects\Token;
use App\Contexts\Identity\Domain\ValueObjects\UserId;
use App\Contexts\Tenant\Domain\Repositories\CompanyAdvisorRepositoryInterface;
use App\Contexts\Tenant\Domain\Repositories\CompanyRepositoryInterface;
use App\Contexts\Tenant\Domain\ValueObjects\CompanyId;

final class InviteUserUseCase
{
    public function __construct(
        private readonly UserRepositoryInterface $userRepository,
        private readonly InvitationRepositoryInterface $invitationRepository,
        private readonly CompanyRepositoryInterface $companyRepository,
        private readonly CompanyAdvisorRepositoryInterface $companyAdvisorRepository
    ) {
    }

    /**
     * Issues an invitation with an expiring cryptographic token and records the UserInvited domain event.
     *
     * @throws UnauthorizedInvitationException If actor lacks sufficient permissions
     * @throws UserAlreadyExistsException If email is already registered
     * @throws InvalidInvitationTargetException If company is missing or invalid
     */
    public function execute(InviteUserCommand $command): Invitation
    {
        // 1. Authorize actor
        $actorId = UserId::fromString($command->invitedById);
        $actor = $this->userRepository->findById($actorId);

        if ($actor === null || !$actor->isActive()) {
            throw UnauthorizedInvitationException::actorInactive($command->invitedById);
        }

        if ($actor->isClient()) {
            throw UnauthorizedInvitationException::notAuthorized($actor->id());
        }

        $targetRole = Role::fromString($command->role);

        // Advisors can only invite Clients into companies they are assigned to
        if ($actor->isAdvisor()) {
            if (!$targetRole->isClient()) {
                throw UnauthorizedInvitationException::cannotInviteRole(
                    $actor->role()->name()->value,
                    $targetRole->name()->value
                );
            }

            if (empty($command->companyId)) {
                throw InvalidInvitationTargetException::companyRequiredForClient();
            }

            $targetCompanyId = CompanyId::fromString($command->companyId);
            if (!$this->companyAdvisorRepository->isAdvisorAssigned($targetCompanyId, $actor->userId())) {
                throw UnauthorizedInvitationException::advisorNotAssignedToCompany(
                    $actor->id(),
                    $command->companyId
                );
            }
        }

        // 2. Verify target email is not already registered as an active user
        $email = Email::fromString($command->email);
        if ($this->userRepository->findByEmail($email) !== null) {
            throw UserAlreadyExistsException::withEmail($command->email);
        }

        // 3. Validate company assignments
        if ($targetRole->isClient()) {
            if (empty($command->companyId)) {
                throw InvalidInvitationTargetException::companyRequiredForClient();
            }

            $targetCompanyId = CompanyId::fromString($command->companyId);
            if (!$this->companyRepository->exists($targetCompanyId)) {
                throw InvalidInvitationTargetException::companyNotFound($command->companyId);
            }
        }

        if ($targetRole->isAdvisor() && !empty($command->assignedCompanyIds)) {
            foreach ($command->assignedCompanyIds as $cid) {
                $compVo = CompanyId::fromString($cid);
                if (!$this->companyRepository->exists($compVo)) {
                    throw InvalidInvitationTargetException::companyNotFound($cid);
                }
            }
        }

        // 4. Invalidate any existing active pending invitation for this email address
        $existingPending = $this->invitationRepository->findPendingByEmail($email);
        if ($existingPending !== null) {
            $existingPending->revoke($actor->userId());
            $this->invitationRepository->save($existingPending);
        }

        // 5. Generate secure token and create domain aggregate
        $invitationId = InvitationId::generate();
        $validityHours = $command->validityHours ?? 48;
        $token = Token::generate($validityHours);

        $invitation = Invitation::create(
            id: $invitationId,
            email: $email,
            role: $targetRole,
            invitedBy: $actor->userId(),
            companyId: $command->companyId,
            assignedCompanyIds: $command->assignedCompanyIds,
            token: $token
        );

        // 6. Persist invitation (which dispatches UserInvited domain event)
        $this->invitationRepository->save($invitation);

        return $invitation;
    }
}
