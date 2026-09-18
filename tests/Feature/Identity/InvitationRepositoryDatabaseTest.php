<?php

declare(strict_types=1);

namespace Tests\Feature\Identity;

use App\Contexts\Identity\Domain\Entities\Invitation;
use App\Contexts\Identity\Domain\Entities\Role;
use App\Contexts\Identity\Domain\Events\InvitationAccepted;
use App\Contexts\Identity\Domain\Events\UserInvited;
use App\Contexts\Identity\Domain\Repositories\InvitationRepositoryInterface;
use App\Contexts\Identity\Domain\ValueObjects\Email;
use App\Contexts\Identity\Domain\ValueObjects\InvitationId;
use App\Contexts\Identity\Domain\ValueObjects\InvitationStatus;
use App\Contexts\Identity\Domain\ValueObjects\Token;
use App\Contexts\Identity\Domain\ValueObjects\UserId;
use App\Models\Company;
use App\Models\User;
use DateTimeImmutable;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

final class InvitationRepositoryDatabaseTest extends TestCase
{
    use DatabaseTransactions;

    private InvitationRepositoryInterface $repository;
    private User $adminUser;
    private Company $companyA;
    private Company $companyB;

    protected function setUp(): void
    {
        parent::setUp();

        $this->repository = $this->app->make(InvitationRepositoryInterface::class);

        $this->adminUser = User::firstOrCreate(
            ['email' => 'admin@helvest.com'],
            [
                'name' => 'Admin User',
                'password' => bcrypt('password123'),
                'role' => 'super_admin',
                'is_active' => true,
            ]
        );

        $this->companyA = Company::firstOrCreate(
            ['code' => 'ACME'],
            ['name' => 'Acme Manufacturing S.A.']
        );

        $this->companyB = Company::firstOrCreate(
            ['code' => 'HELVEST'],
            ['name' => 'Helvest Advisory Sp. z o.o.']
        );
    }

    public function test_invitation_can_be_persisted_and_retrieved_by_id(): void
    {
        $id = InvitationId::generate();
        $email = Email::fromString('new.client@acme.com');
        $role = Role::client();
        $invitedBy = UserId::fromString((string) $this->adminUser->id);

        $invitation = Invitation::create(
            id: $id,
            email: $email,
            role: $role,
            invitedBy: $invitedBy,
            companyId: (string) $this->companyA->id
        );

        $this->repository->save($invitation);

        $loaded = $this->repository->findById($id);

        $this->assertNotNull($loaded);
        $this->assertSame($id->value(), $loaded->id());
        $this->assertSame('new.client@acme.com', $loaded->email()->value());
        $this->assertSame('client', $loaded->role()->name()->value);
        $this->assertSame((string) $this->companyA->id, $loaded->companyId());
        $this->assertSame((string) $this->adminUser->id, $loaded->invitedBy()->value());
        $this->assertSame(InvitationStatus::PENDING, $loaded->status());
        $this->assertTrue($loaded->isPending());
    }

    public function test_invitation_can_be_retrieved_by_token(): void
    {
        $id = InvitationId::generate();
        $email = Email::fromString('token.user@domain.com');
        $role = Role::client();
        $invitedBy = UserId::fromString((string) $this->adminUser->id);

        $invitation = Invitation::create(
            id: $id,
            email: $email,
            role: $role,
            invitedBy: $invitedBy,
            companyId: (string) $this->companyA->id
        );

        $tokenValue = $invitation->token()->value();
        $this->repository->save($invitation);

        $loaded = $this->repository->findByToken($tokenValue);

        $this->assertNotNull($loaded);
        $this->assertSame($id->value(), $loaded->id());
        $this->assertTrue($loaded->verifyToken($tokenValue));

        $this->assertNull($this->repository->findByToken('non_existent_token_1234567890abcdef'));
    }

    public function test_find_pending_by_email_returns_only_active_pending_invitation(): void
    {
        $id = InvitationId::generate();
        $email = Email::fromString('active.pending@domain.com');
        $role = Role::client();
        $invitedBy = UserId::fromString((string) $this->adminUser->id);

        $invitation = Invitation::create(
            id: $id,
            email: $email,
            role: $role,
            invitedBy: $invitedBy,
            companyId: (string) $this->companyA->id
        );

        $this->repository->save($invitation);

        $found = $this->repository->findPendingByEmail($email);
        $this->assertNotNull($found);
        $this->assertSame($id->value(), $found->id());

        // Revoking marks it not pending
        $found->revoke($invitedBy);
        $this->repository->save($found);

        $this->assertNull($this->repository->findPendingByEmail($email));
    }

    public function test_advisor_invitation_persists_assigned_companies_array(): void
    {
        $id = InvitationId::generate();
        $email = Email::fromString('advisor.invite@helvest.com');
        $role = Role::advisor();
        $invitedBy = UserId::fromString((string) $this->adminUser->id);

        $assignedCompanies = [
            (string) $this->companyA->id,
            (string) $this->companyB->id,
        ];

        $invitation = Invitation::create(
            id: $id,
            email: $email,
            role: $role,
            invitedBy: $invitedBy,
            companyId: (string) $this->companyA->id,
            assignedCompanyIds: $assignedCompanies
        );

        $this->repository->save($invitation);

        $loaded = $this->repository->findById($id);
        $this->assertNotNull($loaded);
        $this->assertContains((string) $this->companyA->id, $loaded->assignedCompanyIds());
        $this->assertContains((string) $this->companyB->id, $loaded->assignedCompanyIds());
    }

    public function test_accept_invitation_updates_database_and_dispatches_event(): void
    {
        Event::fake([UserInvited::class, InvitationAccepted::class]);
        $repository = $this->app->make(InvitationRepositoryInterface::class);

        $id = InvitationId::generate();
        $email = Email::fromString('accept.me@acme.com');
        $role = Role::client();
        $invitedBy = UserId::fromString((string) $this->adminUser->id);

        $invitation = Invitation::create(
            id: $id,
            email: $email,
            role: $role,
            invitedBy: $invitedBy,
            companyId: (string) $this->companyA->id
        );

        $repository->save($invitation);
        Event::assertDispatched(UserInvited::class);

        $loaded = $repository->findById($id);
        $this->assertNotNull($loaded);

        $loaded->accept(UserId::generate()->value());
        $repository->save($loaded);

        Event::assertDispatched(InvitationAccepted::class);

        $reloaded = $repository->findById($id);
        $this->assertNotNull($reloaded);
        $this->assertTrue($reloaded->isAccepted());
        $this->assertNotNull($reloaded->acceptedAt());
    }

    public function test_find_by_company_id_and_invited_by(): void
    {
        $id = InvitationId::generate();
        $email = Email::fromString('filter.test@acme.com');
        $role = Role::client();
        $invitedBy = UserId::fromString((string) $this->adminUser->id);

        $invitation = Invitation::create(
            id: $id,
            email: $email,
            role: $role,
            invitedBy: $invitedBy,
            companyId: (string) $this->companyA->id
        );

        $this->repository->save($invitation);

        $companyInvitations = $this->repository->findByCompanyId((string) $this->companyA->id);
        $this->assertNotEmpty($companyInvitations);
        $this->assertTrue(collect($companyInvitations)->contains(fn (Invitation $i) => $i->id() === $id->value()));

        $userInvitations = $this->repository->findByInvitedBy($invitedBy);
        $this->assertNotEmpty($userInvitations);
        $this->assertTrue(collect($userInvitations)->contains(fn (Invitation $i) => $i->id() === $id->value()));
    }

    public function test_delete_invitation(): void
    {
        $id = InvitationId::generate();
        $email = Email::fromString('delete.me@acme.com');
        $role = Role::client();
        $invitedBy = UserId::fromString((string) $this->adminUser->id);

        $invitation = Invitation::create(
            id: $id,
            email: $email,
            role: $role,
            invitedBy: $invitedBy,
            companyId: (string) $this->companyA->id
        );

        $this->repository->save($invitation);
        $this->assertNotNull($this->repository->findById($id));

        $this->repository->delete($id);
        $this->assertNull($this->repository->findById($id));
    }
}
