<?php

declare(strict_types=1);

namespace Tests\Unit\Identity;

use App\Contexts\Identity\Application\Commands\AcceptInvitationCommand;
use App\Contexts\Identity\Application\Exceptions\PasswordConfirmationMismatchException;
use App\Contexts\Identity\Application\Exceptions\UserAlreadyExistsException;
use App\Contexts\Identity\Application\UseCases\AcceptInvitationUseCase;
use App\Contexts\Identity\Domain\Entities\Invitation;
use App\Contexts\Identity\Domain\Entities\Role;
use App\Contexts\Identity\Domain\Exceptions\InvalidInvitationTokenException;
use App\Contexts\Identity\Domain\Exceptions\InvitationAlreadyAcceptedException;
use App\Contexts\Identity\Domain\Exceptions\InvitationExpiredException;
use App\Contexts\Identity\Domain\Exceptions\InvitationRevokedException;
use App\Contexts\Identity\Domain\Model\User;
use App\Contexts\Identity\Domain\Repositories\InvitationRepositoryInterface;
use App\Contexts\Identity\Domain\Repositories\UserRepositoryInterface;
use App\Contexts\Identity\Domain\ValueObjects\Email;
use App\Contexts\Identity\Domain\ValueObjects\HashedPassword;
use App\Contexts\Identity\Domain\ValueObjects\InvitationId;
use App\Contexts\Identity\Domain\ValueObjects\Token;
use App\Contexts\Identity\Domain\ValueObjects\UserId;
use App\Contexts\Tenant\Domain\Entities\CompanyAdvisorAssignment;
use App\Contexts\Tenant\Domain\Repositories\CompanyAdvisorRepositoryInterface;
use App\Contexts\Tenant\Domain\ValueObjects\CompanyId;
use DateTimeImmutable;
use InvalidArgumentException;
use PHPUnit\Framework\TestCase;

final class AcceptInvitationUseCaseTest extends TestCase
{
    private InvitationRepositoryInterface $invitationRepository;
    private UserRepositoryInterface $userRepository;
    private CompanyAdvisorRepositoryInterface $companyAdvisorRepository;
    private AcceptInvitationUseCase $useCase;

    /** @var array<string, Invitation> */
    private array $invitations = [];
    /** @var array<string, User> */
    private array $users = [];
    /** @var array<string, CompanyAdvisorAssignment> */
    private array $assignments = [];

    protected function setUp(): void
    {
        parent::setUp();

        $this->invitations = [];
        $this->users = [];
        $this->assignments = [];

        $this->invitationRepository = new class($this->invitations) implements InvitationRepositoryInterface {
            public function __construct(private array &$invitations) {}
            public function findById(InvitationId $id): ?Invitation { return $this->invitations[$id->value()] ?? null; }
            public function findByToken(string $token): ?Invitation {
                foreach ($this->invitations as $invitation) {
                    if ($invitation->token()->value() === $token) return $invitation;
                }
                return null;
            }
            public function findPendingByEmail(Email $email): ?Invitation {
                foreach ($this->invitations as $invitation) {
                    if ($invitation->email()->equals($email) && $invitation->isPending()) return $invitation;
                }
                return null;
            }
            public function save(Invitation $invitation): void { $this->invitations[$invitation->id()] = $invitation; }
            public function delete(InvitationId $id): void { unset($this->invitations[$id->value()]); }
            public function findAll(): array { return array_values($this->invitations); }
            public function findPending(): array { return array_values(array_filter($this->invitations, fn($i) => $i->isPending())); }
            public function findByCompanyId(string $companyId): array { return []; }
            public function findByInvitedBy(UserId $userId): array { return []; }
        };

        $this->userRepository = new class($this->users) implements UserRepositoryInterface {
            public function __construct(private array &$users) {}
            public function findById(UserId $id): ?User { return $this->users[$id->value()] ?? null; }
            public function findByEmail(Email $email): ?User {
                foreach ($this->users as $u) {
                    if ($u->email()->equals($email)) return $u;
                }
                return null;
            }
            public function save(User $user): void { $this->users[$user->id()] = $user; }
            public function delete(UserId $id): void { unset($this->users[$id->value()]); }
            public function findByCompanyId(string $companyId): array { return []; }
            public function all(): array { return array_values($this->users); }
        };

        $this->companyAdvisorRepository = new class($this->assignments) implements CompanyAdvisorRepositoryInterface {
            public function __construct(private array &$assignments) {}
            public function assign(CompanyAdvisorAssignment $assignment): void {
                $key = "{$assignment->companyId()->value()}:{$assignment->advisorId()->value()}";
                $this->assignments[$key] = $assignment;
            }
            public function revoke(CompanyId $companyId, UserId $advisorId, ?UserId $revokedBy = null): void {
                unset($this->assignments["{$companyId->value()}:{$advisorId->value()}"]);
            }
            public function isAdvisorAssigned(CompanyId $companyId, UserId $advisorId): bool {
                return isset($this->assignments["{$companyId->value()}:{$advisorId->value()}"]);
            }
            public function findCompanyIdsByAdvisor(UserId $advisorId): array { return []; }
            public function findAdvisorIdsByCompany(CompanyId $companyId): array { return []; }
        };

        $this->useCase = new AcceptInvitationUseCase(
            invitationRepository: $this->invitationRepository,
            userRepository: $this->userRepository,
            companyAdvisorRepository: $this->companyAdvisorRepository
        );
    }

    private function createPendingInvitation(
        string $email = 'invitee@acme.com',
        string $role = 'client',
        ?string $companyId = '11111111-1111-1111-1111-111111111111',
        array $assignedCompanyIds = []
    ): Invitation {
        $invitation = Invitation::create(
            id: InvitationId::generate(),
            email: Email::fromString($email),
            role: Role::fromString($role),
            invitedBy: UserId::generate(),
            companyId: $companyId,
            assignedCompanyIds: $assignedCompanyIds
        );
        $this->invitationRepository->save($invitation);
        return $invitation;
    }

    public function test_empty_token_throws_not_found(): void
    {
        $this->expectException(InvalidInvitationTokenException::class);
        $this->useCase->execute(new AcceptInvitationCommand(
            token: '   ',
            name: 'Kamil Wiśniewski',
            password: 'SecurePassword123!'
        ));
    }

    public function test_empty_name_throws_invalid_argument(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->useCase->execute(new AcceptInvitationCommand(
            token: 'validtoken1234567890abcdef1234567890abcdef',
            name: '   ',
            password: 'SecurePassword123!'
        ));
    }

    public function test_password_mismatch_throws_exception(): void
    {
        $this->expectException(PasswordConfirmationMismatchException::class);
        $this->useCase->execute(new AcceptInvitationCommand(
            token: 'validtoken1234567890abcdef1234567890abcdef',
            name: 'Kamil Wiśniewski',
            password: 'SecurePassword123!',
            passwordConfirmation: 'DifferentPassword123!'
        ));
    }

    public function test_non_existent_token_throws_not_found(): void
    {
        $this->expectException(InvalidInvitationTokenException::class);
        $this->useCase->execute(new AcceptInvitationCommand(
            token: 'non_existent_token_1234567890abcdef12345678',
            name: 'Kamil Wiśniewski',
            password: 'SecurePassword123!',
            passwordConfirmation: 'SecurePassword123!'
        ));
    }

    public function test_already_registered_user_throws_exception(): void
    {
        $invitation = $this->createPendingInvitation('existing@acme.com');

        // Pre-register user with same email
        $existingUser = User::register(
            UserId::generate(),
            'Existing User',
            Email::fromString('existing@acme.com'),
            HashedPassword::fromPlainText('oldpassword123'),
            Role::client()
        );
        $this->userRepository->save($existingUser);

        $this->expectException(UserAlreadyExistsException::class);
        $this->useCase->execute(new AcceptInvitationCommand(
            token: $invitation->token()->value(),
            name: 'Existing User',
            password: 'SecurePassword123!'
        ));
    }

    public function test_expired_token_throws_exception(): void
    {
        $expiredToken = new Token(
            'expiredtoken1234567890abcdef1234567890',
            (new DateTimeImmutable())->modify('-2 hours')
        );

        $invitation = Invitation::create(
            id: InvitationId::generate(),
            email: Email::fromString('expired@acme.com'),
            role: Role::client(),
            invitedBy: UserId::generate(),
            companyId: '11111111-1111-1111-1111-111111111111',
            assignedCompanyIds: [],
            token: $expiredToken
        );
        $this->invitationRepository->save($invitation);

        $this->expectException(InvitationExpiredException::class);
        $this->useCase->execute(new AcceptInvitationCommand(
            token: $expiredToken->value(),
            name: 'Expired Invitee',
            password: 'SecurePassword123!'
        ));
    }

    public function test_already_accepted_invitation_throws_exception(): void
    {
        $invitation = $this->createPendingInvitation('accepted@acme.com');
        $invitation->accept('some-user-id');
        $this->invitationRepository->save($invitation);

        $this->expectException(InvitationAlreadyAcceptedException::class);
        $this->useCase->execute(new AcceptInvitationCommand(
            token: $invitation->token()->value(),
            name: 'Second Acceptor',
            password: 'SecurePassword123!'
        ));
    }

    public function test_revoked_invitation_throws_exception(): void
    {
        $invitation = $this->createPendingInvitation('revoked@acme.com');
        $invitation->revoke(UserId::generate());
        $this->invitationRepository->save($invitation);

        $this->expectException(InvitationRevokedException::class);
        $this->useCase->execute(new AcceptInvitationCommand(
            token: $invitation->token()->value(),
            name: 'Revoked Invitee',
            password: 'SecurePassword123!'
        ));
    }

    public function test_successful_client_acceptance_registers_user_and_marks_invitation_accepted(): void
    {
        $companyId = '11111111-1111-1111-1111-111111111111';
        $invitation = $this->createPendingInvitation(
            email: 'new.cfo@acme.com',
            role: 'client',
            companyId: $companyId
        );

        $command = new AcceptInvitationCommand(
            token: $invitation->token()->value(),
            name: 'Tomasz Lis',
            password: 'SecurePassword123!',
            passwordConfirmation: 'SecurePassword123!'
        );

        $user = $this->useCase->execute($command);

        $this->assertInstanceOf(User::class, $user);
        $this->assertSame('Tomasz Lis', $user->name());
        $this->assertSame('new.cfo@acme.com', $user->email()->value());
        $this->assertTrue($user->role()->isClient());
        $this->assertSame($companyId, $user->companyId());
        $this->assertTrue($user->password()->verify('SecurePassword123!'));

        // Check invitation aggregate state
        $updatedInvitation = $this->invitationRepository->findById($invitation->invitationId());
        $this->assertNotNull($updatedInvitation);
        $this->assertTrue($updatedInvitation->isAccepted());
        $this->assertNotNull($updatedInvitation->acceptedAt());
    }

    public function test_successful_advisor_acceptance_assigns_designated_companies(): void
    {
        $company1 = '11111111-1111-1111-1111-111111111111';
        $company2 = '22222222-2222-2222-2222-222222222222';

        $invitation = $this->createPendingInvitation(
            email: 'new.advisor@dealcorp.com',
            role: 'advisor',
            companyId: null,
            assignedCompanyIds: [$company1, $company2]
        );

        $command = new AcceptInvitationCommand(
            token: $invitation->token()->value(),
            name: 'Anna Doradca',
            password: 'StrongAdvisorPass123#'
        );

        $user = $this->useCase->execute($command);

        $this->assertTrue($user->role()->isAdvisor());
        $this->assertNull($user->companyId());

        // Check assignments
        $this->assertTrue(
            $this->companyAdvisorRepository->isAdvisorAssigned(CompanyId::fromString($company1), $user->userId())
        );
        $this->assertTrue(
            $this->companyAdvisorRepository->isAdvisorAssigned(CompanyId::fromString($company2), $user->userId())
        );
    }
}
