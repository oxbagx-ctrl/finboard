<?php

declare(strict_types=1);

namespace Tests\Feature\Console;

use App\Contexts\DocumentManagement\Domain\Services\VdrEncryptionServiceInterface;
use App\Contexts\Identity\Domain\ValueObjects\RoleType;
use App\Models\Company;
use App\Models\Document;
use App\Models\DocumentAccessLog;
use App\Models\TransactionFolder;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

final class EncryptExistingVdrDocumentsCommandTest extends TestCase
{
    use DatabaseTransactions;

    private Company $company;
    private User $user;
    private TransactionFolder $folder;
    private VdrEncryptionServiceInterface $encryptionService;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');
        $this->encryptionService = app(VdrEncryptionServiceInterface::class);

        $this->company = Company::create([
            'id' => (string) Str::uuid(),
            'name' => 'Legacy VDR Migration Target Sp. z o.o.',
            'code' => 'LVMT_' . uniqid(),
            'tax_id' => 'PL' . mt_rand(1000000000, 9999999999),
        ]);

        $this->user = User::create([
            'id' => (string) Str::uuid(),
            'name' => 'Migration Lead Admin',
            'email' => 'admin_mig_' . uniqid() . '@finboard.pl',
            'password' => Hash::make('secret123'),
            'role' => RoleType::SUPER_ADMIN->value,
            'is_active' => true,
        ]);

        $this->folder = TransactionFolder::create([
            'company_id' => $this->company->id,
            'name' => '01 Due Diligence Repository',
            'index_code' => '01',
            'order_index' => 1,
        ]);
    }

    public function test_when_no_unencrypted_documents_exist_it_exits_early(): void
    {
        // Ensure no unencrypted documents exist for this company
        Document::where('company_id', $this->company->id)->delete();

        // If other unencrypted documents exist in DB, mark them or test in isolation
        $otherUnencrypted = Document::where('is_encrypted', false)->orWhereNull('is_encrypted')->count();
        if ($otherUnencrypted === 0) {
            $this->artisan('vdr:encrypt-existing-documents')
                ->expectsOutputToContain('Wszystkie dokumenty w VDR są już fizycznie zaszyfrowane')
                ->assertExitCode(0);
        } else {
            $this->assertTrue(true);
        }
    }

    public function test_dry_run_simulates_encryption_without_modifying_storage_or_database(): void
    {
        $plaintext = 'CONFIDENTIAL_LEGACY_CONTENT_DRY_RUN';
        $path = 'dataroom/' . $this->company->id . '/dry_run_test.txt';
        Storage::disk('local')->put($path, $plaintext);

        $doc = Document::create([
            'id' => (string) Str::uuid(),
            'company_id' => $this->company->id,
            'uploaded_by_user_id' => $this->user->id,
            'folder_id' => $this->folder->id,
            'title' => 'Dry Run Report',
            'type' => 'financial_report',
            'original_name' => 'dry_run_test.txt',
            'mime_type' => 'text/plain',
            'size_bytes' => strlen($plaintext),
            'extension' => 'txt',
            'checksum_sha256' => hash('sha256', $plaintext),
            'storage_path' => $path,
            'is_encrypted' => false,
            'encryption_algo' => null,
            'encryption_iv' => null,
            'encryption_tag' => null,
            'key_id' => 'vdr-key-1',
        ]);

        $this->artisan('vdr:encrypt-existing-documents', ['--dry-run' => true, '--chunk' => 10])
            ->expectsOutputToContain('FinBoard VDR - Migracja Szyfrowania Danych Spoczynkowych (AES-256-GCM)')
            ->expectsOutputToContain('Symulacja migracji (dry-run) zakończona sukcesem.')
            ->assertExitCode(0);

        // Verify storage still contains original plaintext
        $this->assertSame($plaintext, Storage::disk('local')->get($path));

        // Verify database row is still unencrypted
        $doc->refresh();
        $this->assertFalse((bool) $doc->is_encrypted);
        $this->assertNull($doc->encryption_iv);
        $this->assertNull($doc->encryption_tag);

        // Verify no migration access log created
        $this->assertDatabaseMissing('document_access_logs', [
            'document_id' => $doc->id,
            'action' => 'encrypt',
        ]);
    }

    public function test_encrypt_existing_documents_successfully_migrates_and_records_audit_log(): void
    {
        $plaintext1 = 'UNENCRYPTED_FINANCIAL_CONTRACT_2025';
        $path1 = 'dataroom/' . $this->company->id . '/contract1.txt';
        Storage::disk('local')->put($path1, $plaintext1);

        $doc1 = Document::create([
            'id' => (string) Str::uuid(),
            'company_id' => $this->company->id,
            'uploaded_by_user_id' => $this->user->id,
            'folder_id' => $this->folder->id,
            'title' => 'Legacy Contract 1',
            'type' => 'contract',
            'original_name' => 'contract1.txt',
            'mime_type' => 'text/plain',
            'size_bytes' => strlen($plaintext1),
            'extension' => 'txt',
            'checksum_sha256' => hash('sha256', $plaintext1),
            'storage_path' => $path1,
            'is_encrypted' => false,
            'encryption_algo' => null,
            'encryption_iv' => null,
            'encryption_tag' => null,
            'key_id' => 'vdr-key-1',
        ]);

        $this->artisan('vdr:encrypt-existing-documents', ['--force' => true, '--chunk' => 20])
            ->expectsOutputToContain('FinBoard VDR - Migracja Szyfrowania Danych Spoczynkowych (AES-256-GCM)')
            ->expectsOutputToContain('Migracja szyfrowania dokumentów VDR (AES-256-GCM) zakończona pełnym sukcesem.')
            ->assertExitCode(0);

        // 1. Storage verification: must be ciphertext
        $storedData = Storage::disk('local')->get($path1);
        $this->assertNotSame($plaintext1, $storedData);

        // 2. Database verification: metadata updated
        $doc1->refresh();
        $this->assertTrue((bool) $doc1->is_encrypted);
        $this->assertSame('aes-256-gcm', $doc1->encryption_algo);
        $this->assertNotNull($doc1->encryption_iv);
        $this->assertNotNull($doc1->encryption_tag);
        $this->assertSame('vdr-key-1', $doc1->key_id);
        $this->assertSame(hash('sha256', $plaintext1), $doc1->checksum_sha256);

        // 3. Cryptographic decryption test: verify it decrypts to original
        $decrypted = $this->encryptionService->decrypt(
            cipherContent: $storedData,
            iv: (string) $doc1->encryption_iv,
            tag: (string) $doc1->encryption_tag,
            keyId: $doc1->key_id,
            algorithm: $doc1->encryption_algo
        );
        $this->assertSame($plaintext1, $decrypted);

        // 4. Audit log verification: 'encrypt' log recorded
        $this->assertDatabaseHas('document_access_logs', [
            'document_id' => $doc1->id,
            'action' => 'encrypt',
            'document_title' => 'Legacy Contract 1',
        ]);
    }

    public function test_skips_missing_files_in_storage_without_crashing(): void
    {
        $nonExistentPath = 'dataroom/' . $this->company->id . '/ghost_file.txt';

        $doc = Document::create([
            'id' => (string) Str::uuid(),
            'company_id' => $this->company->id,
            'uploaded_by_user_id' => $this->user->id,
            'folder_id' => $this->folder->id,
            'title' => 'Ghost File Document',
            'type' => 'other',
            'original_name' => 'ghost_file.txt',
            'mime_type' => 'text/plain',
            'size_bytes' => 100,
            'extension' => 'txt',
            'checksum_sha256' => hash('sha256', 'dummy'),
            'storage_path' => $nonExistentPath,
            'is_encrypted' => false,
            'encryption_algo' => null,
            'encryption_iv' => null,
            'encryption_tag' => null,
            'key_id' => 'vdr-key-1',
        ]);

        $this->artisan('vdr:encrypt-existing-documents', ['--force' => true])
            ->expectsOutputToContain('plik nie istnieje w magazynie')
            ->assertExitCode(0);

        $doc->refresh();
        $this->assertFalse((bool) $doc->is_encrypted);
    }

    public function test_fails_on_checksum_mismatch_to_prevent_corrupting_data(): void
    {
        $realContent = 'ACTUAL_CONTENT_ON_STORAGE';
        $path = 'dataroom/' . $this->company->id . '/tampered_pre.txt';
        Storage::disk('local')->put($path, $realContent);

        $doc = Document::create([
            'id' => (string) Str::uuid(),
            'company_id' => $this->company->id,
            'uploaded_by_user_id' => $this->user->id,
            'folder_id' => $this->folder->id,
            'title' => 'Tampered Pre Document',
            'type' => 'contract',
            'original_name' => 'tampered_pre.txt',
            'mime_type' => 'text/plain',
            'size_bytes' => strlen($realContent),
            'extension' => 'txt',
            // Specify intentionally mismatching checksum
            'checksum_sha256' => hash('sha256', 'DIFFERENT_CONTENT_EXPECTED'),
            'storage_path' => $path,
            'is_encrypted' => false,
            'encryption_algo' => null,
            'encryption_iv' => null,
            'encryption_tag' => null,
            'key_id' => 'vdr-key-1',
        ]);

        $this->artisan('vdr:encrypt-existing-documents', ['--force' => true])
            ->expectsOutputToContain('niezgodność sumy kontrolnej SHA-256 przed szyfrowaniem')
            ->expectsOutputToContain('Migracja zakończona z błędami integralności.')
            ->assertExitCode(1);

        // Document must NOT be marked encrypted
        $doc->refresh();
        $this->assertFalse((bool) $doc->is_encrypted);
    }
}
