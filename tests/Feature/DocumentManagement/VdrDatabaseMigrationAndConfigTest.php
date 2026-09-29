<?php

declare(strict_types=1);

namespace Tests\Feature\DocumentManagement;

use App\Contexts\Identity\Domain\ValueObjects\RoleType;
use App\Models\Company;
use App\Models\Document;
use App\Models\User;
use App\Presentation\Api\Resources\DocumentResource;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

final class VdrDatabaseMigrationAndConfigTest extends TestCase
{
    use DatabaseTransactions;

    private Company $company;
    private User $user;

    protected function setUp(): void
    {
        parent::setUp();

        $this->company = Company::create([
            'id' => (string) Str::uuid(),
            'name' => 'VDR Test Holdings S.A.',
            'code' => 'VDR_' . strtoupper(Str::random(4)),
            'tax_id' => 'PL' . random_int(1000000000, 9999999999),
        ]);

        $this->user = User::create([
            'id' => (string) Str::uuid(),
            'name' => 'Security Officer',
            'email' => 'sec_' . Str::random(8) . '@finboard.local',
            'password' => Hash::make('secret123'),
            'role' => RoleType::CLIENT->value,
            'is_active' => true,
        ]);
    }

    public function test_documents_table_has_all_encryption_metadata_columns(): void
    {
        $this->assertTrue(Schema::hasTable('documents'), 'Table documents must exist.');

        $expectedColumns = [
            'is_encrypted',
            'encryption_algo',
            'encryption_iv',
            'encryption_tag',
            'key_id',
        ];

        $this->assertTrue(
            Schema::hasColumns('documents', $expectedColumns),
            'Table documents must include all encryption metadata columns.'
        );
    }

    public function test_document_defaults_to_unencrypted_legacy_state(): void
    {
        $doc = Document::create([
            'id' => (string) Str::uuid(),
            'company_id' => $this->company->id,
            'uploaded_by_user_id' => $this->user->id,
            'title' => 'Legacy Plaintext NDA.pdf',
            'type' => 'contract',
            'original_name' => 'nda_plaintext.pdf',
            'mime_type' => 'application/pdf',
            'size_bytes' => 1024,
            'checksum_sha256' => hash('sha256', 'sample-content'),
            'storage_path' => 'dataroom/' . $this->company->id . '/sample.pdf',
        ]);

        $this->assertFalse($doc->is_encrypted);
        $this->assertNull($doc->encryption_algo);
        $this->assertNull($doc->encryption_iv);
        $this->assertNull($doc->encryption_tag);
        $this->assertSame('vdr-key-1', $doc->key_id);

        $fresh = Document::findOrFail($doc->id);
        $this->assertFalse($fresh->is_encrypted);
        $this->assertNull($fresh->encryption_algo);
        $this->assertSame('vdr-key-1', $fresh->key_id);
    }

    public function test_document_can_persist_aes_256_gcm_metadata(): void
    {
        $doc = Document::create([
            'id' => (string) Str::uuid(),
            'company_id' => $this->company->id,
            'uploaded_by_user_id' => $this->user->id,
            'title' => 'Encrypted Financial Audit.pdf',
            'type' => 'financial_report',
            'original_name' => 'audit_report.pdf',
            'mime_type' => 'application/pdf',
            'size_bytes' => 2048,
            'checksum_sha256' => hash('sha256', 'encrypted-sample-content'),
            'storage_path' => 'dataroom/' . $this->company->id . '/enc_sample.bin',
            'is_encrypted' => true,
            'encryption_algo' => 'aes-256-gcm',
            'encryption_iv' => base64_encode(random_bytes(12)),
            'encryption_tag' => base64_encode(random_bytes(16)),
            'key_id' => 'vdr-key-2026',
        ]);

        $fresh = Document::findOrFail($doc->id);
        $this->assertTrue($fresh->is_encrypted);
        $this->assertSame('aes-256-gcm', $fresh->encryption_algo);
        $this->assertNotNull($fresh->encryption_iv);
        $this->assertNotNull($fresh->encryption_tag);
        $this->assertSame('vdr-key-2026', $fresh->key_id);
    }

    public function test_document_resource_exposes_encryption_attributes(): void
    {
        $doc = Document::create([
            'id' => (string) Str::uuid(),
            'company_id' => $this->company->id,
            'uploaded_by_user_id' => $this->user->id,
            'title' => 'Encrypted M&A Valuation.pdf',
            'type' => 'presentation',
            'original_name' => 'valuation.pdf',
            'mime_type' => 'application/pdf',
            'size_bytes' => 4096,
            'checksum_sha256' => hash('sha256', 'valuation-content'),
            'storage_path' => 'dataroom/' . $this->company->id . '/val.bin',
            'is_encrypted' => true,
            'encryption_algo' => 'aes-256-gcm',
            'encryption_iv' => base64_encode(random_bytes(12)),
            'encryption_tag' => base64_encode(random_bytes(16)),
            'key_id' => 'vdr-key-1',
        ]);

        $resource = new DocumentResource($doc);
        $serialized = $resource->toArray(Request::create('/api/v1/documents/' . $doc->id));

        $this->assertArrayHasKey('is_encrypted', $serialized);
        $this->assertArrayHasKey('encryption_algo', $serialized);
        $this->assertTrue($serialized['is_encrypted']);
        $this->assertSame('aes-256-gcm', $serialized['encryption_algo']);
    }

    public function test_vdr_configuration_file_is_registered_and_valid(): void
    {
        $config = Config::get('vdr');

        $this->assertIsArray($config, 'config/vdr.php must return an array.');
        $this->assertArrayHasKey('encryption', $config);
        $this->assertArrayHasKey('storage', $config);

        $encryption = $config['encryption'];
        $this->assertTrue($encryption['enabled']);
        $this->assertSame('aes-256-gcm', $encryption['algorithm']);
        $this->assertSame('vdr-key-1', $encryption['active_key_id']);
        $this->assertSame('vdr-storage-aes-256-gcm', $encryption['hkdf_info']);

        $storage = $config['storage'];
        $this->assertSame('local', $storage['disk']);
        $this->assertSame('dataroom', $storage['base_directory']);
    }
}
