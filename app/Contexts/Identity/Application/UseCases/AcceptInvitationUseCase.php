<?php

declare(strict_types=1);

namespace App\Contexts\Identity\Application\UseCases;

use App\Contexts\Identity\Application\Commands\AcceptInvitationCommand;
use App\Contexts\Identity\Application\Exceptions\PasswordConfirmationMismatchException;
use App\Contexts\Identity\Application\Exceptions\UserAlreadyExistsException;
use App\Contexts\Identity\Domain\Exceptions\InvalidInvitationTokenException;
use App\Contexts\Identity\Domain\Exceptions\InvitationAlreadyAcceptedException;
use App\Contexts\Identity\Domain\Exceptions\InvitationExpiredException;
use App\Contexts\Identity\Domain\Exceptions\InvitationRevokedException;
use App\Contexts\Identity\Domain\Model\User;
use App\Contexts\Identity\Domain\Repositories\InvitationRepositoryInterface;
use App\Contexts\Identity\Domain\Repositories\UserRepositoryInterface;
use App\Contexts\Identity\Domain\ValueObjects\HashedPassword;
use App\Contexts\Identity\Domain\ValueObjects\UserId;
use App\Contexts\Tenant\Domain\Entities\CompanyAdvisorAssignment;
use App\Contexts\Tenant\Domain\Repositories\CompanyAdvisorRepositoryInterface;
use App\Contexts\Tenant\Domain\ValueObjects\CompanyId;
use InvalidArgumentException;

final class AcceptInvitationUseCase
{
    public function __construct(
        private readonly InvitationRepositoryInterface $invitationRepository,
        private readonly UserRepositoryInterface $userRepository,
        private readonly CompanyAdvisorRepositoryInterface $companyAdvisorRepository
    ) {
    }

    /**
     * Validates the cryptographic invitation token, initializes the User account with a secure password,
     * configures advisor-company assignments, transitions invitation state to ACCEPTED, and records events.
     *
     * @throws InvalidInvitationTokenException
     * @throws InvitationExpiredException
     * @throws InvitationAlreadyAcceptedException
     * @throws InvitationRevokedException
     * @throws UserAlreadyExistsException
     * @throws PasswordConfirmationMismatchException
     * @throws InvalidArgumentException
     */
    public function execute(AcceptInvitationCommand $command): User
    {
        // 1. Basic command validation
        $rawToken = trim($command->token);
        if ($rawToken === '') {
            throw InvalidInvitationTokenException::notFound();
        }

        $trimmedName = trim($command->name);
        if ($trimmedName === '') {
            throw new InvalidArgumentException('Imię i nazwisko użytkownika nie mogą być puste.');
        }

        if ($command->passwordConfirmation !== null && $command->password !== $command->passwordConfirmation) {
            throw new PasswordConfirmationMismatchException();
        }

        // 2. Locate invitation by token
        $invitation = $this->invitationRepository->findByToken($rawToken);
        if ($invitation === null) {
            throw InvalidInvitationTokenException::notFound();
        }

        // 3. Ensure email has not been registered in the interim
        if ($this->userRepository->findByEmail($invitation->email()) !== null) {
            throw UserAlreadyExistsException::withEmail($invitation->email()->value());
        }

        // 4. Construct new User aggregate with secure hashed password
        $userId = UserId::generate();
        $hashedPassword = HashedPassword::fromPlainText($command->password);

        $user = User::register(
            id: $userId,
            name: $trimmedName,
            email: $invitation->email(),
            password: $hashedPassword,
            role: $invitation->role(),
            companyId: $invitation->companyId()
        );

        // 5. Accept invitation domain transition (checks expired/accepted/revoked status)
        $invitation->accept($user->id());

        // 6. Persist created user
        $this->userRepository->save($user);

        // 7. If invited as Advisor, provision designated company assignments
        if ($invitation->role()->isAdvisor() && !empty($invitation->assignedCompanyIds())) {
            foreach ($invitation->assignedCompanyIds() as $companyIdStr) {
                $assignment = CompanyAdvisorAssignment::create(
                    companyId: CompanyId::fromString($companyIdStr),
                    advisorId: $user->userId(),
                    assignedBy: $invitation->invitedBy()
                );
                $this->companyAdvisorRepository->assign($assignment);
            }
        }

        // 8. Persist updated invitation aggregate (emits InvitationAccepted domain event)
        $this->invitationRepository->save($invitation);

        return $user;
    }
}
