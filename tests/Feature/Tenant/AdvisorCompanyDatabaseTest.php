<?php

declare(strict_types=1);

namespace Tests\Feature\Tenant;

use App\Contexts\Identity\Domain\ValueObjects\RoleType;
use App\Contexts\Identity\Domain\ValueObjects\UserId;
use App\Contexts\Tenant\Domain\Entities\CompanyAdvisorAssignment;
use App\Contexts\Tenant\Domain\Repositories\CompanyAdvisorRepositoryInterface;
use App\Contexts\Tenant\Domain\ValueObjects\CompanyId;
use App\Models\Company;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

final class AdvisorCompanyDatabaseTest extends TestCase
{
    use RefreshDatabase;

    private User $superAdmin;
    private User $advisor;
    private Company $companyA;
    private Company $companyB;
    private CompanyAdvisorRepositoryInterface $repository;

    protected function setUp(): void
    {
        parent::setUp();

        $this->companyA = Company::create([
            'id' => '11111111-1111-1111-1111-111111111111',
            'name' => 'Company Alpha',
            'code' => 'ALPHA',
            'tax_id' => 'PL1111111111',
        ]);

        $this->companyB = Company::create([
            'id' => '22222222-2222-2222-2222-222222222222',
            'name' => 'Company Beta',
            'code' => 'BETA',
            'tax_id' => 'PL2222222222',
        ]);

        $this->superAdmin = User::create([
            'id' => '33333333-3333-3333-3333-333333333333',
            'name' => 'Super Admin',
            'email' => 'super@finboard.local',
            'password' => Hash::make('secret123'),
            'role' => RoleType::SUPER_ADMIN->value,
            'is_active' => true,
        ]);

        $this->advisor = User::create([
            'id' => '44444444-4444-4444-4444-444444444444',
            'name' => 'Advisor One',
            'email' => 'advisor@finboard.local',
            'password' => Hash::make('secret123'),
            'role' => RoleType::ADVISOR->value,
            'is_active' => true,
        ]);

        $this->repository = $this->app->make(CompanyAdvisorRepositoryInterface::class);
    }

    public function test_advisor_can_be_assigned_and_revoked_via_repository(): void
    {
        $companyIdA = CompanyId::fromString($this->companyA->id);
        $companyIdB = CompanyId::fromString($this->companyB->id);
        $advisorId = UserId::fromString($this->advisor->id);
        $superAdminId = UserId::fromString($this->superAdmin->id);

        $this->assertFalse($this->repository->isAdvisorAssigned($companyIdA, $advisorId));
        $this->assertFalse($this->repository->isAdvisorAssigned($companyIdB, $advisorId));

        // Assign to Company A
        $assignmentA = CompanyAdvisorAssignment::create($companyIdA, $advisorId, $superAdminId);
        $this->repository->assign($assignmentA);

        $this->assertTrue($this->repository->isAdvisorAssigned($companyIdA, $advisorId));
        $this->assertFalse($this->repository->isAdvisorAssigned($companyIdB, $advisorId));

        // Assign to Company B
        $assignmentB = CompanyAdvisorAssignment::create($companyIdB, $advisorId, $superAdminId);
        $this->repository->assign($assignmentB);

        $this->assertTrue($this->repository->isAdvisorAssigned($companyIdB, $advisorId));

        $assignedCompanyIds = $this->repository->findCompanyIdsByAdvisor($advisorId);
        $this->assertCount(2, $assignedCompanyIds);
        $this->assertContains($this->companyA->id, $assignedCompanyIds);
        $this->assertContains($this->companyB->id, $assignedCompanyIds);

        $assignedAdvisorIds = $this->repository->findAdvisorIdsByCompany($companyIdA);
        $this->assertSame([$this->advisor->id], $assignedAdvisorIds);

        // Revoke from Company A
        $this->repository->revoke($companyIdA, $advisorId, $superAdminId);

        $this->assertFalse($this->repository->isAdvisorAssigned($companyIdA, $advisorId));
        $this->assertTrue($this->repository->isAdvisorAssigned($companyIdB, $advisorId));
        $this->assertSame([$this->companyB->id], $this->repository->findCompanyIdsByAdvisor($advisorId));
    }

    public function test_eloquent_many_to_many_relations(): void
    {
        $companyIdA = CompanyId::fromString($this->companyA->id);
        $advisorId = UserId::fromString($this->advisor->id);
        $superAdminId = UserId::fromString($this->superAdmin->id);

        $assignment = CompanyAdvisorAssignment::create($companyIdA, $advisorId, $superAdminId);
        $this->repository->assign($assignment);

        // Refresh Eloquent models
        $refreshedAdvisor = User::find($this->advisor->id);
        $refreshedCompany = Company::find($this->companyA->id);

        $this->assertCount(1, $refreshedAdvisor->assignedCompanies);
        $this->assertSame('Company Alpha', $refreshedAdvisor->assignedCompanies->first()->name);
        $this->assertSame($this->superAdmin->id, $refreshedAdvisor->assignedCompanies->first()->pivot->assigned_by);

        $this->assertCount(1, $refreshedCompany->assignedAdvisors);
        $this->assertSame('Advisor One', $refreshedCompany->assignedAdvisors->first()->name);
    }

    public function test_cascading_delete_on_advisor_removal(): void
    {
        $companyIdA = CompanyId::fromString($this->companyA->id);
        $advisorId = UserId::fromString($this->advisor->id);
        $superAdminId = UserId::fromString($this->superAdmin->id);

        $assignment = CompanyAdvisorAssignment::create($companyIdA, $advisorId, $superAdminId);
        $this->repository->assign($assignment);

        $this->assertTrue($this->repository->isAdvisorAssigned($companyIdA, $advisorId));

        // Delete advisor user
        $this->advisor->delete();

        $this->assertFalse($this->repository->isAdvisorAssigned($companyIdA, $advisorId));
        $this->assertDatabaseMissing('advisor_company', [
            'advisor_id' => $advisorId->value(),
            'company_id' => $companyIdA->value(),
        ]);
    }
}
