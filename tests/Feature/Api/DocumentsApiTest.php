<?php

declare(strict_types=1);

namespace Tests\Feature\Api;

use App\Models\Company;
use App\Models\Document;
use App\Models\DocumentAccessLog;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

final class DocumentsApiTest extends TestCase
{
    use DatabaseTransactions;

    private User $adminUser;
    private User $clientUser;
    private Company $acmeCompany;
    private Company $helvestCompany;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');

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

    public function test_unauthenticated_request_is_rejected(): void
    {
        $response = $this->getJson('/api/v1/documents');
        $response->assertStatus(401);
    }

    public function test_client_uploads_document_and_audit_log_is_recorded(): void
    {
        Sanctum::actingAs($this->clientUser);

        $fileContent = 'RAPORT FINANSOWY SPÓŁKI ACME 2026';
        $file = UploadedFile::fake()->createWithContent('raport_q1_2026.pdf', $fileContent);

        $response = $this->postJson('/api/v1/documents', [
            'file' => $file,
            'title' => 'Raport Finansowy Q1 2026',
            'type' => 'financial_report',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('data.title', 'Raport Finansowy Q1 2026')
            ->assertJsonPath('data.type', 'financial_report')
            ->assertJsonPath('data.type_label', 'Raport Finansowy')
            ->assertJsonPath('data.company_id', $this->acmeCompany->id)
            ->assertJsonPath('data.download_count', 0)
            ->assertJsonPath('data.is_archived', false);

        $documentId = $response->json('data.id');

        $this->assertDatabaseHas('documents', [
            'id' => $documentId,
            'title' => 'Raport Finansowy Q1 2026',
            'company_id' => $this->acmeCompany->id,
        ]);

        $this->assertDatabaseHas('document_access_logs', [
            'document_id' => $documentId,
            'user_id' => $this->clientUser->id,
            'action' => 'upload',
        ]);
    }

    public function test_list_documents_with_type_and_search_filters(): void
    {
        Sanctum::actingAs($this->clientUser);

        $file = UploadedFile::fake()->createWithContent('umowa.pdf', 'TRESC UMOWY');
        $this->postJson('/api/v1/documents', [
            'file' => $file,
            'title' => 'Umowa Kredytowa PKO BP',
            'type' => 'contract',
        ]);

        $response = $this->getJson('/api/v1/documents?type=contract');

        $response->assertStatus(200);
        $docs = $response->json('data');
        $this->assertNotEmpty($docs);
        $this->assertSame('contract', $docs[0]['type']);

        $searchResponse = $this->getJson('/api/v1/documents?search=Kredytowa');
        $searchResponse->assertStatus(200);
        $this->assertNotEmpty($searchResponse->json('data'));
    }

    public function test_get_single_document_metadata(): void
    {
        Sanctum::actingAs($this->clientUser);

        $file = UploadedFile::fake()->createWithContent('audit.pdf', 'AUDYT');
        $upload = $this->postJson('/api/v1/documents', [
            'file' => $file,
            'title' => 'Audyt Finansowy 2025',
            'type' => 'audit_report',
        ]);

        $docId = $upload->json('data.id');

        $response = $this->getJson('/api/v1/documents/' . $docId);

        $response->assertStatus(200)
            ->assertJsonPath('data.id', $docId)
            ->assertJsonPath('data.title', 'Audyt Finansowy 2025');
    }

    public function test_download_document_increments_counter_and_logs_access(): void
    {
        Sanctum::actingAs($this->clientUser);

        $file = UploadedFile::fake()->createWithContent('prezentacja.pdf', 'SLIDES INVESTOR PRESENTATION');
        $upload = $this->postJson('/api/v1/documents', [
            'file' => $file,
            'title' => 'Prezentacja Inwestorska Series A',
            'type' => 'presentation',
        ]);

        $docId = $upload->json('data.id');

        $downloadResponse = $this->get('/api/v1/documents/' . $docId . '/download');

        $downloadResponse->assertStatus(200);
        $this->assertSame('SLIDES INVESTOR PRESENTATION', $downloadResponse->getContent());

        // Verify download counter incremented
        $doc = Document::findOrFail($docId);
        $this->assertSame(1, $doc->download_count);

        // Verify download audit log
        $this->assertDatabaseHas('document_access_logs', [
            'document_id' => $docId,
            'user_id' => $this->clientUser->id,
            'action' => 'download',
        ]);
    }

    public function test_update_document_metadata(): void
    {
        Sanctum::actingAs($this->clientUser);

        $file = UploadedFile::fake()->createWithContent('draft.pdf', 'DRAFT');
        $upload = $this->postJson('/api/v1/documents', [
            'file' => $file,
            'title' => 'Projekt Umowy',
            'type' => 'other',
        ]);

        $docId = $upload->json('data.id');

        $updateResponse = $this->putJson('/api/v1/documents/' . $docId, [
            'title' => 'Zatwierdzona Umowa Przejęcia',
            'type' => 'contract',
        ]);

        $updateResponse->assertStatus(200)
            ->assertJsonPath('data.title', 'Zatwierdzona Umowa Przejęcia')
            ->assertJsonPath('data.type', 'contract');

        $this->assertDatabaseHas('documents', [
            'id' => $docId,
            'title' => 'Zatwierdzona Umowa Przejęcia',
            'type' => 'contract',
        ]);
    }

    public function test_archive_and_unarchive_document(): void
    {
        Sanctum::actingAs($this->clientUser);

        $file = UploadedFile::fake()->createWithContent('old.pdf', 'OLD');
        $upload = $this->postJson('/api/v1/documents', [
            'file' => $file,
            'title' => 'Stary Raport 2024',
            'type' => 'financial_report',
        ]);

        $docId = $upload->json('data.id');

        // Archive
        $archiveResponse = $this->patchJson('/api/v1/documents/' . $docId . '/archive');
        $archiveResponse->assertStatus(200)
            ->assertJsonPath('data.is_archived', true);

        // Unarchive
        $unarchiveResponse = $this->patchJson('/api/v1/documents/' . $docId . '/archive');
        $unarchiveResponse->assertStatus(200)
            ->assertJsonPath('data.is_archived', false);
    }

    public function test_delete_document(): void
    {
        Sanctum::actingAs($this->clientUser);

        $file = UploadedFile::fake()->createWithContent('delete_me.pdf', 'DELETE ME');
        $upload = $this->postJson('/api/v1/documents', [
            'file' => $file,
            'title' => 'Dokument do skasowania',
            'type' => 'other',
        ]);

        $docId = $upload->json('data.id');

        $deleteResponse = $this->deleteJson('/api/v1/documents/' . $docId);

        $deleteResponse->assertStatus(200)
            ->assertJsonPath('status', 'deleted');

        $this->assertDatabaseMissing('documents', [
            'id' => $docId,
        ]);
    }

    public function test_cross_tenant_access_is_forbidden_for_client(): void
    {
        // Admin uploads document for Helvest
        Sanctum::actingAs($this->adminUser);

        $file = UploadedFile::fake()->createWithContent('helvest_confidential.pdf', 'POUFNE HELVEST');
        $upload = $this->postJson('/api/v1/documents', [
            'file' => $file,
            'title' => 'Strategia M&A Helvest',
            'type' => 'presentation',
            'company_id' => $this->helvestCompany->id,
        ]);

        $helvestDocId = $upload->json('data.id');

        // Now login as Acme client
        Sanctum::actingAs($this->clientUser);

        // View single
        $this->getJson('/api/v1/documents/' . $helvestDocId)->assertStatus(403);

        // Download
        $this->get('/api/v1/documents/' . $helvestDocId . '/download')->assertStatus(403);

        // Update
        $this->putJson('/api/v1/documents/' . $helvestDocId, [
            'title' => 'Hacked',
            'type' => 'contract',
        ])->assertStatus(403);

        // Delete
        $this->deleteJson('/api/v1/documents/' . $helvestDocId)->assertStatus(403);
    }

    public function test_audit_logs_endpoints(): void
    {
        Sanctum::actingAs($this->clientUser);

        $file = UploadedFile::fake()->createWithContent('audit_test.pdf', 'AUDIT LOG TEST');
        $upload = $this->postJson('/api/v1/documents', [
            'file' => $file,
            'title' => 'Dokument do Audytu',
            'type' => 'tax_declaration',
        ]);

        $docId = $upload->json('data.id');

        // Fetch logs for this document
        $docLogsResponse = $this->getJson('/api/v1/documents/' . $docId . '/audit-logs');
        $docLogsResponse->assertStatus(200)
            ->assertJsonStructure([
                'data' => [
                    '*' => ['id', 'document_id', 'action', 'user', 'created_at'],
                ],
            ]);

        // Fetch all logs for company Data Room
        $allLogsResponse = $this->getJson('/api/v1/documents/audit-logs');
        $allLogsResponse->assertStatus(200);
        $this->assertNotEmpty($allLogsResponse->json('data'));
    }
}
