<?php

declare(strict_types=1);

namespace Tests\Feature\Api;

use App\Models\Company;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

final class AdvisorManagementApiTest extends TestCase
{
    use DatabaseTransactions;

    private User $superAdmin;
    private User $advisor;
    private User $client;
    private Company $companyA;
    private Company $companyB;
    private Company $companyC;

    protected function setUp(): void
    {
        parent::setUp();

        $this->companyA = Company::firstOrCreate(
            ['code' => 'ACME'],
            ['name' => 'Acme Manufacturing S.A.']
        );

        $this->companyB = Company::firstOrCreate(
            ['code' => 'HELVEST'],
            ['name' => 'Helvest Advisory Sp. z o.o.']
        );

        $this->companyC = Company::firstOrCreate(
            ['code' => 'VENTURE'],
            ['name' => 'Venture Holdings Sp. z o.o.']
        );

        $this->superAdmin = User::firstOrCreate(
            ['email' => 'admin@helvest.com'],
            [
                'name' => 'Super Admin Partner',
                'password' => bcrypt('password123'),
                'role' => 'super_admin',
                'is_active' => true,
            ]
        );

        $this->advisor = User::firstOrCreate(
            ['email' => 'advisor.mgmt@helvest.com'],
            [
                'name' => 'Advisor Management Test',
                'password' => bcrypt('password123'),
                'role' => 'advisor',
                'is_active' => true,
            ]
        );

        $this->client = User::firstOrCreate(
            ['email' => 'client.mgmt@acme.com'],
            [
                'name' => 'Client Management Test',
                'password' => bcrypt('password123'),
                'role' => 'client',
                'company_id' => $this->companyA->id,
                'is_active' => true,
            ]
        );
    }

    public function test_unauthenticated_request_is_rejected(): void
    {
        $this->getJson('/api/v1/admin/advisors')->assertStatus(401);
        $this->getJson('/api/v1/admin/companies')->assertStatus(401);
    }

    public function test_non_admin_users_are_forbidden(): void
    {
        // Client forbidden
        Sanctum::actingAs($this->client);
        $this->getJson('/api/v1/admin/advisors')->assertStatus(403);
        $this->getJson('/api/v1/admin/companies')->assertStatus(403);

        // Advisor forbidden from admin endpoints
        Sanctum::actingAs($this->advisor);
        $this->getJson('/api/v1/admin/advisors')->assertStatus(403);
        $this->getJson('/api/v1/admin/companies')->assertStatus(403);
    }

    public function test_superadmin_can_list_advisors_with_assigned_companies_and_search(): void
    {
        $this->advisor->assignedCompanies()->syncWithoutDetaching([$this->companyA->id]);

        Sanctum::actingAs($this->superAdmin);

        $response = $this->getJson('/api/v1/admin/advisors');
        $response->assertStatus(200)
            ->assertJsonStructure([
                'data' => [
                    '*' => [
                        'id',
                        'name',
                        'email',
                        'role',
                        'is_active',
                        'assigned_companies',
                        'assigned_companies_count',
                    ],
                ],
            ]);

        // Search by advisor email
        $searchResponse = $this->getJson('/api/v1/admin/advisors?search=advisor.mgmt');
        $searchResponse->assertStatus(200);
        $emails = collect($searchResponse->json('data'))->pluck('email');
        $this->assertTrue($emails->contains('advisor.mgmt@helvest.com'));

        // Filter by assigned company
        $compFilterResponse = $this->getJson('/api/v1/admin/advisors?company_id=' . $this->companyA->id);
        $compFilterResponse->assertStatus(200);
        $filteredEmails = collect($compFilterResponse->json('data'))->pluck('email');
        $this->assertTrue($filteredEmails->contains('advisor.mgmt@helvest.com'));
    }

    public function test_superadmin_can_view_single_advisor(): void
    {
        Sanctum::actingAs($this->superAdmin);

        $response = $this->getJson('/api/v1/admin/advisors/' . $this->advisor->id);
        $response->assertStatus(200)
            ->assertJsonPath('data.id', (string) $this->advisor->id)
            ->assertJsonPath('data.email', 'advisor.mgmt@helvest.com');

        // Not found
        $this->getJson('/api/v1/admin/advisors/00000000-0000-0000-0000-000000000000')
            ->assertStatus(404);
    }

    public function test_superadmin_can_assign_company_to_advisor(): void
    {
        Sanctum::actingAs($this->superAdmin);

        $response = $this->postJson("/api/v1/admin/advisors/{$this->advisor->id}/companies", [
            'company_id' => (string) $this->companyB->id,
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('message', 'Spółka została pomyślnie przypisana do doradcy.');

        $this->assertDatabaseHas('advisor_company', [
            'advisor_id' => (string) $this->advisor->id,
            'company_id' => (string) $this->companyB->id,
        ]);
    }

    public function test_superadmin_can_assign_multiple_companies_to_advisor(): void
    {
        Sanctum::actingAs($this->superAdmin);

        $response = $this->postJson("/api/v1/admin/advisors/{$this->advisor->id}/companies", [
            'company_ids' => [
                (string) $this->companyA->id,
                (string) $this->companyC->id,
            ],
        ]);

        $response->assertStatus(200);

        $this->assertDatabaseHas('advisor_company', [
            'advisor_id' => (string) $this->advisor->id,
            'company_id' => (string) $this->companyA->id,
        ]);

        $this->assertDatabaseHas('advisor_company', [
            'advisor_id' => (string) $this->advisor->id,
            'company_id' => (string) $this->companyC->id,
        ]);
    }

    public function test_assign_company_validation_and_failures(): void
    {
        Sanctum::actingAs($this->superAdmin);

        // Missing company
        $this->postJson("/api/v1/admin/advisors/{$this->advisor->id}/companies", [])
            ->assertStatus(422);

        // Non-existent company
        $this->postJson("/api/v1/admin/advisors/{$this->advisor->id}/companies", [
            'company_id' => '00000000-0000-0000-0000-000000000000',
        ])->assertStatus(422);

        // Target user is client, not advisor
        $this->postJson("/api/v1/admin/advisors/{$this->client->id}/companies", [
            'company_id' => (string) $this->companyA->id,
        ])->assertStatus(404);
    }

    public function test_superadmin_can_revoke_company_from_advisor(): void
    {
        $this->advisor->assignedCompanies()->syncWithoutDetaching([$this->companyA->id]);

        Sanctum::actingAs($this->superAdmin);

        $response = $this->deleteJson("/api/v1/admin/advisors/{$this->advisor->id}/companies/{$this->companyA->id}");
        $response->assertStatus(200)
            ->assertJsonPath('message', 'Doradca został pomyślnie odpięty od spółki.');

        $this->assertDatabaseMissing('advisor_company', [
            'advisor_id' => (string) $this->advisor->id,
            'company_id' => (string) $this->companyA->id,
        ]);
    }

    public function test_superadmin_can_sync_companies_for_advisor(): void
    {
        // Initially assigned to companyA
        $this->advisor->assignedCompanies()->sync([$this->companyA->id]);

        Sanctum::actingAs($this->superAdmin);

        // Sync to companyB and companyC (should revoke A, add B and C)
        $response = $this->putJson("/api/v1/admin/advisors/{$this->advisor->id}/companies", [
            'company_ids' => [
                (string) $this->companyB->id,
                (string) $this->companyC->id,
            ],
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('message', 'Lista przypisanych spółek została pomyślnie zaktualizowana.');

        $assignedCodes = collect($response->json('data.assigned_companies'))->pluck('code');
        $this->assertTrue($assignedCodes->contains('HELVEST'));
        $this->assertTrue($assignedCodes->contains('VENTURE'));
        $this->assertFalse($assignedCodes->contains('ACME'));

        $this->assertDatabaseMissing('advisor_company', [
            'advisor_id' => (string) $this->advisor->id,
            'company_id' => (string) $this->companyA->id,
        ]);
        $this->assertDatabaseHas('advisor_company', [
            'advisor_id' => (string) $this->advisor->id,
            'company_id' => (string) $this->companyB->id,
        ]);
        $this->assertDatabaseHas('advisor_company', [
            'advisor_id' => (string) $this->advisor->id,
            'company_id' => (string) $this->companyC->id,
        ]);
    }

    public function test_superadmin_can_toggle_advisor_status(): void
    {
        Sanctum::actingAs($this->superAdmin);

        $this->assertTrue($this->advisor->is_active);

        // Deactivate
        $responseDeact = $this->patchJson("/api/v1/admin/advisors/{$this->advisor->id}/toggle-status");
        $responseDeact->assertStatus(200)
            ->assertJsonPath('data.is_active', false)
            ->assertJsonPath('message', 'Konto doradcy zostało pomyślnie dezaktywowane.');

        $this->advisor->refresh();
        $this->assertFalse($this->advisor->is_active);

        // Activate
        $responseAct = $this->patchJson("/api/v1/admin/advisors/{$this->advisor->id}/toggle-status");
        $responseAct->assertStatus(200)
            ->assertJsonPath('data.is_active', true)
            ->assertJsonPath('message', 'Konto doradcy zostało pomyślnie aktywowane.');

        $this->advisor->refresh();
        $this->assertTrue($this->advisor->is_active);

        // Cannot toggle own account
        $this->patchJson("/api/v1/admin/advisors/{$this->superAdmin->id}/toggle-status")
            ->assertStatus(422)
            ->assertJsonPath('message', 'Nie można dezaktywować własnego konta administratora.');
    }

    public function test_superadmin_can_list_all_companies_with_advisor_and_client_counts(): void
    {
        $this->advisor->assignedCompanies()->syncWithoutDetaching([$this->companyA->id]);

        Sanctum::actingAs($this->superAdmin);

        $response = $this->getJson('/api/v1/admin/companies');
        $response->assertStatus(200)
            ->assertJsonStructure([
                'data' => [
                    '*' => [
                        'id',
                        'name',
                        'code',
                        'tax_id',
                        'assigned_advisors_count',
                        'clients_count',
                    ],
                ],
            ]);

        $companyAData = collect($response->json('data'))->firstWhere('code', 'ACME');
        $this->assertNotNull($companyAData);
        $this->assertGreaterThanOrEqual(1, $companyAData['assigned_advisors_count']);
        $this->assertGreaterThanOrEqual(1, $companyAData['clients_count']);
    }
}
