<?php

declare(strict_types=1);

namespace App\Contexts\Tenant\Application\UseCases;

use App\Contexts\Identity\Domain\Entities\Role;
use App\Contexts\Identity\Domain\Repositories\UserRepositoryInterface;
use App\Contexts\Identity\Domain\ValueObjects\UserId;
use App\Contexts\Tenant\Application\Commands\RevokeAdvisorFromCompanyCommand;
use App\Contexts\Tenant\Application\Exceptions\UnauthorizedAssignmentException;
use App\Contexts\Tenant\Domain\Repositories\CompanyAdvisorRepositoryInterface;
use App\Contexts\Tenant\Domain\ValueObjects\CompanyId;

final class RevokeAdvisorFromCompanyUseCase
{
    public function __construct(
        private readonly CompanyAdvisorRepositoryInterface $companyAdvisorRepository,
        private readonly UserRepositoryInterface $userRepository
    ) {
    }

    /**
     * Revokes an Advisor from a Company with strict authorization checks.
     *
     * @throws UnauthorizedAssignmentException If actor lacks permissions
     */
    public function execute(RevokeAdvisorFromCompanyCommand $command): void
    {
        // 1. Authorize actor
        $actorId = UserId::fromString($command->revokedById);
        $actor = $this->userRepository->findById($actorId);

        if ($actor === null || !$actor->isActive()) {
            throw UnauthorizedAssignmentException::notAuthorized($command->revokedById);
        }

        if (!$actor->can(Role::PERM_ASSIGN_ADVISORS) && !$actor->isSuperAdmin() && !$actor->isAdmin()) {
            throw UnauthorizedAssignmentException::notAuthorized($actor->id());
        }

        $companyId = CompanyId::fromString($command->companyId);
        $advisorId = UserId::fromString($command->advisorId);

        // 2. Perform domain revocation
        $this->companyAdvisorRepository->revoke(
            companyId: $companyId,
            advisorId: $advisorId,
            revokedBy: $actorId
        );
    }
}
