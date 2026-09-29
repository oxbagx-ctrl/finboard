<?php

declare(strict_types=1);

namespace Tests\Feature\DocumentManagement;

use App\Contexts\DocumentManagement\Application\Commands\UploadDocument\UploadDocumentCommand;
use App\Contexts\DocumentManagement\Application\Commands\UploadDocument\UploadDocumentHandler;
use App\Contexts\DocumentManagement\Domain\Services\VdrEncryptionServiceInterface;
use App\Contexts\Identity\Domain\ValueObjects\RoleType;
use App\Models\Company;
use App\Models\Document;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

final class UploadDocumentEncryptionPipelineTest extends TestCase
{
    use DatabaseTransactions;

    private Company $company;
    private User $user;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');

        $this->company = Company::create([
            'id' => (string) Str::uuid(),
            'name' => 'Solar Horizon Sp. z o.o.',
            'code' => 'SOLAR_' . strtoupper(Str::random(4)),
            'tax_id' => 'PL' . random_int(1000000000, 9999999999),
        ]);

        $this->user = User::create([
            'id' => (string) Str::uuid(),
            'name' => 'Chief Investment Officer',
            'email' => 'cio_' . Str::random(8) . '@solar.local',
            'password' => Hash::make('secret123'),
            'role' => RoleType::CLIENT->value,
            'company_id' => $this->company->id,
            'is_active' => true,
        ]);
    }

    public function test_upload_document_handler_encrypts_file_and_stores_cryptographic_metadata(): void
    {
        $handler = $this->app->make(UploadDocumentHandler::class);
        $encryptionService = $this->app->make(VdrEncryptionServiceInterface::class);

        $plainContent = "%PDF-1.4\n%Confidential Acquisition Offer 2026\nACME Corp Valuation: 45 000 000 PLN";
        $originalChecksum = hash('sha256', $plainContent);

        $command = new UploadDocumentCommand(
            companyId: $this->company->id,
            userId: $this->user->id,
            title: 'Oferta Przejęcia - Projekt Vulcan.pdf',
            type: 'contract',
            fileContent: $plainContent,
            originalName: 'oferta_przejecia_vulcan.pdf',
            mimeType: 'application/pdf',
            sizeBytes: strlen($plainContent),
            extension: 'pdf'
        );

        $doc = $handler->handle($command);

        $this->assertInstanceOf(Document::class, $doc);
        $this->assertTrue($doc->is_encrypted, 'Document must be marked as encrypted.');
        $this->assertSame('aes-256-gcm', $doc->encryption_algo);
        $this->assertNotNull($doc->encryption_iv);
        $this->assertNotNull($doc->encryption_tag);
        $this->assertSame('vdr-key-1', $doc->key_id);
        $this->assertSame($originalChecksum, $doc->checksum_sha256);

        // Verify stored file is encrypted ciphertext
        $this->assertTrue(Storage::disk('local')->exists($doc->storage_path));
        $storedContent = Storage::disk('local')->get($doc->storage_path);
        $this->assertNotNull($storedContent);
        $this->assertNotSame($plainContent, $storedContent, 'Content on disk must be ciphertext, not plaintext.');

        // Decrypt with VDR service and verify against original plaintext and SHA-256
        $decrypted = $encryptionService->decrypt(
            cipherContent: $storedContent,
            iv: $doc->encryption_iv,
            tag: $doc->encryption_tag,
            keyId: $doc->key_id,
            algorithm: $doc->encryption_algo
        );

        $this->assertSame($plainContent, $decrypted);
        $this->assertSame($originalChecksum, hash('sha256', $decrypted));
    }

    public function test_api_upload_endpoint_returns_encrypted_metadata_resource(): void
    {
        Sanctum::actingAs($this->user);

        $plainContent = "%PDF-1.4\n%Due Diligence Financial Audit\nTotal EBITDA: 12 500 000 PLN";
        $uploadedFile = UploadedFile::fake()->createWithContent('audit_report.pdf', $plainContent);

        $response = $this->withHeader('X-Company-ID', $this->company->id)
            ->postJson('/api/v1/documents', [
                'title' => 'Raport Finansowy DD 2026.pdf',
                'type' => 'financial_report',
                'file' => $uploadedFile,
            ]);

        $response->assertStatus(201);
        $response->assertJsonPath('data.title', 'Raport Finansowy DD 2026.pdf');
        $response->assertJsonPath('data.is_encrypted', true);
        $response->assertJsonPath('data.encryption_algo', 'aes-256-gcm');

        $docId = $response->json('data.id');
        $doc = Document::findOrFail($docId);

        $this->assertTrue($doc->is_encrypted);
        $this->assertSame('aes-256-gcm', $doc->encryption_algo);
        $this->assertNotNull($doc->encryption_iv);
        $this->assertNotNull($doc->encryption_tag);

        // Check storage ciphertext
        $storedContent = Storage::disk('local')->get($doc->storage_path);
        $this->assertNotSame($plainContent, $storedContent);
    }
}
