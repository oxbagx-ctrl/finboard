<?php

declare(strict_types=1);

namespace Tests\Feature\DocumentManagement;

use App\Contexts\DocumentManagement\Application\Commands\DeleteDocument\DeleteDocumentCommand;
use App\Contexts\DocumentManagement\Application\Commands\DeleteDocument\DeleteDocumentHandler;
use App\Contexts\DocumentManagement\Application\Commands\UploadDocument\UploadDocumentCommand;
use App\Contexts\DocumentManagement\Application\Commands\UploadDocument\UploadDocumentHandler;
use App\Contexts\DocumentManagement\Domain\Model\Document as DomainDocument;
use App\Contexts\DocumentManagement\Domain\Repositories\DocumentRepositoryInterface;
use App\Contexts\DocumentManagement\Domain\Services\TransactionalStorageManagerInterface;
use App\Contexts\DocumentManagement\Domain\ValueObjects\DocumentId;
use App\Contexts\Identity\Domain\ValueObjects\RoleType;
use App\Models\Company;
use App\Models\Document;
use App\Models\DocumentAccessLog;
use App\Models\User;
use Exception;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Mockery;
use Tests\TestCase;

final class VdrStorageRollbackAndAuditPaginationIntegrationTest extends TestCase
{
    use DatabaseTransactions;

    private User $clientUserA;
    private User $clientUserB;
    private Company $companyA;
    private Company $companyB;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');

        $this->companyA = Company::create([
            'id' => (string) Str::uuid(),
            'name' => 'Acme Corporation Sp. z o.o.',
            'code' => 'ACME_TEST_' . uniqid(),
            'tax_id' => 'PL' . mt_rand(1000000000, 9999999999),
        ]);

        $this->companyB = Company::create([
            'id' => (string) Str::uuid(),
            'name' => 'Stark Industries S.A.',
            'code' => 'STARK_TEST_' . uniqid(),
            'tax_id' => 'PL' . mt_rand(1000000000, 9999999999),
        ]);

        $this->clientUserA = User::create([
            'id' => (string) Str::uuid(),
            'name' => 'Kowalski CFO',
            'email' => 'cfo_acme_' . uniqid() . '@acme.com',
            'password' => Hash::make('password123'),
            'role' => RoleType::CLIENT->value,
            'company_id' => $this->companyA->id,
            'is_active' => true,
        ]);

        $this->clientUserB = User::create([
            'id' => (string) Str::uuid(),
            'name' => 'Stark Executive',
            'email' => 'exec_stark_' . uniqid() . '@stark.com',
            'password' => Hash::make('password123'),
            'role' => RoleType::CLIENT->value,
            'company_id' => $this->companyB->id,
            'is_active' => true,
        ]);
    }

    public function test_upload_storage_rollback_removes_file_when_database_fails(): void
    {
        Sanctum::actingAs($this->clientUserA);

        $mockRepo = Mockery::mock(DocumentRepositoryInterface::class);
        $mockRepo->shouldReceive('save')
            ->once()
            ->andThrow(new Exception('Simulated database deadlock during document insertion'));

        $this->app->instance(DocumentRepositoryInterface::class, $mockRepo);

        $uploadHandler = $this->app->make(UploadDocumentHandler::class);

        $fileContent = 'TAJNY_RAPORT_FINANSOWY_DO_ROLLBACKU';
        $command = new UploadDocumentCommand(
            companyId: $this->companyA->id,
            userId: $this->clientUserA->id,
            title: 'Raport do wycofania',
            type: 'financial_report',
            fileContent: $fileContent,
            originalName: 'rollback_test.pdf',
            mimeType: 'application/pdf',
            sizeBytes: strlen($fileContent),
            extension: 'pdf'
        );

        $exceptionThrown = false;
        try {
            $uploadHandler->handle($command);
        } catch (Exception $e) {
            $exceptionThrown = true;
            $this->assertStringContainsString('Simulated database deadlock', $e->getMessage());
        }

        $this->assertTrue($exceptionThrown, 'Exception should have been thrown from transaction');

        // Storage rollback must have deleted any written file in the dataroom directory
        $storedFiles = Storage::disk('local')->allFiles('dataroom/' . $this->companyA->id);
        $this->assertEmpty($storedFiles, 'Orphan file must be cleaned up on transaction rollback');

        // No document in DB
        $this->assertDatabaseMissing('documents', [
            'title' => 'Raport do wycofania',
            'company_id' => $this->companyA->id,
        ]);
    }

    public function test_delete_staged_deletion_is_aborted_when_database_fails(): void
    {
        // First upload a valid document
        $uploadHandler = $this->app->make(UploadDocumentHandler::class);
        $fileContent = 'DOKUMENT_KTORY_NIE_POWINIEN_BYC_USUNIETY';

        $doc = $uploadHandler->handle(new UploadDocumentCommand(
            companyId: $this->companyA->id,
            userId: $this->clientUserA->id,
            title: 'Ważna Umowa Zachowana',
            type: 'contract',
            fileContent: $fileContent,
            originalName: 'zachowana.pdf',
            mimeType: 'application/pdf',
            sizeBytes: strlen($fileContent),
            extension: 'pdf'
        ));

        // Verify file exists
        Storage::disk('local')->assertExists($doc->storage_path);

        // Now attempt to delete with a failing repository
        $mockRepo = Mockery::mock(DocumentRepositoryInterface::class);
        $mockRepo->shouldReceive('findById')
            ->once()
            ->andReturn(DomainDocument::upload(
                id: DocumentId::fromString($doc->id),
                companyId: $this->companyA->id,
                uploadedByUserId: $this->clientUserA->id,
                title: $doc->title,
                type: \App\Contexts\DocumentManagement\Domain\ValueObjects\DocumentType::from($doc->type),
                fileMetadata: new \App\Contexts\DocumentManagement\Domain\ValueObjects\FileMetadata(
                    originalName: $doc->original_name,
                    mimeType: $doc->mime_type,
                    sizeInBytes: (int) $doc->size_bytes,
                    checksumSha256: $doc->checksum_sha256
                ),
                storagePath: $doc->storage_path
            ));

        $mockRepo->shouldReceive('logAccess')->once();
        $mockRepo->shouldReceive('delete')
            ->once()
            ->andThrow(new Exception('Foreign key constraint violation during deletion'));

        $this->app->instance(DocumentRepositoryInterface::class, $mockRepo);

        $deleteHandler = $this->app->make(DeleteDocumentHandler::class);

        $exceptionThrown = false;
        try {
            $deleteHandler->handle(new DeleteDocumentCommand(
                id: $doc->id,
                userId: $this->clientUserA->id
            ));
        } catch (Exception $e) {
            $exceptionThrown = true;
            $this->assertStringContainsString('Foreign key constraint violation', $e->getMessage());
        }

        $this->assertTrue($exceptionThrown);

        // Staged deletion must have been aborted, file still exists on disk
        Storage::disk('local')->assertExists($doc->storage_path);
    }

    public function test_delete_staged_deletion_removes_file_on_successful_commit(): void
    {
        Sanctum::actingAs($this->clientUserA);

        $file = UploadedFile::fake()->createWithContent('to_delete.pdf', 'TRESC_PLIKU_DO_USUNIECIA');

        $uploadResponse = $this->postJson('/api/v1/documents', [
            'file' => $file,
            'title' => 'Plik Do Trwalego Skasowania',
            'type' => 'other',
        ]);

        $uploadResponse->assertStatus(201);
        $docId = $uploadResponse->json('data.id');

        $doc = Document::findOrFail($docId);
        Storage::disk('local')->assertExists($doc->storage_path);

        // Execute API deletion
        $deleteResponse = $this->deleteJson('/api/v1/documents/' . $docId);
        $deleteResponse->assertStatus(200);

        // Document must be soft-deleted
        $this->assertSoftDeleted('documents', [
            'id' => $docId,
        ]);

        // Physical file must be removed from disk via stageDeletion
        Storage::disk('local')->assertMissing($doc->storage_path);

        // Destroy audit log is preserved
        $this->assertDatabaseHas('document_access_logs', [
            'document_id' => $docId,
            'action' => 'destroy',
            'user_id' => $this->clientUserA->id,
        ]);
    }

    public function test_server_side_vdr_audit_logs_pagination_and_action_filtering(): void
    {
        Sanctum::actingAs($this->clientUserA);

        // Seed 32 audit logs for Company A
        // 14 uploads, 10 downloads, 4 updates, 4 destroys
        $actions = array_merge(
            array_fill(0, 14, 'upload'),
            array_fill(0, 10, 'download'),
            array_fill(0, 4, 'update'),
            array_fill(0, 4, 'destroy')
        );

        // Create real documents for Company A
        $docA = Document::create([
            'id' => (string) Str::uuid(),
            'company_id' => $this->companyA->id,
            'uploaded_by_user_id' => $this->clientUserA->id,
            'title' => 'Główny Raport Audytowy',
            'type' => 'financial_report',
            'original_name' => 'raport.pdf',
            'mime_type' => 'application/pdf',
            'size_bytes' => 1024,
            'checksum_sha256' => hash('sha256', 'dummy'),
            'storage_path' => 'dataroom/' . $this->companyA->id . '/dummy.pdf',
        ]);

        foreach ($actions as $index => $action) {
            DocumentAccessLog::create([
                'id' => (string) Str::uuid(),
                'document_id' => $docA->id,
                'document_title' => "Dokument Audytowy A {$index}",
                'company_id' => $this->companyA->id,
                'user_id' => $this->clientUserA->id,
                'action' => $action,
                'ip_address' => "192.168.1.{$index}",
                'user_agent' => 'IntegrationTest/1.0',
                'created_at' => now()->subMinutes(100 - $index),
            ]);
        }

        // Create a real document for Company B
        $docB = Document::create([
            'id' => (string) Str::uuid(),
            'company_id' => $this->companyB->id,
            'uploaded_by_user_id' => $this->clientUserB->id,
            'title' => 'Dokument Spółki B',
            'type' => 'financial_report',
            'original_name' => 'raport_b.pdf',
            'mime_type' => 'application/pdf',
            'size_bytes' => 1024,
            'checksum_sha256' => hash('sha256', 'dummy_b'),
            'storage_path' => 'dataroom/' . $this->companyB->id . '/dummy_b.pdf',
        ]);

        // Seed 8 audit logs for Company B (Tenant isolation check)
        for ($i = 0; $i < 8; $i++) {
            DocumentAccessLog::create([
                'id' => (string) Str::uuid(),
                'document_id' => $docB->id,
                'document_title' => "Poufny Dokument B {$i}",
                'company_id' => $this->companyB->id,
                'user_id' => $this->clientUserB->id,
                'action' => 'upload',
                'ip_address' => '10.0.0.1',
                'user_agent' => 'TenantB/1.0',
                'created_at' => now(),
            ]);
        }

        // 1. Verify default pagination: page=1, per_page=15
        $page1Response = $this->getJson('/api/v1/documents/audit-logs?per_page=15&page=1');
        $page1Response->assertStatus(200)
            ->assertJsonCount(15, 'data')
            ->assertJsonPath('meta.current_page', 1)
            ->assertJsonPath('meta.per_page', 15)
            ->assertJsonPath('meta.total', 32)
            ->assertJsonPath('meta.last_page', 3);

        // 2. Verify page 2: per_page=15, page=2
        $page2Response = $this->getJson('/api/v1/documents/audit-logs?per_page=15&page=2');
        $page2Response->assertStatus(200)
            ->assertJsonCount(15, 'data')
            ->assertJsonPath('meta.current_page', 2);

        // 3. Verify page 3: per_page=15, page=3 (remaining 2 records)
        $page3Response = $this->getJson('/api/v1/documents/audit-logs?per_page=15&page=3');
        $page3Response->assertStatus(200)
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('meta.current_page', 3);

        // 4. Verify single action filter: action=upload (14 records total)
        $uploadOnlyResponse = $this->getJson('/api/v1/documents/audit-logs?action=upload&per_page=10&page=1');
        $uploadOnlyResponse->assertStatus(200)
            ->assertJsonCount(10, 'data')
            ->assertJsonPath('meta.total', 14)
            ->assertJsonPath('meta.last_page', 2);

        foreach ($uploadOnlyResponse->json('data') as $log) {
            $this->assertSame('upload', $log['action']);
            $this->assertSame($this->companyA->id, $log['company_id']);
        }

        // Page 2 of uploads (remaining 4 records)
        $uploadPage2 = $this->getJson('/api/v1/documents/audit-logs?action=upload&per_page=10&page=2');
        $uploadPage2->assertStatus(200)
            ->assertJsonCount(4, 'data');

        // 5. Verify comma-separated actions filter: action=upload,download (14 + 10 = 24 records total)
        $comboResponse = $this->getJson('/api/v1/documents/audit-logs?action=upload,download&per_page=20&page=1');
        $comboResponse->assertStatus(200)
            ->assertJsonCount(20, 'data')
            ->assertJsonPath('meta.total', 24)
            ->assertJsonPath('meta.last_page', 2);

        foreach ($comboResponse->json('data') as $log) {
            $this->assertContains($log['action'], ['upload', 'download']);
        }

        // 6. Verify cross-tenant isolation: None of Company B's logs are returned
        $allLogsResponse = $this->getJson('/api/v1/documents/audit-logs?per_page=50');
        $allLogsResponse->assertStatus(200)
            ->assertJsonPath('meta.total', 32);

        foreach ($allLogsResponse->json('data') as $log) {
            $this->assertSame($this->companyA->id, $log['company_id']);
            $this->assertStringNotContainsString('Poufny Dokument B', $log['document_title']);
        }
    }

    public function test_server_side_vdr_audit_logs_search_filter_pagination(): void
    {
        Sanctum::actingAs($this->clientUserA);

        $docA = Document::create([
            'id' => (string) Str::uuid(),
            'company_id' => $this->companyA->id,
            'uploaded_by_user_id' => $this->clientUserA->id,
            'title' => 'Dokument Bazowy',
            'type' => 'financial_report',
            'original_name' => 'bazowy.pdf',
            'mime_type' => 'application/pdf',
            'size_bytes' => 1024,
            'checksum_sha256' => hash('sha256', 'dummy_base'),
            'storage_path' => 'dataroom/' . $this->companyA->id . '/bazowy.pdf',
        ]);

        // Seed 12 logs containing "Sprawozdanie Zarządu" and 10 logs with "Umowa Spółki"
        for ($i = 0; $i < 12; $i++) {
            DocumentAccessLog::create([
                'id' => (string) Str::uuid(),
                'document_id' => $docA->id,
                'document_title' => "Sprawozdanie Zarządu za rok 202{$i}",
                'company_id' => $this->companyA->id,
                'user_id' => $this->clientUserA->id,
                'action' => 'upload',
                'ip_address' => '172.16.0.1',
                'user_agent' => 'Mozilla/5.0',
                'created_at' => now()->subHours($i + 1),
            ]);
        }

        for ($j = 0; $j < 10; $j++) {
            DocumentAccessLog::create([
                'id' => (string) Str::uuid(),
                'document_id' => $docA->id,
                'document_title' => "Umowa Spółki Seria {$j}",
                'company_id' => $this->companyA->id,
                'user_id' => $this->clientUserA->id,
                'action' => 'download',
                'ip_address' => '172.16.0.2',
                'user_agent' => 'Mozilla/5.0',
                'created_at' => now()->subHours($j + 13),
            ]);
        }

        // Search for "sprawozdanie" (case-insensitive) with per_page=5
        $searchResponse = $this->getJson('/api/v1/documents/audit-logs?search=sprawozdanie&per_page=5&page=1');
        $searchResponse->assertStatus(200)
            ->assertJsonCount(5, 'data')
            ->assertJsonPath('meta.total', 12)
            ->assertJsonPath('meta.last_page', 3)
            ->assertJsonPath('meta.current_page', 1);

        foreach ($searchResponse->json('data') as $log) {
            $this->assertStringContainsStringIgnoringCase('sprawozdanie', $log['document_title']);
        }

        // Verify page 3 of search (remaining 2 records, eliminating blank pagination pages)
        $searchPage3 = $this->getJson('/api/v1/documents/audit-logs?search=sprawozdanie&per_page=5&page=3');
        $searchPage3->assertStatus(200)
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('meta.current_page', 3);
    }
}
