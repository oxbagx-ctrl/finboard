<?php

declare(strict_types=1);

namespace Tests\Feature\DocumentManagement;

use App\Contexts\Identity\Domain\ValueObjects\RoleType;
use App\Models\Company;
use App\Models\Document;
use App\Models\DocumentAccessLog;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

final class VdrHardeningSecurityRegressionTest extends TestCase
{
    use DatabaseTransactions;

    private User $superAdmin;
    private User $advisor;
    private User $clientUserA;
    private Company $companyA;
    private Company $companyB;
    private Document $documentA;
    private Document $documentB;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');

        $this->companyA = Company::create([
            'id' => (string) \Illuminate\Support\Str::uuid(),
            'name' => 'Acme Manufacturing Sp. z o.o.',
            'code' => 'ACME_VDR_' . uniqid(),
            'tax_id' => 'PL' . mt_rand(1000000000, 9999999999),
        ]);

        $this->companyB = Company::create([
            'id' => (string) \Illuminate\Support\Str::uuid(),
            'name' => 'Helvest Portfolio S.A.',
            'code' => 'HELVEST_VDR_' . uniqid(),
            'tax_id' => 'PL' . mt_rand(1000000000, 9999999999),
        ]);

        $this->superAdmin = User::create([
            'id' => (string) \Illuminate\Support\Str::uuid(),
            'name' => 'SuperAdmin Managing Partner',
            'email' => 'superadmin_' . uniqid() . '@helvest.com',
            'password' => Hash::make('secret123'),
            'role' => RoleType::SUPER_ADMIN->value,
            'is_active' => true,
        ]);

        $this->advisor = User::create([
            'id' => (string) \Illuminate\Support\Str::uuid(),
            'name' => 'M&A Lead Advisor',
            'email' => 'advisor_' . uniqid() . '@helvest.com',
            'password' => Hash::make('secret123'),
            'role' => RoleType::ADVISOR->value,
            'is_active' => true,
        ]);

        $this->clientUserA = User::create([
            'id' => (string) \Illuminate\Support\Str::uuid(),
            'name' => 'Jan Kowalski (CFO Acme)',
            'email' => 'cfo_' . uniqid() . '@acme.com',
            'password' => Hash::make('secret123'),
            'role' => RoleType::CLIENT->value,
            'company_id' => $this->companyA->id,
            'is_active' => true,
        ]);

        // Explicitly assign advisor ONLY to Company A
        $this->advisor->assignedCompanies()->attach($this->companyA->id, [
            'assigned_by' => $this->superAdmin->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Seed sample documents for Company A and Company B
        $pathA = 'dataroom/' . $this->companyA->id . '/doc_a.pdf';
        Storage::disk('local')->put($pathA, 'ACME CONFIDENTIAL DATA ROOM MEMO');
        $this->documentA = Document::create([
            'id' => 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            'company_id' => $this->companyA->id,
            'uploaded_by_user_id' => $this->clientUserA->id,
            'title' => 'Sprawozdanie Finansowe Acme 2025',
            'type' => 'financial_report',
            'storage_path' => $pathA,
            'original_name' => 'sprawozdanie_acme_2025.pdf',
            'size_bytes' => 1024,
            'mime_type' => 'application/pdf',
            'checksum_sha256' => hash('sha256', 'ACME CONFIDENTIAL DATA ROOM MEMO'),
        ]);

        $pathB = 'dataroom/' . $this->companyB->id . '/doc_b.pdf';
        Storage::disk('local')->put($pathB, 'HELVEST TARGET CONFIDENTIAL');
        $this->documentB = Document::create([
            'id' => 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
            'company_id' => $this->companyB->id,
            'uploaded_by_user_id' => $this->superAdmin->id,
            'title' => 'Helvest Target Valuation Model',
            'type' => 'contract',
            'storage_path' => $pathB,
            'original_name' => 'valuation_model.pdf',
            'size_bytes' => 2048,
            'mime_type' => 'application/pdf',
            'checksum_sha256' => hash('sha256', 'HELVEST TARGET CONFIDENTIAL'),
        ]);
    }

    public function test_advisor_can_access_and_manage_assigned_company_documents_in_vdr(): void
    {
        Sanctum::actingAs($this->advisor);

        // 1. List documents for assigned company
        $indexResponse = $this->getJson('/api/v1/documents?company_id=' . $this->companyA->id);
        $indexResponse->assertStatus(200);
        $this->assertTrue(collect($indexResponse->json('data'))->contains('id', $this->documentA->id));

        // 2. View single document metadata
        $showResponse = $this->getJson('/api/v1/documents/' . $this->documentA->id);
        $showResponse->assertStatus(200)
            ->assertJsonPath('data.title', 'Sprawozdanie Finansowe Acme 2025');

        // 3. Download document
        $downloadResponse = $this->get('/api/v1/documents/' . $this->documentA->id . '/download');
        $downloadResponse->assertStatus(200);
        $this->assertSame('ACME CONFIDENTIAL DATA ROOM MEMO', $downloadResponse->getContent());

        // 4. Update document metadata
        $updateResponse = $this->putJson('/api/v1/documents/' . $this->documentA->id, [
            'title' => 'Zweryfikowane Sprawozdanie Acme 2025',
            'type' => 'audit_report',
        ]);
        $updateResponse->assertStatus(200)
            ->assertJsonPath('data.title', 'Zweryfikowane Sprawozdanie Acme 2025')
            ->assertJsonPath('data.type', 'audit_report');

        // 5. View document audit logs
        $auditResponse = $this->getJson('/api/v1/documents/' . $this->documentA->id . '/audit-logs');
        $auditResponse->assertStatus(200);
    }

    public function test_advisor_is_strictly_forbidden_from_unassigned_company_vdr(): void
    {
        Sanctum::actingAs($this->advisor);

        // Forbidden to show
        $this->getJson('/api/v1/documents/' . $this->documentB->id)->assertStatus(403);

        // Forbidden to download
        $this->get('/api/v1/documents/' . $this->documentB->id . '/download')->assertStatus(403);

        // Forbidden to update
        $this->putJson('/api/v1/documents/' . $this->documentB->id, [
            'title' => 'Tampered Title',
            'type' => 'other',
        ])->assertStatus(403);

        // Forbidden to delete
        $this->deleteJson('/api/v1/documents/' . $this->documentB->id)->assertStatus(403);

        // Forbidden to read audit logs
        $this->getJson('/api/v1/documents/' . $this->documentB->id . '/audit-logs')->assertStatus(403);
    }

    public function test_superadmin_has_global_access_to_all_company_vdrs(): void
    {
        Sanctum::actingAs($this->superAdmin);

        // SuperAdmin can view Company A doc
        $this->getJson('/api/v1/documents/' . $this->documentA->id)->assertStatus(200);

        // SuperAdmin can view Company B doc
        $this->getJson('/api/v1/documents/' . $this->documentB->id)->assertStatus(200);

        // SuperAdmin can download Company A doc
        $this->get('/api/v1/documents/' . $this->documentA->id . '/download')->assertStatus(200);

        // SuperAdmin can download Company B doc
        $this->get('/api/v1/documents/' . $this->documentB->id . '/download')->assertStatus(200);
    }

    public function test_worm_audit_retention_and_soft_delete_preservation(): void
    {
        Sanctum::actingAs($this->clientUserA);

        // 1. Upload a document
        $file = UploadedFile::fake()->createWithContent('audited_contract.pdf', 'CONTRACT CONTENT');
        $upload = $this->postJson('/api/v1/documents', [
            'file' => $file,
            'title' => 'Umowa Inwestycyjna Seria B',
            'type' => 'contract',
        ]);
        $upload->assertStatus(201);
        $docId = $upload->json('data.id');

        // 2. Download it
        $this->get('/api/v1/documents/' . $docId . '/download')->assertStatus(200);

        // 3. Update it
        $this->putJson('/api/v1/documents/' . $docId, [
            'title' => 'Umowa Inwestycyjna Seria B (Podpisana)',
            'type' => 'contract',
        ])->assertStatus(200);

        // 4. Archive it
        $this->patchJson('/api/v1/documents/' . $docId . '/archive')->assertStatus(200);

        // 5. Delete it (should trigger soft delete + destroy audit log)
        $this->deleteJson('/api/v1/documents/' . $docId)->assertStatus(200);

        // Verify document is soft-deleted
        $this->assertSoftDeleted('documents', ['id' => $docId]);

        // Verify all 5 lifecycle logs exist under WORM principle
        $this->assertDatabaseHas('document_access_logs', [
            'document_id' => $docId,
            'action' => 'upload',
            'company_id' => $this->companyA->id,
        ]);

        $this->assertDatabaseHas('document_access_logs', [
            'document_id' => $docId,
            'action' => 'download',
            'company_id' => $this->companyA->id,
        ]);

        $this->assertDatabaseHas('document_access_logs', [
            'document_id' => $docId,
            'action' => 'update',
            'company_id' => $this->companyA->id,
            'document_title' => 'Umowa Inwestycyjna Seria B (Podpisana)',
        ]);

        $this->assertDatabaseHas('document_access_logs', [
            'document_id' => $docId,
            'action' => 'archive',
            'company_id' => $this->companyA->id,
        ]);

        $this->assertDatabaseHas('document_access_logs', [
            'document_id' => $docId,
            'action' => 'destroy',
            'company_id' => $this->companyA->id,
        ]);

        // Verify VDR allAuditLogs returns logs with document_title even for soft-deleted documents
        $allLogsResponse = $this->getJson('/api/v1/documents/audit-logs');
        $allLogsResponse->assertStatus(200);
        $logs = collect($allLogsResponse->json('data'));
        $deletedDocLogs = $logs->where('document_id', $docId);
        $this->assertNotEmpty($deletedDocLogs);
    }

    public function test_upload_size_and_mime_validation_rules(): void
    {
        Sanctum::actingAs($this->clientUserA);

        // 1. Upload valid 48 MB PDF (within 50 MB limit)
        $validFile = UploadedFile::fake()->create('large_due_diligence.pdf', 48 * 1024, 'application/pdf');
        $validResponse = $this->postJson('/api/v1/documents', [
            'file' => $validFile,
            'title' => 'Kompletny Raport Due Diligence 48MB',
            'type' => 'audit_report',
        ]);
        $validResponse->assertStatus(201);

        // 2. Upload file exceeding 50 MB (51 MB = 52224 KB)
        $oversizedFile = UploadedFile::fake()->create('huge_archive.zip', 51 * 1024, 'application/zip');
        $oversizedResponse = $this->postJson('/api/v1/documents', [
            'file' => $oversizedFile,
            'title' => 'Przekroczony Rozmiar',
            'type' => 'other',
        ]);
        $oversizedResponse->assertStatus(422)
            ->assertJsonValidationErrors(['file']);

        // 3. Upload disallowed extensions (executable or script)
        $scriptFile = UploadedFile::fake()->create('exploit.sh', 10, 'application/x-sh');
        $scriptResponse = $this->postJson('/api/v1/documents', [
            'file' => $scriptFile,
            'title' => 'Niebezpieczny Plik',
            'type' => 'other',
        ]);
        $scriptResponse->assertStatus(422)
            ->assertJsonValidationErrors(['file']);

        // 4. Upload allowed Office formats (xlsx, docx)
        $xlsxFile = UploadedFile::fake()->create('financial_model.xlsx', 500, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        $xlsxResponse = $this->postJson('/api/v1/documents', [
            'file' => $xlsxFile,
            'title' => 'Model Finansowy 15L XLSX',
            'type' => 'financial_report',
        ]);
        $xlsxResponse->assertStatus(201);
    }

    public function test_rfc5987_content_disposition_header_encoding_with_polish_characters(): void
    {
        Sanctum::actingAs($this->clientUserA);

        $polishFilename = 'Załącznik nr 1 - Uchwała Zgromadzenia Wspólników.pdf';
        $file = UploadedFile::fake()->createWithContent($polishFilename, 'POLISH UTF-8 CONTENT');

        $upload = $this->postJson('/api/v1/documents', [
            'file' => $file,
            'title' => 'Uchwała Zgromadzenia Wspólników z Polskimi Znakami',
            'type' => 'contract',
        ]);
        $upload->assertStatus(201);
        $docId = $upload->json('data.id');

        $downloadResponse = $this->get('/api/v1/documents/' . $docId . '/download');
        $downloadResponse->assertStatus(200);

        $disposition = $downloadResponse->headers->get('Content-Disposition');
        $this->assertNotNull($disposition);

        // Header must contain attachment
        $this->assertStringContainsString('attachment;', $disposition);

        // Must contain ASCII fallback
        $this->assertStringContainsString('filename="Zalacznik nr 1 - Uchwala Zgromadzenia Wspolnikow.pdf"', $disposition);

        // Must contain UTF-8 encoded filename*=utf-8''
        $this->assertStringContainsString("filename*=utf-8''", $disposition);
        $this->assertStringContainsString(rawurlencode('Załącznik'), $disposition);
    }
}
