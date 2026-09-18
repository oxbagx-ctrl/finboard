<?php

declare(strict_types=1);

namespace Tests\Feature\Tenant;

use App\Contexts\Identity\Domain\ValueObjects\RoleType;
use App\Contexts\Tenant\Application\Commands\AssignAdvisorToCompanyCommand;
use App\Contexts\Tenant\Application\Commands\RevokeAdvisorFromCompanyCommand;
use App\Contexts\Tenant\Application\Exceptions\TargetUserNotAdvisorException;
use App\Contexts\Tenant\Application\Exceptions\UnauthorizedAssignmentException;
use App\Contexts\Tenant\Application\UseCases\AssignAdvisorToCompanyUseCase;
use App\Contexts\Tenant\Application\UseCases\RevokeAdvisorFromCompanyUseCase;
use App\Contexts\Tenant\Domain\Events\AdvisorAssignedToCompany;
use App\Contexts\Tenant\Domain\Events\AdvisorRevokedFromCompany;
use App\Models\Company;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

final class AssignAdvisorUseCaseIntegrationTest extends TestCase
{
    use DatabaseTransactions;

    private User $superAdmin;
    private User $advisor;
    private User $clientUser;
    private Company $company;

    protected function setUp(): void
    {
        parent::setUp();

        $this->company = Company::create([
            'id' => '11111111-1111-1111-1111-111111111199',
            'name' => 'Acme Holding Integration',
            'code' => 'ACME_INTG',
            'tax_id' => 'PL1111111199',
        ]);

        $this->superAdmin = User::create([
            'id' => '22222222-2222-2222-2222-222222222299',
            'name' => 'Managing Partner Integration',
            'email' => 'partner_intg@helvest.com',
            'password' => Hash::make('secret123'),
            'role' => RoleType::SUPER_ADMIN->value,
            'is_active' => true,
        ]);

        $this->advisor = User::create([
            'id' => '33333333-3333-3333-3333-333333333399',
            'name' => 'M&A Advisor Integration',
            'email' => 'advisor_intg@helvest.com',
            'password' => Hash::make('secret123'),
            'role' => RoleType::ADVISOR->value,
            'is_active' => true,
        ]);

        $this->clientUser = User::create([
            'id' => '44444444-4444-4444-4444-444444444499',
            'name' => 'CFO Client Integration',
            'email' => 'cfo_intg@acme.com',
            'password' => Hash::make('secret123'),
            'role' => RoleType::CLIENT->value,
            'company_id' => $this->company->id,
            'is_active' => true,
        ]);
    }

    public function test_assign_advisor_use_case_persists_in_database_and_fires_event(): void
    {
        Event::fake([AdvisorAssignedToCompany::class]);

        /** @var AssignAdvisorToCompanyUseCase $useCase */
        $useCase = $this->app->make(AssignAdvisorToCompanyUseCase::class);

        $command = new AssignAdvisorToCompanyCommand(
            companyId: $this->company->id,
            advisorId: $this->advisor->id,
            assignedById: $this->superAdmin->id
        );

        $useCase->execute($command);

        $this->assertDatabaseHas('advisor_company', [
            'company_id' => $this->company->id,
            'advisor_id' => $this->advisor->id,
            'assigned_by' => $this->superAdmin->id,
        ]);

        Event::assertDispatched(AdvisorAssignedToCompany::class, function (AdvisorAssignedToCompany $event) {
            return $event->companyId() === $this->company->id
                && $event->advisorId() === $this->advisor->id;
        });
    }

    public function test_revoke_advisor_use_case_removes_from_database_and_fires_event(): void
    {
        /** @var AssignAdvisorToCompanyUseCase $assignUseCase */
        $assignUseCase = $this->app->make(AssignAdvisorToCompanyUseCase::class);
        $assignUseCase->execute(new AssignAdvisorToCompanyCommand(
            companyId: $this->company->id,
            advisorId: $this->advisor->id,
            assignedById: $this->superAdmin->id
        ));

        Event::fake([AdvisorRevokedFromCompany::class]);

        /** @var RevokeAdvisorFromCompanyUseCase $revokeUseCase */
        $revokeUseCase = $this->app->make(RevokeAdvisorFromCompanyUseCase::class);
        $revokeUseCase->execute(new RevokeAdvisorFromCompanyCommand(
            companyId: $this->company->id,
            advisorId: $this->advisor->id,
            revokedById: $this->superAdmin->id
        ));

        $this->assertDatabaseMissing('advisor_company', [
            'company_id' => $this->company->id,
            'advisor_id' => $this->advisor->id,
        ]);

        Event::assertDispatched(AdvisorRevokedFromCompany::class, function (AdvisorRevokedFromCompany $event) {
            return $event->companyId() === $this->company->id
                && $event->advisorId() === $this->advisor->id;
        });
    }

    public function test_client_cannot_execute_assignment(): void
    {
        /** @var AssignAdvisorToCompanyUseCase $useCase */
        $useCase = $this->app->make(AssignAdvisorToCompanyUseCase::class);

        $this->expectException(UnauthorizedAssignmentException::class);

        $useCase->execute(new AssignAdvisorToCompanyCommand(
            companyId: $this->company->id,
            advisorId: $this->advisor->id,
            assignedById: $this->clientUser->id
        ));
    }

    public function test_cannot_assign_client_role_as_advisor(): void
    {
        /** @var AssignAdvisorToCompanyUseCase $useCase */
        $useCase = $this->app->make(AssignAdvisorToCompanyUseCase::class);

        $this->expectException(TargetUserNotAdvisorException::class);

        $useCase->execute(new AssignAdvisorToCompanyCommand(
            companyId: $this->company->id,
            advisorId: $this->clientUser->id,
            assignedById: $this->superAdmin->id
        ));
    }
}
