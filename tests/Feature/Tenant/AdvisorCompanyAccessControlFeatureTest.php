<?php

declare(strict_types=1);

namespace Tests\Feature\Tenant;

use App\Contexts\Identity\Domain\ValueObjects\RoleType;
use App\Models\Company;
use App\Models\Document;
use App\Models\FinancialRecord;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

final class AdvisorCompanyAccessControlFeatureTest extends TestCase
{
    use DatabaseTransactions;

    private User $advisor;
    private User $superAdmin;
    private Company $assignedCompany;
    private Company $unassignedCompany;

    protected function setUp(): void
    {
        parent::setUp();

        $this->assignedCompany = Company::create([
            'id' => '11111111-aaaa-1111-aaaa-111111111111',
            'name' => 'Assigned Portfolio Sp. z o.o.',
            'code' => 'ASSIGNED_CORP',
            'tax_id' => 'PL1111119988',
        ]);

        $this->unassignedCompany = Company::create([
            'id' => '22222222-bbbb-2222-bbbb-222222222222',
            'name' => 'Restricted Unassigned S.A.',
            'code' => 'RESTRICTED_CORP',
            'tax_id' => 'PL2222229988',
        ]);

        $this->superAdmin = User::create([
            'id' => '33333333-cccc-3333-cccc-333333333333',
            'name' => 'Super Admin Managing Partner',
            'email' => 'superadmin_test_access@helvest.com',
            'password' => Hash::make('password123'),
            'role' => RoleType::SUPER_ADMIN->value,
            'is_active' => true,
        ]);

        $this->advisor = User::create([
            'id' => '44444444-dddd-4444-dddd-444444444444',
            'name' => 'Senior Advisor Deal Lead',
            'email' => 'advisor_test_access@helvest.com',
            'password' => Hash::make('password123'),
            'role' => RoleType::ADVISOR->value,
            'is_active' => true,
        ]);

        // Explicitly assign advisor ONLY to assignedCompany
        $this->advisor->assignedCompanies()->attach($this->assignedCompany->id, [
            'assigned_by' => $this->superAdmin->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function test_user_eloquent_model_can_access_company_predicate(): void
    {
        $this->assertTrue($this->advisor->canAccessCompany($this->assignedCompany->id));
        $this->assertFalse($this->advisor->canAccessCompany($this->unassignedCompany->id));
        $this->assertFalse($this->advisor->canAccessCompany('non-existent-company-uuid'));

        // Deactivated advisor has no access
        $this->advisor->is_active = false;
        $this->advisor->save();
        $this->assertFalse($this->advisor->canAccessCompany($this->assignedCompany->id));
    }

    public function test_advisor_can_only_see_assigned_companies_in_auth_me(): void
    {
        Sanctum::actingAs($this->advisor);

        $response = $this->getJson('/api/v1/auth/me');

        $response->assertStatus(200);
        $availableCompanies = $response->json('available_companies');

        $this->assertCount(1, $availableCompanies);
        $this->assertSame($this->assignedCompany->id, $availableCompanies[0]['id']);
        $this->assertSame($this->assignedCompany->name, $availableCompanies[0]['name']);
    }

    public function test_advisor_can_only_see_assigned_companies_in_login(): void
    {
        $response = $this->postJson('/api/v1/auth/login', [
            'email' => $this->advisor->email,
            'password' => 'password123',
        ]);

        $response->assertStatus(200);
        $availableCompanies = $response->json('available_companies');

        $this->assertCount(1, $availableCompanies);
        $this->assertSame($this->assignedCompany->id, $availableCompanies[0]['id']);
    }

    public function test_advisor_can_access_financial_records_of_assigned_company(): void
    {
        Sanctum::actingAs($this->advisor);

        FinancialRecord::create([
            'company_id' => $this->assignedCompany->id,
            'category_id' => 'cat-revenue',
            'record_type' => 'INCOME',
            'amount' => 50000.00,
            'currency' => 'PLN',
            'record_date' => '2026-05-10',
            'description' => 'Assigned Company Sales Contract',
            'source' => 'manual',
        ]);

        $response = $this->withHeader('X-Company-Id', $this->assignedCompany->id)
            ->getJson('/api/v1/finance/records');

        $response->assertStatus(200);
        $records = $response->json('data');
        $this->assertNotEmpty($records);
        $this->assertSame($this->assignedCompany->id, $records[0]['company_id']);
    }

    public function test_advisor_is_strictly_forbidden_from_accessing_unassigned_company(): void
    {
        Sanctum::actingAs($this->advisor);

        // Attempt to access financial records of unassigned company via X-Company-Id header
        $response = $this->withHeader('X-Company-Id', $this->unassignedCompany->id)
            ->getJson('/api/v1/finance/records');

        $response->assertStatus(403);

        // Attempt to access financial metrics of unassigned company
        $metricsResponse = $this->withHeader('X-Company-Id', $this->unassignedCompany->id)
            ->getJson('/api/v1/finance/analytics/metrics');

        $metricsResponse->assertStatus(403);

        // Attempt to access documents of unassigned company
        $docsResponse = $this->withHeader('X-Company-Id', $this->unassignedCompany->id)
            ->getJson('/api/v1/documents');

        $docsResponse->assertStatus(403);
    }

    public function test_superadmin_can_access_both_assigned_and_unassigned_companies(): void
    {
        Sanctum::actingAs($this->superAdmin);

        $responseAssigned = $this->withHeader('X-Company-Id', $this->assignedCompany->id)
            ->getJson('/api/v1/finance/records');
        $responseAssigned->assertStatus(200);

        $responseUnassigned = $this->withHeader('X-Company-Id', $this->unassignedCompany->id)
            ->getJson('/api/v1/finance/records');
        $responseUnassigned->assertStatus(200);
    }
}
