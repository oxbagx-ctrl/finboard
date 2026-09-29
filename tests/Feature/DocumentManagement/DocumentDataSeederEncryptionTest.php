<?php

declare(strict_types=1);

namespace Tests\Feature\DocumentManagement;

use App\Contexts\DocumentManagement\Domain\Services\VdrEncryptionServiceInterface;
use App\Models\Company;
use App\Models\Document;
use Database\Seeders\DocumentDataSeeder;
use Database\Seeders\IdentitySeeder;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

final class DocumentDataSeederEncryptionTest extends TestCase
{
    use DatabaseTransactions;

    public function test_document_data_seeder_persists_fully_encrypted_demo_files(): void
    {
        // Ensure companies and users exist
        $this->seed(IdentitySeeder::class);

        // Run DocumentDataSeeder
        $this->seed(DocumentDataSeeder::class);

        $encryptionService = $this->app->make(VdrEncryptionServiceInterface::class);

        $acmeCompany = Company::where('code', 'ACME')->firstOrFail();
        $seededDocs = Document::where('company_id', $acmeCompany->id)->get();

        $this->assertNotEmpty($seededDocs, 'Seeder must generate documents for ACME.');

        foreach ($seededDocs as $doc) {
            $this->assertTrue($doc->is_encrypted, "Document '{$doc->title}' must have is_encrypted = true.");
            $this->assertSame('aes-256-gcm', $doc->encryption_algo);
            $this->assertNotNull($doc->encryption_iv);
            $this->assertNotNull($doc->encryption_tag);
            $this->assertSame('vdr-key-1', $doc->key_id);

            // Verify stored content is ciphertext
            $this->assertTrue(Storage::disk('local')->exists($doc->storage_path));
            $cipherContent = Storage::disk('local')->get($doc->storage_path);
            $this->assertNotNull($cipherContent);

            // Verify decrypting ciphertext yields original plaintext matching checksum_sha256
            $decrypted = $encryptionService->decrypt(
                cipherContent: $cipherContent,
                iv: $doc->encryption_iv,
                tag: $doc->encryption_tag,
                keyId: $doc->key_id,
                algorithm: $doc->encryption_algo
            );

            $this->assertSame(
                $doc->checksum_sha256,
                hash('sha256', $decrypted),
                "Decrypted content hash must match checksum_sha256 for '{$doc->title}'."
            );
        }
    }
}
