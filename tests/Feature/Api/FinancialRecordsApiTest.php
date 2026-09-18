<?php

declare(strict_types=1);

namespace Tests\Feature\Api;

use App\Models\Company;
use App\Models\FinancialCategory;
use App\Models\FinancialRecord;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

final class FinancialRecordsApiTest extends TestCase
{
    use DatabaseTransactions;

    private User $adminUser;
    private User $clientUser;
    private Company $acmeCompany;
    private Company $helvestCompany;

    protected function setUp(): void
    {
        parent::setUp();

        $this->helvestCompany = Company::firstOrCreate(
            ['code' => 'HELVEST'],
            ['name' => 'Helvest Advisory Sp. z o.o.', 'tax_id' => 'PL5252525252']
        );

        $this->acmeCompany = Company::firstOrCreate(
            ['code' => 'ACME'],
            ['name' => 'Acme Manufacturing S.A.', 'tax_id' => 'PL7010101010']
        );

        $this->adminUser = User::firstOrCreate(
            ['email' => 'admin@helvest.com'],
            [
                'name' => 'Admin Helvest',
                'password' => bcrypt('password123'),
                'role' => 'admin',
                'company_id' => $this->helvestCompany->id,
                'is_active' => true,
            ]
        );

        $this->clientUser = User::firstOrCreate(
            ['email' => 'klient@acme.com'],
            [
                'name' => 'Jan Kowalski (CFO Acme)',
                'password' => bcrypt('password123'),
                'role' => 'client',
                'company_id' => $this->acmeCompany->id,
                'is_active' => true,
            ]
        );
    }

    public function test_unauthenticated_requests_are_rejected(): void
    {
        $response = $this->getJson('/api/v1/finance/records');
        $response->assertStatus(401);
    }

    public function test_get_categories_returns_active_categories(): void
    {
        Sanctum::actingAs($this->clientUser);

        $response = $this->getJson('/api/v1/finance/categories');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'data' => [
                    '*' => ['id', 'name', 'type', 'code', 'description'],
                ],
            ]);

        $this->assertNotEmpty($response->json('data'));
    }

    public function test_client_only_sees_records_of_their_company(): void
    {
        Sanctum::actingAs($this->clientUser);

        $response = $this->getJson('/api/v1/finance/records');

        $response->assertStatus(200);
        $records = $response->json('data');
        $this->assertNotEmpty($records);

        foreach ($records as $record) {
            $this->assertSame($this->acmeCompany->id, $record['company_id']);
        }
    }

    public function test_create_financial_record_via_api(): void
    {
        Sanctum::actingAs($this->clientUser);

        $payload = [
            'category_id' => 'cat-revenue',
            'amount' => 45000.50,
            'currency' => 'PLN',
            'record_date' => '2026-07-20',
            'description' => 'Nowy kontrakt wdrożeniowy',
            'source' => 'manual',
        ];

        $response = $this->postJson('/api/v1/finance/records', $payload);

        $response->assertStatus(201)
            ->assertJsonPath('data.category_id', 'cat-revenue')
            ->assertJsonPath('data.amount', 45000.5)
            ->assertJsonPath('data.description', 'Nowy kontrakt wdrożeniowy')
            ->assertJsonPath('data.company_id', $this->acmeCompany->id);

        $this->assertDatabaseHas('financial_records', [
            'description' => 'Nowy kontrakt wdrożeniowy',
            'company_id' => $this->acmeCompany->id,
        ]);
    }

    public function test_create_financial_record_validation_error(): void
    {
        Sanctum::actingAs($this->clientUser);

        $response = $this->postJson('/api/v1/finance/records', [
            'category_id' => 'invalid-category',
            'amount' => -100,
            'record_date' => 'not-a-date',
            'description' => '',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['category_id', 'amount', 'record_date', 'description']);
    }

    public function test_get_single_financial_record(): void
    {
        Sanctum::actingAs($this->clientUser);

        $record = FinancialRecord::where('company_id', $this->acmeCompany->id)->firstOrFail();

        $response = $this->getJson('/api/v1/finance/records/' . $record->id);

        $response->assertStatus(200)
            ->assertJsonPath('data.id', $record->id)
            ->assertJsonPath('data.company_id', $this->acmeCompany->id);
    }

    public function test_update_financial_record(): void
    {
        Sanctum::actingAs($this->clientUser);

        $record = FinancialRecord::where('company_id', $this->acmeCompany->id)->firstOrFail();

        $updatePayload = [
            'category_id' => $record->category_id,
            'amount' => 99999.00,
            'currency' => 'PLN',
            'record_date' => '2026-08-01',
            'description' => 'Zaktualizowany opis rekordu',
        ];

        $response = $this->putJson('/api/v1/finance/records/' . $record->id, $updatePayload);

        $response->assertStatus(200)
            ->assertJsonPath('data.description', 'Zaktualizowany opis rekordu');

        $this->assertEquals(99999.0, (float) $response->json('data.amount'));

        $this->assertDatabaseHas('financial_records', [
            'id' => $record->id,
            'description' => 'Zaktualizowany opis rekordu',
        ]);
    }

    public function test_delete_financial_record(): void
    {
        Sanctum::actingAs($this->clientUser);

        $record = FinancialRecord::where('company_id', $this->acmeCompany->id)->latest()->firstOrFail();

        $response = $this->deleteJson('/api/v1/finance/records/' . $record->id);

        $response->assertStatus(200)
            ->assertJsonPath('status', 'deleted');

        $this->assertDatabaseMissing('financial_records', [
            'id' => $record->id,
        ]);
    }

    public function test_cross_tenant_access_is_forbidden_for_client(): void
    {
        Sanctum::actingAs($this->clientUser);

        // Helvest record should not be accessible by Acme client
        $helvestRecord = FinancialRecord::where('company_id', $this->helvestCompany->id)->firstOrFail();

        $response = $this->getJson('/api/v1/finance/records/' . $helvestRecord->id);
        $response->assertStatus(403);

        $deleteResponse = $this->deleteJson('/api/v1/finance/records/' . $helvestRecord->id);
        $deleteResponse->assertStatus(403);
    }
}
