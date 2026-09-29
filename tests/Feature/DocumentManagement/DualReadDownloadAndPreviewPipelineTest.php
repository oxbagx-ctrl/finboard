<?php

declare(strict_types=1);

namespace Tests\Feature\DocumentManagement;

use App\Contexts\DocumentManagement\Domain\Services\VdrEncryptionServiceInterface;
use App\Contexts\Identity\Domain\ValueObjects\RoleType;
use App\Models\Company;
use App\Models\Document;
use App\Models\TransactionFolder;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use setasign\Fpdi\Fpdi;
use Tests\TestCase;

final class DualReadDownloadAndPreviewPipelineTest extends TestCase
{
    use DatabaseTransactions;

    private Company $company;
    private User $adminUser;
    private User $clientUser;
    private TransactionFolder $folder;
    private VdrEncryptionServiceInterface $encryptionService;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');
        $this->encryptionService = app(VdrEncryptionServiceInterface::class);

        $this->company = Company::create([
            'id' => (string) Str::uuid(),
            'name' => 'DualRead Acquisition Partners Sp. z o.o.',
            'code' => 'DRAP_' . uniqid(),
            'tax_id' => 'PL' . mt_rand(1000000000, 9999999999),
        ]);

        $this->adminUser = User::create([
            'id' => (string) Str::uuid(),
            'name' => 'DualRead SuperAdmin',
            'email' => 'admin_dualread_' . uniqid() . '@finboard.pl',
            'password' => Hash::make('secret123'),
            'role' => RoleType::SUPER_ADMIN->value,
            'is_active' => true,
        ]);

        $this->clientUser = User::create([
            'id' => (string) Str::uuid(),
            'name' => 'Investor Client Jan',
            'email' => 'client_dualread_' . uniqid() . '@investor.com',
            'password' => Hash::make('secret123'),
            'role' => RoleType::CLIENT->value,
            'company_id' => $this->company->id,
            'is_active' => true,
        ]);

        $this->folder = TransactionFolder::create([
            'company_id' => $this->company->id,
            'name' => '02 Financial Audit Reports',
            'index_code' => '02',
            'order_index' => 1,
        ]);
    }

    public function test_dual_read_download_legacy_unencrypted_document_returns_plaintext(): void
    {
        Sanctum::actingAs($this->adminUser);

        $plaintext = 'LEGACY_UNENCRYPTED_FINANCIAL_DATA_2024';
        $storagePath = 'dataroom/' . $this->company->id . '/legacy_report.txt';
        Storage::disk('local')->put($storagePath, $plaintext);

        $document = Document::create([
            'id' => (string) Str::uuid(),
            'company_id' => $this->company->id,
            'uploaded_by_user_id' => $this->adminUser->id,
            'folder_id' => $this->folder->id,
            'title' => 'Legacy Plaintext Report',
            'type' => 'audit_report',
            'original_name' => 'legacy_report.txt',
            'mime_type' => 'text/plain',
            'size_bytes' => strlen($plaintext),
            'extension' => 'txt',
            'checksum_sha256' => hash('sha256', $plaintext),
            'storage_path' => $storagePath,
            'is_encrypted' => false,
            'encryption_algo' => null,
            'encryption_iv' => null,
            'encryption_tag' => null,
            'key_id' => 'vdr-key-1',
        ]);

        $response = $this->get("/api/v1/documents/{$document->id}/download");

        $response->assertStatus(200);
        $this->assertSame($plaintext, $response->getContent());
        $response->assertHeader('Content-Disposition', 'attachment; filename=legacy_report.txt');

        $document->refresh();
        $this->assertSame(1, $document->download_count);
    }

    public function test_dual_read_download_encrypted_document_decrypts_and_verifies_gcm_tag(): void
    {
        Sanctum::actingAs($this->adminUser);

        $originalPlaintext = 'TOP_SECRET_M&A_VALUATION_BREAKDOWN_2026';
        $encryptedPayload = $this->encryptionService->encrypt($originalPlaintext);

        $storagePath = 'dataroom/' . $this->company->id . '/encrypted_deal.txt';
        Storage::disk('local')->put($storagePath, $encryptedPayload->ciphertext());

        $document = Document::create([
            'id' => (string) Str::uuid(),
            'company_id' => $this->company->id,
            'uploaded_by_user_id' => $this->adminUser->id,
            'folder_id' => $this->folder->id,
            'title' => 'Encrypted M&A Valuation',
            'type' => 'financial_report',
            'original_name' => 'encrypted_deal.txt',
            'mime_type' => 'text/plain',
            'size_bytes' => strlen($originalPlaintext),
            'extension' => 'txt',
            'checksum_sha256' => hash('sha256', $originalPlaintext),
            'storage_path' => $storagePath,
            'is_encrypted' => true,
            'encryption_algo' => 'aes-256-gcm',
            'encryption_iv' => $encryptedPayload->ivBase64(),
            'encryption_tag' => $encryptedPayload->tagBase64(),
            'key_id' => $encryptedPayload->keyId(),
        ]);

        // Verify that storage contains pure ciphertext (not plaintext)
        $rawStored = Storage::disk('local')->get($storagePath);
        $this->assertNotSame($originalPlaintext, $rawStored);
        $this->assertSame($encryptedPayload->ciphertext(), $rawStored);

        // Download endpoint must decrypt on the fly
        $response = $this->get("/api/v1/documents/{$document->id}/download");

        $response->assertStatus(200);
        $this->assertSame($originalPlaintext, $response->getContent());

        $document->refresh();
        $this->assertSame(1, $document->download_count);

        $this->assertDatabaseHas('document_access_logs', [
            'document_id' => $document->id,
            'action' => 'download',
            'user_id' => $this->adminUser->id,
        ]);
    }

    public function test_dual_read_preview_encrypted_pdf_decrypts_in_memory_and_applies_watermark(): void
    {
        Sanctum::actingAs($this->adminUser);

        // 1. Generate clean 1-page sample PDF
        $fpdf = new Fpdi();
        $fpdf->AddPage();
        $fpdf->SetFont('Helvetica', 'B', 16);
        $fpdf->Cell(40, 10, 'Strictly Confidential Due Diligence Dossier');
        $rawPdf = (string) $fpdf->Output('S');

        // 2. Encrypt PDF with AES-256-GCM
        $encryptedPayload = $this->encryptionService->encrypt($rawPdf);

        $storagePath = 'dataroom/' . $this->company->id . '/encrypted_dossier.pdf';
        Storage::disk('local')->put($storagePath, $encryptedPayload->ciphertext());

        $document = Document::create([
            'id' => (string) Str::uuid(),
            'company_id' => $this->company->id,
            'uploaded_by_user_id' => $this->adminUser->id,
            'folder_id' => $this->folder->id,
            'title' => 'Encrypted Dossier PDF',
            'type' => 'presentation',
            'original_name' => 'encrypted_dossier.pdf',
            'mime_type' => 'application/pdf',
            'size_bytes' => strlen($rawPdf),
            'extension' => 'pdf',
            'checksum_sha256' => hash('sha256', $rawPdf),
            'storage_path' => $storagePath,
            'is_encrypted' => true,
            'encryption_algo' => 'aes-256-gcm',
            'encryption_iv' => $encryptedPayload->ivBase64(),
            'encryption_tag' => $encryptedPayload->tagBase64(),
            'key_id' => $encryptedPayload->keyId(),
        ]);

        // Preview with watermark=true
        $response = $this->get("/api/v1/documents/{$document->id}/preview?watermark=1");

        $response->assertStatus(200);
        $response->assertHeader('Content-Disposition', 'inline; filename=encrypted_dossier.pdf');
        $response->assertHeader('Content-Type', 'application/pdf');

        $previewContent = $response->getContent();
        $this->assertStringStartsWith('%PDF-', $previewContent);
        // Watermarked PDF size is greater than raw PDF due to overlays
        $this->assertGreaterThan(strlen($rawPdf), strlen($previewContent));
    }

    public function test_tampered_ciphertext_fails_gcm_verification_and_returns_422(): void
    {
        Sanctum::actingAs($this->adminUser);

        $originalPlaintext = 'AUTHENTIC_DATA_BEFORE_TAMPERING';
        $encryptedPayload = $this->encryptionService->encrypt($originalPlaintext);

        // Tamper with ciphertext by corrupting bytes
        $tamperedCiphertext = $encryptedPayload->ciphertext();
        $tamperedCiphertext[0] = chr(ord($tamperedCiphertext[0]) ^ 0xFF);

        $storagePath = 'dataroom/' . $this->company->id . '/tampered_doc.txt';
        Storage::disk('local')->put($storagePath, $tamperedCiphertext);

        $document = Document::create([
            'id' => (string) Str::uuid(),
            'company_id' => $this->company->id,
            'uploaded_by_user_id' => $this->adminUser->id,
            'title' => 'Tampered Document Test',
            'type' => 'other',
            'original_name' => 'tampered_doc.txt',
            'mime_type' => 'text/plain',
            'size_bytes' => strlen($originalPlaintext),
            'extension' => 'txt',
            'checksum_sha256' => hash('sha256', $originalPlaintext),
            'storage_path' => $storagePath,
            'is_encrypted' => true,
            'encryption_algo' => 'aes-256-gcm',
            'encryption_iv' => $encryptedPayload->ivBase64(),
            'encryption_tag' => $encryptedPayload->tagBase64(),
            'key_id' => $encryptedPayload->keyId(),
        ]);

        $response = $this->getJson("/api/v1/documents/{$document->id}/download");

        $response->assertStatus(422);
        $response->assertJsonFragment([
            'message' => 'Błąd weryfikacji integralności kryptograficznej dokumentu (wykryto modyfikację danych).',
        ]);
    }

    public function test_tampered_auth_tag_fails_verification_and_returns_422(): void
    {
        Sanctum::actingAs($this->adminUser);

        $originalPlaintext = 'SENSITIVE_ACQUISITION_TARGETS';
        $encryptedPayload = $this->encryptionService->encrypt($originalPlaintext);

        // Tamper with tag
        $tamperedTag = base64_encode(str_repeat("\x00", 16));

        $storagePath = 'dataroom/' . $this->company->id . '/tampered_tag.txt';
        Storage::disk('local')->put($storagePath, $encryptedPayload->ciphertext());

        $document = Document::create([
            'id' => (string) Str::uuid(),
            'company_id' => $this->company->id,
            'uploaded_by_user_id' => $this->adminUser->id,
            'title' => 'Tampered Auth Tag Document',
            'type' => 'other',
            'original_name' => 'tampered_tag.txt',
            'mime_type' => 'text/plain',
            'size_bytes' => strlen($originalPlaintext),
            'extension' => 'txt',
            'checksum_sha256' => hash('sha256', $originalPlaintext),
            'storage_path' => $storagePath,
            'is_encrypted' => true,
            'encryption_algo' => 'aes-256-gcm',
            'encryption_iv' => $encryptedPayload->ivBase64(),
            'encryption_tag' => $tamperedTag,
            'key_id' => $encryptedPayload->keyId(),
        ]);

        $response = $this->getJson("/api/v1/documents/{$document->id}/preview");

        $response->assertStatus(422);
        $response->assertJsonFragment([
            'message' => 'Błąd weryfikacji integralności kryptograficznej dokumentu (wykryto modyfikację danych).',
        ]);
    }

    public function test_unsupported_algorithm_fails_and_returns_500(): void
    {
        Sanctum::actingAs($this->adminUser);

        $originalPlaintext = 'VALID_CONTENT_UNSUPPORTED_ALGO';
        $encryptedPayload = $this->encryptionService->encrypt($originalPlaintext);

        $storagePath = 'dataroom/' . $this->company->id . '/invalid_algo.txt';
        Storage::disk('local')->put($storagePath, $encryptedPayload->ciphertext());

        $document = Document::create([
            'id' => (string) Str::uuid(),
            'company_id' => $this->company->id,
            'uploaded_by_user_id' => $this->adminUser->id,
            'title' => 'Invalid Algo Document',
            'type' => 'other',
            'original_name' => 'invalid_algo.txt',
            'mime_type' => 'text/plain',
            'size_bytes' => strlen($originalPlaintext),
            'extension' => 'txt',
            'checksum_sha256' => hash('sha256', $originalPlaintext),
            'storage_path' => $storagePath,
            'is_encrypted' => true,
            'encryption_algo' => 'aes-128-cbc',
            'encryption_iv' => $encryptedPayload->ivBase64(),
            'encryption_tag' => $encryptedPayload->tagBase64(),
            'key_id' => $encryptedPayload->keyId(),
        ]);

        $response = $this->getJson("/api/v1/documents/{$document->id}/download");

        $response->assertStatus(500);
        $this->assertStringContainsString('Błąd odszyfrowywania dokumentu w magazynie VDR', $response->json('message'));
    }
}
