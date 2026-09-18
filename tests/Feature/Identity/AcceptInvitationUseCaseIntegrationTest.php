<?php

declare(strict_types=1);

namespace Tests\Feature\Identity;

use App\Contexts\Identity\Application\Commands\AcceptInvitationCommand;
use App\Contexts\Identity\Application\Commands\InviteUserCommand;
use App\Contexts\Identity\Application\UseCases\AcceptInvitationUseCase;
use App\Contexts\Identity\Application\UseCases\InviteUserUseCase;
use App\Models\Company;
use App\Models\Invitation as InvitationModel;
use App\Models\User as UserModel;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

final class AcceptInvitationUseCaseIntegrationTest extends TestCase
{
    use DatabaseTransactions;

    private UserModel $admin;
    private Company $companyA;
    private Company $companyB;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = UserModel::firstOrCreate(
            ['email' => 'admin@helvest.com'],
            [
                'name' => 'Admin Helvest',
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

    public function test_client_accepts_invitation_creates_user_and_updates_database_state(): void
    {
        $inviteUseCase = $this->app->make(InviteUserUseCase::class);
        $acceptUseCase = $this->app->make(AcceptInvitationUseCase::class);

        $inviteCommand = new InviteUserCommand(
            invitedById: (string) $this->admin->id,
            email: 'integration.cfo@acme.com',
            role: 'client',
            companyId: (string) $this->companyA->id
        );

        $invitation = $inviteUseCase->execute($inviteCommand);
        $token = $invitation->token()->value();

        $acceptCommand = new AcceptInvitationCommand(
            token: $token,
            name: 'Piotr Dyrektor',
            password: 'SuperSecurePassword2026!',
            passwordConfirmation: 'SuperSecurePassword2026!'
        );

        $user = $acceptUseCase->execute($acceptCommand);

        // Verify user in database
        $this->assertDatabaseHas('users', [
            'id' => $user->id(),
            'email' => 'integration.cfo@acme.com',
            'name' => 'Piotr Dyrektor',
            'role' => 'client',
            'company_id' => (string) $this->companyA->id,
            'is_active' => true,
        ]);

        $createdModel = UserModel::find($user->id());
        $this->assertNotNull($createdModel);
        $this->assertTrue(Hash::check('SuperSecurePassword2026!', $createdModel->password));

        // Verify invitation state in database
        $invitationModel = InvitationModel::find($invitation->id());
        $this->assertNotNull($invitationModel);
        $this->assertSame('accepted', $invitationModel->status);
        $this->assertNotNull($invitationModel->accepted_at);
    }

    public function test_advisor_accepts_invitation_and_receives_company_assignments_in_database(): void
    {
        $inviteUseCase = $this->app->make(InviteUserUseCase::class);
        $acceptUseCase = $this->app->make(AcceptInvitationUseCase::class);

        $assignedCompanyIds = [(string) $this->companyA->id, (string) $this->companyB->id];

        $inviteCommand = new InviteUserCommand(
            invitedById: (string) $this->admin->id,
            email: 'integration.advisor@dealcorp.com',
            role: 'advisor',
            assignedCompanyIds: $assignedCompanyIds
        );

        $invitation = $inviteUseCase->execute($inviteCommand);
        $token = $invitation->token()->value();

        $acceptCommand = new AcceptInvitationCommand(
            token: $token,
            name: 'Magdalena Doradca',
            password: 'AdvisorSecretKey2026!'
        );

        $user = $acceptUseCase->execute($acceptCommand);

        // Verify advisor in database
        $this->assertDatabaseHas('users', [
            'id' => $user->id(),
            'email' => 'integration.advisor@dealcorp.com',
            'name' => 'Magdalena Doradca',
            'role' => 'advisor',
            'company_id' => null,
            'is_active' => true,
        ]);

        // Verify pivot table entries in advisor_company
        $this->assertDatabaseHas('advisor_company', [
            'advisor_id' => $user->id(),
            'company_id' => (string) $this->companyA->id,
        ]);

        $this->assertDatabaseHas('advisor_company', [
            'advisor_id' => $user->id(),
            'company_id' => (string) $this->companyB->id,
        ]);

        // Verify model relationship
        $advisorModel = UserModel::find($user->id());
        $this->assertCount(2, $advisorModel->assignedCompanies);
    }
}
