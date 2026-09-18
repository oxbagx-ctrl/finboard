<?php

declare(strict_types=1);

namespace App\Contexts\Tenant\Application\UseCases;

use App\Contexts\Identity\Domain\Entities\Role;
use App\Contexts\Identity\Domain\Repositories\UserRepositoryInterface;
use App\Contexts\Identity\Domain\ValueObjects\UserId;
use App\Contexts\Tenant\Application\Commands\AssignAdvisorToCompanyCommand;
use App\Contexts\Tenant\Application\Exceptions\AdvisorNotFoundException;
use App\Contexts\Tenant\Application\Exceptions\CompanyNotFoundException;
use App\Contexts\Tenant\Application\Exceptions\TargetUserNotAdvisorException;
use App\Contexts\Tenant\Application\Exceptions\UnauthorizedAssignmentException;
use App\Contexts\Tenant\Domain\Entities\CompanyAdvisorAssignment;
use App\Contexts\Tenant\Domain\Repositories\CompanyAdvisorRepositoryInterface;
use App\Contexts\Tenant\Domain\Repositories\CompanyRepositoryInterface;
use App\Contexts\Tenant\Domain\ValueObjects\CompanyId;
use DomainException;

final class AssignAdvisorToCompanyUseCase
{
    public function __construct(
        private readonly CompanyAdvisorRepositoryInterface $companyAdvisorRepository,
        private readonly UserRepositoryInterface $userRepository,
        private readonly CompanyRepositoryInterface $companyRepository
    ) {
    }

    /**
     * Assigns an Advisor to a designated Company with strict authorization and role verification.
     *
     * @throws UnauthorizedAssignmentException If actor lacks permissions (must be SuperAdmin or have assign_advisors permission)
     * @throws CompanyNotFoundException If the target company does not exist
     * @throws AdvisorNotFoundException If the target user does not exist
     * @throws TargetUserNotAdvisorException If the target user does not have an Advisor/Admin role
     * @throws DomainException If advisor or actor is inactive
     */
    public function execute(AssignAdvisorToCompanyCommand $command): CompanyAdvisorAssignment
    {
        // 1. Authorize actor
        $actorId = UserId::fromString($command->assignedById);
        $actor = $this->userRepository->findById($actorId);

        if ($actor === null || !$actor->isActive()) {
            throw UnauthorizedAssignmentException::notAuthorized($command->assignedById);
        }

        if (!$actor->can(Role::PERM_ASSIGN_ADVISORS) && !$actor->isSuperAdmin() && !$actor->isAdmin()) {
            throw UnauthorizedAssignmentException::notAuthorized($actor->id());
        }

        // 2. Verify target company exists
        $companyId = CompanyId::fromString($command->companyId);
        if (!$this->companyRepository->exists($companyId)) {
            throw CompanyNotFoundException::withId($command->companyId);
        }

        // 3. Verify target advisor exists and is active
        $advisorId = UserId::fromString($command->advisorId);
        $advisor = $this->userRepository->findById($advisorId);

        if ($advisor === null) {
            throw AdvisorNotFoundException::withId($command->advisorId);
        }

        if (!$advisor->isActive()) {
            throw new DomainException(sprintf('Advisor "%s" is inactive.', $advisor->id()));
        }

        // 4. Strict role check: Target user MUST be an Advisor (or Admin/SuperAdmin)
        if (!$advisor->isAdvisor() && !$advisor->isAdmin() && !$advisor->isSuperAdmin()) {
            throw TargetUserNotAdvisorException::forUser(
                $advisor->id(),
                $advisor->role()->name()->value
            );
        }

        // 5. Create domain assignment aggregate and record event
        $assignment = CompanyAdvisorAssignment::create(
            companyId: $companyId,
            advisorId: $advisorId,
            assignedBy: $actorId
        );

        // 6. Persist assignment
        $this->companyAdvisorRepository->assign($assignment);

        return $assignment;
    }
}
