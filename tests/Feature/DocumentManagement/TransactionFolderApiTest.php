<?php

declare(strict_types=1);

namespace Tests\Feature\DocumentManagement;

use App\Contexts\Identity\Domain\ValueObjects\RoleType;
use App\Models\Company;
use App\Models\Document;
use App\Models\TransactionFolder;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

final class TransactionFolderApiTest extends TestCase
{
    use DatabaseTransactions;

    private User $clientUserA;
    private User $clientUserB;
    private User $superAdmin;
    private Company $companyA;
    private Company $companyB;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');

        $this->companyA = Company::create([
            'id' => (string) Str::uuid(),
            'name' => 'Acme Capital Sp. z o.o.',
            'code' => 'ACME_' . uniqid(),
            'tax_id' => 'PL' . mt_rand(1000000000, 9999999999),
        ]);

        $this->companyB = Company::create([
            'id' => (string) Str::uuid(),
            'name' => 'Beta Ventures S.A.',
            'code' => 'BETA_' . uniqid(),
            'tax_id' => 'PL' . mt_rand(1000000000, 9999999999),
        ]);

        $this->clientUserA = User::create([
            'id' => (string) Str::uuid(),
            'name' => 'Jan Kowalski (Acme)',
            'email' => 'jan_' . uniqid() . '@acme.pl',
            'password' => Hash::make('secret123'),
            'role' => RoleType::CLIENT->value,
            'company_id' => $this->companyA->id,
            'is_active' => true,
        ]);

        $this->clientUserB = User::create([
            'id' => (string) Str::uuid(),
            'name' => 'Anna Nowak (Beta)',
            'email' => 'anna_' . uniqid() . '@beta.pl',
            'password' => Hash::make('secret123'),
            'role' => RoleType::CLIENT->value,
            'company_id' => $this->companyB->id,
            'is_active' => true,
        ]);

        $this->superAdmin = User::create([
            'id' => (string) Str::uuid(),
            'name' => 'Admin Test',
            'email' => 'admin_' . uniqid() . '@finboard.test',
            'password' => Hash::make('secret123'),
            'role' => RoleType::SUPER_ADMIN->value,
            'is_active' => true,
        ]);
    }

    public function test_client_user_can_list_folders_for_their_company(): void
    {
        Sanctum::actingAs($this->clientUserA);

        $root = TransactionFolder::create([
            'id' => (string) Str::uuid(),
            'company_id' => $this->companyA->id,
            'index_code' => '01.00',
            'name' => 'Informacje Korporacyjne',
            'sort_order' => 10,
        ]);

        $sub = TransactionFolder::create([
            'id' => (string) Str::uuid(),
            'company_id' => $this->companyA->id,
            'parent_id' => $root->id,
            'index_code' => '01.01',
            'name' => 'Umowy Spółki',
            'sort_order' => 1,
        ]);

        $response = $this->getJson('/api/v1/documents/folders');

        $response->assertStatus(200);
        $response->assertJsonCount(2, 'data');
        $response->assertJsonFragment(['index_code' => '01.00']);
        $response->assertJsonFragment(['index_code' => '01.01']);
    }

    public function test_client_user_can_list_folders_in_tree_hierarchy(): void
    {
        Sanctum::actingAs($this->clientUserA);

        $root = TransactionFolder::create([
            'id' => (string) Str::uuid(),
            'company_id' => $this->companyA->id,
            'index_code' => '01.00',
            'name' => 'Informacje Korporacyjne',
            'sort_order' => 10,
        ]);

        TransactionFolder::create([
            'id' => (string) Str::uuid(),
            'company_id' => $this->companyA->id,
            'parent_id' => $root->id,
            'index_code' => '01.01',
            'name' => 'Umowy Spółki',
            'sort_order' => 1,
        ]);

        $response = $this->getJson('/api/v1/documents/folders?tree=1');

        $response->assertStatus(200);
        $response->assertJsonCount(1, 'data');
        $response->assertJsonPath('data.0.index_code', '01.00');
        $response->assertJsonPath('data.0.children.0.index_code', '01.01');
    }

    public function test_user_cannot_see_folders_from_another_company(): void
    {
        TransactionFolder::create([
            'id' => (string) Str::uuid(),
            'company_id' => $this->companyB->id,
            'index_code' => '01.00',
            'name' => 'Beta Secret Folder',
            'sort_order' => 10,
        ]);

        Sanctum::actingAs($this->clientUserA);

        $response = $this->getJson('/api/v1/documents/folders');

        $response->assertStatus(200);
        $response->assertJsonCount(0, 'data');
    }

    public function test_user_can_create_folder_with_dewey_index_code(): void
    {
        Sanctum::actingAs($this->clientUserA);

        $response = $this->postJson('/api/v1/documents/folders', [
            'name' => 'Kluczowe Umowy Handlowe',
            'index_code' => '03.01',
            'description' => 'Kontrakty z top 10 klientami',
            'sort_order' => 5,
        ]);

        $response->assertStatus(201);
        $response->assertJsonPath('data.index_code', '03.01');
        $response->assertJsonPath('data.name', 'Kluczowe Umowy Handlowe');

        $this->assertDatabaseHas('transaction_folders', [
            'company_id' => $this->companyA->id,
            'index_code' => '03.01',
            'name' => 'Kluczowe Umowy Handlowe',
        ]);
    }

    public function test_cannot_create_folder_with_duplicate_index_code_in_same_company(): void
    {
        Sanctum::actingAs($this->clientUserA);

        TransactionFolder::create([
            'id' => (string) Str::uuid(),
            'company_id' => $this->companyA->id,
            'index_code' => '02.01',
            'name' => 'Roczne Sprawozdania Finansowe',
            'sort_order' => 10,
        ]);

        $response = $this->postJson('/api/v1/documents/folders', [
            'name' => 'Duplikat Index Code',
            'index_code' => '02.01',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['index_code']);
    }

    public function test_can_initialize_standard_mna_taxonomy_folders(): void
    {
        Sanctum::actingAs($this->clientUserA);

        $response = $this->postJson('/api/v1/documents/folders/init-standard');

        $response->assertStatus(201);
        $response->assertJsonPath('created_count', 33); // 8 root categories + 25 subcategories

        // Second initialization call should not duplicate
        $secondResponse = $this->postJson('/api/v1/documents/folders/init-standard');
        $secondResponse->assertStatus(201);
        $secondResponse->assertJsonPath('created_count', 0);
    }

    public function test_user_can_update_folder_details_and_index(): void
    {
        Sanctum::actingAs($this->clientUserA);

        $folder = TransactionFolder::create([
            'id' => (string) Str::uuid(),
            'company_id' => $this->companyA->id,
            'index_code' => '05.01',
            'name' => 'Struktura Zatrudnienia',
            'sort_order' => 1,
        ]);

        $response = $this->putJson("/api/v1/documents/folders/{$folder->id}", [
            'name' => 'Kadra Zarządcza i Struktura HR',
            'index_code' => '05.02',
            'description' => 'Zaktualizowany opis folderu HR',
        ]);

        $response->assertStatus(200);
        $response->assertJsonPath('data.name', 'Kadra Zarządcza i Struktura HR');
        $response->assertJsonPath('data.index_code', '05.02');

        $this->assertDatabaseHas('transaction_folders', [
            'id' => $folder->id,
            'name' => 'Kadra Zarządcza i Struktura HR',
            'index_code' => '05.02',
        ]);
    }

    public function test_user_can_delete_folder_and_documents_become_unassigned(): void
    {
        Sanctum::actingAs($this->clientUserA);

        $folder = TransactionFolder::create([
            'id' => (string) Str::uuid(),
            'company_id' => $this->companyA->id,
            'index_code' => '04.01',
            'name' => 'Nieruchomości',
            'sort_order' => 1,
        ]);

        $file = UploadedFile::fake()->create('ksiega_wieczysta.pdf', 100, 'application/pdf');

        $uploadResponse = $this->postJson('/api/v1/documents', [
            'title' => 'Księga Wieczysta Zakładu Produkcyjnego',
            'type' => 'contract',
            'file' => $file,
            'folder_id' => $folder->id,
            'index_code' => '04.01.01',
        ]);

        $uploadResponse->assertStatus(201);
        $documentId = $uploadResponse->json('data.id');

        $this->assertDatabaseHas('documents', [
            'id' => $documentId,
            'folder_id' => $folder->id,
            'index_code' => '04.01.01',
        ]);

        // Delete the folder
        $deleteResponse = $this->deleteJson("/api/v1/documents/folders/{$folder->id}");
        $deleteResponse->assertStatus(200);

        $this->assertDatabaseMissing('transaction_folders', ['id' => $folder->id]);

        // Document still exists, but folder_id is set to null
        $this->assertDatabaseHas('documents', [
            'id' => $documentId,
            'folder_id' => null,
        ]);
    }

    public function test_document_filtering_by_folder_id(): void
    {
        Sanctum::actingAs($this->clientUserA);

        $folderA = TransactionFolder::create([
            'id' => (string) Str::uuid(),
            'company_id' => $this->companyA->id,
            'index_code' => '01.01',
            'name' => 'Statuty',
            'sort_order' => 1,
        ]);

        $folderB = TransactionFolder::create([
            'id' => (string) Str::uuid(),
            'company_id' => $this->companyA->id,
            'index_code' => '02.01',
            'name' => 'Bilans',
            'sort_order' => 2,
        ]);

        $fileA = UploadedFile::fake()->create('statut.pdf', 50, 'application/pdf');
        $this->postJson('/api/v1/documents', [
            'title' => 'Statut Spółki 2026',
            'type' => 'contract',
            'file' => $fileA,
            'folder_id' => $folderA->id,
            'index_code' => '01.01.01',
        ])->assertStatus(201);

        $fileB = UploadedFile::fake()->create('bilans.pdf', 50, 'application/pdf');
        $this->postJson('/api/v1/documents', [
            'title' => 'Bilans Finansowy 2025',
            'type' => 'financial_report',
            'file' => $fileB,
            'folder_id' => $folderB->id,
            'index_code' => '02.01.01',
        ])->assertStatus(201);

        // Filter by folder A
        $responseA = $this->getJson("/api/v1/documents?folder_id={$folderA->id}");
        $responseA->assertStatus(200);
        $responseA->assertJsonCount(1, 'data');
        $responseA->assertJsonPath('data.0.title', 'Statut Spółki 2026');

        // Filter by folder B
        $responseB = $this->getJson("/api/v1/documents?folder_id={$folderB->id}");
        $responseB->assertStatus(200);
        $responseB->assertJsonCount(1, 'data');
        $responseB->assertJsonPath('data.0.title', 'Bilans Finansowy 2025');
    }
}
