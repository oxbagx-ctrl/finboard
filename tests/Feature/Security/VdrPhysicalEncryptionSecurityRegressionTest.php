<?php

declare(strict_types=1);

namespace Tests\Feature\Security;

use App\Contexts\DocumentManagement\Application\Commands\UploadDocument\UploadDocumentCommand;
use App\Contexts\DocumentManagement\Application\Commands\UploadDocument\UploadDocumentHandler;
use App\Contexts\DocumentManagement\Domain\Services\VdrEncryptionServiceInterface;
use App\Contexts\DocumentManagement\Infrastructure\Services\OpenSslVdrEncryptionService;
use App\Contexts\DocumentManagement\Infrastructure\Storage\TransactionalStorageManager;
use App\Contexts\Identity\Domain\ValueObjects\RoleType;
use App\Models\Company;
use App\Models\Document;
use App\Models\User;
use Database\Seeders\DocumentDataSeeder;
use Exception;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

final class VdrPhysicalEncryptionSecurityRegressionTest extends TestCase
{
    use DatabaseTransactions;

    private Company $company;
    private User $admin;
    private VdrEncryptionServiceInterface $encryptionService;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');
        $this->encryptionService = app(VdrEncryptionServiceInterface::class);

        $this->company = Company::create([
            'id' => (string) Str::uuid(),
            'name' => 'Security Audit Alpha Sp. z o.o.',
            'code' => 'SECA_' . uniqid(),
            'tax_id' => 'PL' . mt_rand(1000000000, 9999999999),
        ]);

        $this->admin = User::create([
            'id' => (string) Str::uuid(),
            'name' => 'Chief Security Officer',
            'email' => 'cso_' . uniqid() . '@finboard.pl',
            'password' => Hash::make('secret123'),
            'role' => RoleType::SUPER_ADMIN->value,
            'is_active' => true,
        ]);
    }

    public function test_end_to_end_physical_encryption_and_decryption_lifecycle(): void
    {
        Sanctum::actingAs($this->admin);
        $uploadHandler = app(UploadDocumentHandler::class);

        $plaintext = 'MERGER_ACQUISITION_EXCLUSIVE_VALUATION_2026';
        $originalHash = hash('sha256', $plaintext);

        $doc = $uploadHandler->handle(new UploadDocumentCommand(
            companyId: $this->company->id,
            userId: $this->admin->id,
            title: 'Audit M&A Valuation Dossier',
            type: 'financial_report',
            fileContent: $plaintext,
            originalName: 'valuation_dossier.pdf',
            mimeType: 'application/pdf',
            sizeBytes: strlen($plaintext),
            extension: 'pdf'
        ));

        // 1. Verify storage holds pure ciphertext (never plaintext)
        $disk = Storage::disk(config('vdr.storage.disk', 'local'));
        $rawCipher = $disk->get($doc->storage_path);
        $this->assertNotSame($plaintext, $rawCipher);

        // 2. Verify database metadata
        $this->assertTrue((bool) $doc->is_encrypted);
        $this->assertSame('aes-256-gcm', $doc->encryption_algo);
        $this->assertNotNull($doc->encryption_iv);
        $this->assertNotNull($doc->encryption_tag);
        $this->assertSame($originalHash, $doc->checksum_sha256);

        // 3. Verify download decrypts back to original plaintext
        $response = $this->get("/api/v1/documents/{$doc->id}/download");
        $response->assertStatus(200);
        $this->assertSame($plaintext, $response->getContent());
    }

    public function test_tampering_detection_with_bit_flip_and_corrupted_tag(): void
    {
        Sanctum::actingAs($this->admin);
        $uploadHandler = app(UploadDocumentHandler::class);

        $plaintext = 'TAMPERING_CANARY_VALUE_SENSITIVE';
        $doc = $uploadHandler->handle(new UploadDocumentCommand(
            companyId: $this->company->id,
            userId: $this->admin->id,
            title: 'Canary Tamper Test',
            type: 'contract',
            fileContent: $plaintext,
            originalName: 'canary.pdf',
            mimeType: 'application/pdf',
            sizeBytes: strlen($plaintext),
            extension: 'pdf'
        ));

        $disk = Storage::disk(config('vdr.storage.disk', 'local'));

        // Case A: Flip a bit in ciphertext on storage
        $ciphertext = $disk->get($doc->storage_path);
        $ciphertext[0] = chr(ord($ciphertext[0]) ^ 0x01);
        $disk->put($doc->storage_path, $ciphertext);

        $res = $this->getJson("/api/v1/documents/{$doc->id}/download");
        $res->assertStatus(422);
        $res->assertJsonFragment([
            'message' => 'Błąd weryfikacji integralności kryptograficznej dokumentu (wykryto modyfikację danych).',
        ]);

        // Restore valid ciphertext and corrupt tag in database
        $validCiphertext = chr(ord($ciphertext[0]) ^ 0x01) . substr($ciphertext, 1);
        $disk->put($doc->storage_path, $validCiphertext);

        $doc->update(['encryption_tag' => base64_encode(random_bytes(16))]);

        $res2 = $this->getJson("/api/v1/documents/{$doc->id}/preview");
        $res2->assertStatus(422);
        $res2->assertJsonFragment([
            'message' => 'Błąd weryfikacji integralności kryptograficznej dokumentu (wykryto modyfikację danych).',
        ]);
    }

    public function test_hkdf_fallback_when_vdr_key_missing_produces_deterministic_key(): void
    {
        // Explicitly clear configured VDR key to force HKDF-SHA256 fallback from APP_KEY
        Config::set('vdr.encryption.key', null);
        Config::set('vdr.encryption.keys', []);

        $service = new OpenSslVdrEncryptionService();
        $plaintext = 'DETERMINISTIC_HKDF_FALLBACK_TEST_SECRET';

        $payload = $service->encrypt($plaintext);
        $this->assertNotEmpty($payload->ciphertext());

        // Decrypt with another instance using HKDF fallback
        $service2 = new OpenSslVdrEncryptionService();
        $decrypted = $service2->decrypt(
            cipherContent: $payload->ciphertext(),
            iv: $payload->iv(),
            tag: $payload->tag(),
            keyId: $payload->keyId()
        );

        $this->assertSame($plaintext, $decrypted);
    }

    public function test_seeder_resilience_and_idempotency_with_physical_encryption(): void
    {
        $seeder = new DocumentDataSeeder();

        // Run seeder first time
        $seeder->run();
        $docsCount1 = Document::count();
        $this->assertGreaterThanOrEqual(1, $docsCount1);

        // Run seeder second time (must be idempotent and clean up without duplicates)
        $seeder->run();
        $docsCount2 = Document::count();
        $this->assertSame($docsCount1, $docsCount2);

        // Verify seeded documents are physically encrypted
        $encryptedDocs = Document::where('is_encrypted', true)->get();
        $this->assertCount($docsCount2, $encryptedDocs);

        // Verify each document has a valid file on disk and can be decrypted
        $disk = Storage::disk(config('vdr.storage.disk', 'local'));
        foreach ($encryptedDocs as $d) {
            $this->assertTrue($disk->exists($d->storage_path));
            $rawCipher = $disk->get($d->storage_path);
            $decrypted = $this->encryptionService->decrypt(
                cipherContent: $rawCipher,
                iv: (string) $d->encryption_iv,
                tag: (string) $d->encryption_tag,
                keyId: $d->key_id,
                algorithm: $d->encryption_algo
            );
            $this->assertSame($d->checksum_sha256, hash('sha256', $decrypted));
        }
    }

    public function test_transactional_rollback_preserves_storage_cleanliness_on_database_error(): void
    {
        $storageManager = app(TransactionalStorageManager::class);
        $disk = Storage::disk(config('vdr.storage.disk', 'local'));

        $testContent = 'ENCRYPTED_PAYLOAD_TO_BE_ROLLED_BACK';
        $storedPath = null;

        try {
            $storageManager->transaction(function (TransactionalStorageManager $manager) use (
                $testContent,
                &$storedPath
            ) {
                $storedPath = $manager->store($testContent, 'dataroom/rollback_test', 'canary.enc');

                // Simulate database failure inside transaction
                throw new Exception('Simulated PostgreSQL transaction crash');
            });
        } catch (Exception $e) {
            $this->assertSame('Simulated PostgreSQL transaction crash', $e->getMessage());
        }

        // File must NOT exist on disk after rollback
        $this->assertNotNull($storedPath);
        $this->assertFalse($disk->exists($storedPath));
    }
}
