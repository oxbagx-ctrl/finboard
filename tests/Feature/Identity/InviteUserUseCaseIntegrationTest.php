<?php

declare(strict_types=1);

namespace Tests\Feature\Identity;

use App\Contexts\Identity\Application\Commands\InviteUserCommand;
use App\Contexts\Identity\Application\UseCases\InviteUserUseCase;
use App\Contexts\Identity\Domain\Events\UserInvited;
use App\Models\Company;
use App\Models\Invitation as InvitationModel;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

final class InviteUserUseCaseIntegrationTest extends TestCase
{
    use DatabaseTransactions;

    private InviteUserUseCase $useCase;
    private User $adminUser;
    private User $advisorUser;
    private Company $companyA;
    private Company $companyB;

    protected function setUp(): void
    {
        parent::setUp();

        $this->useCase = $this->app->make(InviteUserUseCase::class);

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

        $this->advisorUser = User::create([
            'name' => 'Advisor Partner',
            'email' => 'partner.advisor@helvest.com',
            'password' => bcrypt('password123'),
            'role' => 'advisor',
            'is_active' => true,
        ]);

        // Assign advisor to company A
        $this->advisorUser->assignedCompanies()->attach($this->companyA->id, [
            'assigned_by' => $this->adminUser->id,
        ]);
    }

    public function test_superadmin_inviting_client_persists_in_db_and_dispatches_user_invited_event(): void
    {
        Event::fake([UserInvited::class]);
        $useCase = $this->app->make(InviteUserUseCase::class);

        $command = new InviteUserCommand(
            invitedById: (string) $this->adminUser->id,
            email: 'new.cfo@acme.com',
            role: 'client',
            companyId: (string) $this->companyA->id
        );

        $invitation = $useCase->execute($command);

        $this->assertDatabaseHas('invitations', [
            'id' => $invitation->id(),
            'email' => 'new.cfo@acme.com',
            'role' => 'client',
            'company_id' => $this->companyA->id,
            'status' => 'pending',
            'invited_by' => $this->adminUser->id,
        ]);

        Event::assertDispatched(UserInvited::class, function (UserInvited $event) use ($invitation) {
            return $event->invitationId() === $invitation->id()
                && $event->email() === 'new.cfo@acme.com'
                && $event->role() === 'client'
                && $event->companyId() === (string) $this->companyA->id
                && !empty($event->token());
        });
    }

    public function test_advisor_can_invite_client_to_assigned_company(): void
    {
        Event::fake([UserInvited::class]);
        $useCase = $this->app->make(InviteUserUseCase::class);

        $command = new InviteUserCommand(
            invitedById: (string) $this->advisorUser->id,
            email: 'assigned.client@acme.com',
            role: 'client',
            companyId: (string) $this->companyA->id
        );

        $invitation = $useCase->execute($command);

        $this->assertDatabaseHas('invitations', [
            'id' => $invitation->id(),
            'email' => 'assigned.client@acme.com',
            'role' => 'client',
            'company_id' => $this->companyA->id,
            'status' => 'pending',
            'invited_by' => $this->advisorUser->id,
        ]);

        Event::assertDispatched(UserInvited::class);
    }

    public function test_reinviting_email_revokes_previous_pending_invitation_in_database(): void
    {
        $useCase = $this->app->make(InviteUserUseCase::class);

        $firstCommand = new InviteUserCommand(
            invitedById: (string) $this->adminUser->id,
            email: 'reinvite@acme.com',
            role: 'client',
            companyId: (string) $this->companyA->id
        );

        $firstInvitation = $useCase->execute($firstCommand);

        $secondCommand = new InviteUserCommand(
            invitedById: (string) $this->adminUser->id,
            email: 'reinvite@acme.com',
            role: 'client',
            companyId: (string) $this->companyA->id
        );

        $secondInvitation = $useCase->execute($secondCommand);

        $this->assertDatabaseHas('invitations', [
            'id' => $firstInvitation->id(),
            'status' => 'revoked',
        ]);

        $this->assertDatabaseHas('invitations', [
            'id' => $secondInvitation->id(),
            'status' => 'pending',
        ]);
    }
}
