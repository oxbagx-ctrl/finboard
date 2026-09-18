<?php

declare(strict_types=1);

namespace Tests\Unit\Identity;

use App\Contexts\Identity\Application\Commands\InviteUserCommand;
use App\Contexts\Identity\Application\Exceptions\InvalidInvitationTargetException;
use App\Contexts\Identity\Application\Exceptions\UnauthorizedInvitationException;
use App\Contexts\Identity\Application\Exceptions\UserAlreadyExistsException;
use App\Contexts\Identity\Application\UseCases\InviteUserUseCase;
use App\Contexts\Identity\Domain\Entities\Invitation;
use App\Contexts\Identity\Domain\Entities\Role;
use App\Contexts\Identity\Domain\Events\UserInvited;
use App\Contexts\Identity\Domain\Model\User;
use App\Contexts\Identity\Domain\Repositories\InvitationRepositoryInterface;
use App\Contexts\Identity\Domain\Repositories\UserRepositoryInterface;
use App\Contexts\Identity\Domain\ValueObjects\Email;
use App\Contexts\Identity\Domain\ValueObjects\HashedPassword;
use App\Contexts\Identity\Domain\ValueObjects\InvitationId;
use App\Contexts\Identity\Domain\ValueObjects\InvitationStatus;
use App\Contexts\Identity\Domain\ValueObjects\UserId;
use App\Contexts\Tenant\Domain\Repositories\CompanyAdvisorRepositoryInterface;
use App\Contexts\Tenant\Domain\Repositories\CompanyRepositoryInterface;
use App\Contexts\Tenant\Domain\ValueObjects\CompanyId;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;

final class InviteUserUseCaseTest extends TestCase
{
    private const COMPANY_A = '11111111-1111-1111-1111-111111111111';
    private const COMPANY_B = '22222222-2222-2222-2222-222222222222';

    private UserRepositoryInterface&MockObject $userRepository;
    private InvitationRepositoryInterface&MockObject $invitationRepository;
    private CompanyRepositoryInterface&MockObject $companyRepository;
    private CompanyAdvisorRepositoryInterface&MockObject $companyAdvisorRepository;
    private InviteUserUseCase $useCase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->userRepository = $this->createMock(UserRepositoryInterface::class);
        $this->invitationRepository = $this->createMock(InvitationRepositoryInterface::class);
        $this->companyRepository = $this->createMock(CompanyRepositoryInterface::class);
        $this->companyAdvisorRepository = $this->createMock(CompanyAdvisorRepositoryInterface::class);

        $this->useCase = new InviteUserUseCase(
            $this->userRepository,
            $this->invitationRepository,
            $this->companyRepository,
            $this->companyAdvisorRepository
        );
    }

    public function test_superadmin_can_invite_client(): void
    {
        $admin = $this->createUser('super_admin');
        $this->userRepository->method('findById')->willReturn($admin);
        $this->userRepository->method('findByEmail')->willReturn(null);
        $this->companyRepository->method('exists')->willReturn(true);

        $this->invitationRepository
            ->expects($this->once())
            ->method('save')
            ->with($this->callback(function (Invitation $invitation) {
                return $invitation->email()->value() === 'new.client@corp.com'
                    && $invitation->role()->isClient()
                    && $invitation->companyId() === self::COMPANY_A
                    && $invitation->status() === InvitationStatus::PENDING;
            }));

        $command = new InviteUserCommand(
            invitedById: $admin->id(),
            email: 'new.client@corp.com',
            role: 'client',
            companyId: self::COMPANY_A
        );

        $invitation = $this->useCase->execute($command);

        $this->assertSame('new.client@corp.com', $invitation->email()->value());
        $this->assertSame(self::COMPANY_A, $invitation->companyId());
    }

    public function test_superadmin_can_invite_advisor_with_assigned_companies(): void
    {
        $admin = $this->createUser('super_admin');
        $this->userRepository->method('findById')->willReturn($admin);
        $this->userRepository->method('findByEmail')->willReturn(null);
        $this->companyRepository->method('exists')->willReturn(true);

        $this->invitationRepository
            ->expects($this->once())
            ->method('save');

        $command = new InviteUserCommand(
            invitedById: $admin->id(),
            email: 'new.advisor@helvest.com',
            role: 'advisor',
            assignedCompanyIds: [self::COMPANY_A, self::COMPANY_B]
        );

        $invitation = $this->useCase->execute($command);

        $this->assertSame('new.advisor@helvest.com', $invitation->email()->value());
        $this->assertTrue($invitation->role()->isAdvisor());
        $this->assertContains(self::COMPANY_A, $invitation->assignedCompanyIds());
        $this->assertContains(self::COMPANY_B, $invitation->assignedCompanyIds());
    }

    public function test_advisor_can_invite_client_to_assigned_company(): void
    {
        $advisor = $this->createUser('advisor');
        $this->userRepository->method('findById')->willReturn($advisor);
        $this->userRepository->method('findByEmail')->willReturn(null);
        $this->companyRepository->method('exists')->willReturn(true);
        $this->companyAdvisorRepository
            ->method('isAdvisorAssigned')
            ->with(CompanyId::fromString(self::COMPANY_A), $advisor->userId())
            ->willReturn(true);

        $this->invitationRepository
            ->expects($this->once())
            ->method('save');

        $command = new InviteUserCommand(
            invitedById: $advisor->id(),
            email: 'client.cfo@corp.com',
            role: 'client',
            companyId: self::COMPANY_A
        );

        $invitation = $this->useCase->execute($command);

        $this->assertSame('client.cfo@corp.com', $invitation->email()->value());
        $this->assertSame(self::COMPANY_A, $invitation->companyId());
    }

    public function test_advisor_cannot_invite_client_to_unassigned_company(): void
    {
        $advisor = $this->createUser('advisor');
        $this->userRepository->method('findById')->willReturn($advisor);
        $this->userRepository->method('findByEmail')->willReturn(null);
        $this->companyAdvisorRepository
            ->method('isAdvisorAssigned')
            ->willReturn(false);

        $this->expectException(UnauthorizedInvitationException::class);
        $this->expectExceptionMessage('nie jest przypisany do spółki');

        $command = new InviteUserCommand(
            invitedById: $advisor->id(),
            email: 'client.cfo@corp.com',
            role: 'client',
            companyId: self::COMPANY_A
        );

        $this->useCase->execute($command);
    }

    public function test_advisor_cannot_invite_superadmin_or_advisor(): void
    {
        $advisor = $this->createUser('advisor');
        $this->userRepository->method('findById')->willReturn($advisor);

        $this->expectException(UnauthorizedInvitationException::class);
        $this->expectExceptionMessage('nie ma uprawnień do zapraszania użytkowników na poziomie');

        $command = new InviteUserCommand(
            invitedById: $advisor->id(),
            email: 'partner@helvest.com',
            role: 'super_admin'
        );

        $this->useCase->execute($command);
    }

    public function test_client_cannot_invite_anyone(): void
    {
        $client = $this->createUser('client');
        $this->userRepository->method('findById')->willReturn($client);

        $this->expectException(UnauthorizedInvitationException::class);

        $command = new InviteUserCommand(
            invitedById: $client->id(),
            email: 'someone@corp.com',
            role: 'client',
            companyId: self::COMPANY_A
        );

        $this->useCase->execute($command);
    }

    public function test_inactive_actor_throws_unauthorized_exception(): void
    {
        $inactiveAdmin = $this->createUser('super_admin', isActive: false);
        $this->userRepository->method('findById')->willReturn($inactiveAdmin);

        $this->expectException(UnauthorizedInvitationException::class);
        $this->expectExceptionMessage('jest nieaktywny');

        $command = new InviteUserCommand(
            invitedById: $inactiveAdmin->id(),
            email: 'user@corp.com',
            role: 'client',
            companyId: self::COMPANY_A
        );

        $this->useCase->execute($command);
    }

    public function test_already_registered_user_throws_exception(): void
    {
        $admin = $this->createUser('super_admin');
        $existingUser = $this->createUser('client', email: 'existing@corp.com');

        $this->userRepository->method('findById')->willReturn($admin);
        $this->userRepository->method('findByEmail')->willReturn($existingUser);

        $this->expectException(UserAlreadyExistsException::class);
        $this->expectExceptionMessage('już istnieje w systemie');

        $command = new InviteUserCommand(
            invitedById: $admin->id(),
            email: 'existing@corp.com',
            role: 'client',
            companyId: self::COMPANY_A
        );

        $this->useCase->execute($command);
    }

    public function test_client_invitation_without_company_throws_exception(): void
    {
        $admin = $this->createUser('super_admin');
        $this->userRepository->method('findById')->willReturn($admin);
        $this->userRepository->method('findByEmail')->willReturn(null);

        $this->expectException(InvalidInvitationTargetException::class);
        $this->expectExceptionMessage('wymagane jest podanie spółki');

        $command = new InviteUserCommand(
            invitedById: $admin->id(),
            email: 'client@corp.com',
            role: 'client',
            companyId: null
        );

        $this->useCase->execute($command);
    }

    public function test_non_existent_company_throws_exception(): void
    {
        $admin = $this->createUser('super_admin');
        $this->userRepository->method('findById')->willReturn($admin);
        $this->userRepository->method('findByEmail')->willReturn(null);
        $this->companyRepository->method('exists')->willReturn(false);

        $this->expectException(InvalidInvitationTargetException::class);
        $this->expectExceptionMessage('nie istnieje w systemie');

        $command = new InviteUserCommand(
            invitedById: $admin->id(),
            email: 'client@corp.com',
            role: 'client',
            companyId: '33333333-3333-3333-3333-333333333333'
        );

        $this->useCase->execute($command);
    }

    public function test_reinviting_email_revokes_previous_pending_invitation(): void
    {
        $admin = $this->createUser('super_admin');
        $this->userRepository->method('findById')->willReturn($admin);
        $this->userRepository->method('findByEmail')->willReturn(null);
        $this->companyRepository->method('exists')->willReturn(true);

        $oldPendingInvitation = Invitation::create(
            id: InvitationId::generate(),
            email: Email::fromString('target@corp.com'),
            role: Role::client(),
            invitedBy: $admin->userId(),
            companyId: self::COMPANY_A
        );

        $this->invitationRepository
            ->method('findPendingByEmail')
            ->willReturn($oldPendingInvitation);

        // Expect two save calls: 1st for revoked old invitation, 2nd for new invitation
        $savedInvitations = [];
        $this->invitationRepository
            ->expects($this->exactly(2))
            ->method('save')
            ->willReturnCallback(function (Invitation $inv) use (&$savedInvitations) {
                $savedInvitations[] = $inv;
            });

        $command = new InviteUserCommand(
            invitedById: $admin->id(),
            email: 'target@corp.com',
            role: 'client',
            companyId: self::COMPANY_A
        );

        $newInvitation = $this->useCase->execute($command);

        $this->assertTrue($oldPendingInvitation->isRevoked());
        $this->assertSame(InvitationStatus::REVOKED, $oldPendingInvitation->status());
        $this->assertTrue($newInvitation->isPending());
        $this->assertNotSame($oldPendingInvitation->id(), $newInvitation->id());
        $this->assertCount(2, $savedInvitations);
    }

    private function createUser(string $role, bool $isActive = true, string $email = 'actor@helvest.com'): User
    {
        return new User(
            id: UserId::generate(),
            name: 'Test Actor',
            email: Email::fromString($email),
            password: HashedPassword::fromPlainText('password123'),
            role: Role::fromString($role),
            companyId: self::COMPANY_A,
            isActive: $isActive
        );
    }
}
