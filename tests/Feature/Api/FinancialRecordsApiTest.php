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

    public function test_filter_records_by_search_term_and_type(): void
    {
        Sanctum::actingAs($this->clientUser);

        FinancialRecord::create([
            'company_id' => $this->acmeCompany->id,
            'category_id' => 'cat-revenue',
            'record_type' => 'INCOME',
            'amount' => 12345.67,
            'currency' => 'PLN',
            'record_date' => '2026-06-15',
            'description' => 'Unikalna_Transakcja_Testowa_XYZ',
            'source' => 'manual',
        ]);

        $response = $this->getJson('/api/v1/finance/records?search=Testowa_XYZ&record_type=INCOME');

        $response->assertStatus(200);
        $data = $response->json('data');
        $this->assertNotEmpty($data);
        $this->assertSame('Unikalna_Transakcja_Testowa_XYZ', $data[0]['description']);
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

    public function test_batch_delete_financial_records_success(): void
    {
        Sanctum::actingAs($this->clientUser);

        $category = FinancialCategory::firstOrFail();

        $r1 = FinancialRecord::create([
            'id' => (string) \Illuminate\Support\Str::uuid(),
            'company_id' => $this->acmeCompany->id,
            'category_id' => $category->id,
            'amount' => 1200.50,
            'currency' => 'PLN',
            'record_date' => '2026-06-10',
            'description' => 'Test Batch Delete 1',
            'record_type' => 'revenue',
            'source' => 'manual',
        ]);

        $r2 = FinancialRecord::create([
            'id' => (string) \Illuminate\Support\Str::uuid(),
            'company_id' => $this->acmeCompany->id,
            'category_id' => $category->id,
            'amount' => 800.50,
            'currency' => 'PLN',
            'record_date' => '2026-06-11',
            'description' => 'Test Batch Delete 2',
            'record_type' => 'revenue',
            'source' => 'manual',
        ]);

        $response = $this->deleteJson('/api/v1/finance/records/batch', [
            'record_ids' => [$r1->id, $r2->id],
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('status', 'deleted')
            ->assertJsonPath('count', 2);

        $this->assertEquals(2001.0, (float) $response->json('total_amount'));

        $this->assertDatabaseMissing('financial_records', ['id' => $r1->id]);

        $this->assertDatabaseMissing('financial_records', ['id' => $r2->id]);
    }

    public function test_batch_delete_validation_rules(): void
    {
        Sanctum::actingAs($this->clientUser);

        // Missing record_ids
        $this->deleteJson('/api/v1/finance/records/batch', [])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['record_ids']);

        // Empty array
        $this->deleteJson('/api/v1/finance/records/batch', ['record_ids' => []])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['record_ids']);

        // Invalid uuid
        $this->deleteJson('/api/v1/finance/records/batch', ['record_ids' => ['not-a-uuid']])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['record_ids.0']);
    }

    public function test_batch_delete_enforces_tenant_isolation(): void
    {
        Sanctum::actingAs($this->clientUser);

        $category = FinancialCategory::firstOrFail();

        $acmeRecord = FinancialRecord::create([
            'id' => (string) \Illuminate\Support\Str::uuid(),
            'company_id' => $this->acmeCompany->id,
            'category_id' => $category->id,
            'amount' => 500.00,
            'currency' => 'PLN',
            'record_date' => '2026-06-12',
            'description' => 'Acme to delete',
            'record_type' => 'expense',
            'source' => 'manual',
        ]);

        $helvestRecord = FinancialRecord::create([
            'id' => (string) \Illuminate\Support\Str::uuid(),
            'company_id' => $this->helvestCompany->id,
            'category_id' => $category->id,
            'amount' => 9999.00,
            'currency' => 'PLN',
            'record_date' => '2026-06-12',
            'description' => 'Helvest protected record',
            'record_type' => 'expense',
            'source' => 'manual',
        ]);

        // Acme user attempts to batch delete both their record and Helvest record
        $response = $this->deleteJson('/api/v1/finance/records/batch', [
            'record_ids' => [$acmeRecord->id, $helvestRecord->id],
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('status', 'deleted')
            ->assertJsonPath('count', 1);

        $this->assertEquals(500.0, (float) $response->json('total_amount'));

        // Acme record deleted

        $this->assertDatabaseMissing('financial_records', ['id' => $acmeRecord->id]);

        // Helvest record remains strictly untouched
        $this->assertDatabaseHas('financial_records', ['id' => $helvestRecord->id]);
    }
}

