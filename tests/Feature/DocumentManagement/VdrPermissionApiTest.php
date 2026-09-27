<?php

declare(strict_types=1);

namespace Tests\Feature\DocumentManagement;

use App\Contexts\Identity\Domain\ValueObjects\RoleType;
use App\Models\Company;
use App\Models\Document;
use App\Models\TransactionFolder;
use App\Models\User;
use App\Models\VdrDocumentPermission;
use App\Models\VdrFolderPermission;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

final class VdrPermissionApiTest extends TestCase
{
    use DatabaseTransactions;

    private Company $companyA;
    private Company $companyB;
    private User $superAdmin;
    private User $advisorA;
    private User $advisorB;
    private User $clientA;
    private TransactionFolder $folderA;
    private Document $documentA;

    protected function setUp(): void
    {
        parent::setUp();

        $this->companyA = Company::create([
            'id' => (string) Str::uuid(),
            'name' => 'Acme Corporation Sp. z o.o.',
            'code' => 'ACME_VDR_' . uniqid(),
            'tax_id' => 'PL' . mt_rand(1000000000, 9999999999),
        ]);

        $this->companyB = Company::create([
            'id' => (string) Str::uuid(),
            'name' => 'Beta Holding S.A.',
            'code' => 'BETA_VDR_' . uniqid(),
            'tax_id' => 'PL' . mt_rand(1000000000, 9999999999),
        ]);

        $this->superAdmin = User::create([
            'id' => (string) Str::uuid(),
            'name' => 'Super Administrator',
            'email' => 'admin_vdr_' . uniqid() . '@finboard.pl',
            'password' => Hash::make('secret123'),
            'role' => RoleType::SUPER_ADMIN->value,
            'is_active' => true,
        ]);

        $this->advisorA = User::create([
            'id' => (string) Str::uuid(),
            'name' => 'Lead Advisor A',
            'email' => 'advisor_a_' . uniqid() . '@finboard.pl',
            'password' => Hash::make('secret123'),
            'role' => RoleType::ADVISOR->value,
            'is_active' => true,
        ]);
        $this->advisorA->assignedCompanies()->attach($this->companyA->id, [
            'assigned_by' => $this->superAdmin->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->advisorB = User::create([
            'id' => (string) Str::uuid(),
            'name' => 'Advisor B (Unassigned to A)',
            'email' => 'advisor_b_' . uniqid() . '@finboard.pl',
            'password' => Hash::make('secret123'),
            'role' => RoleType::ADVISOR->value,
            'is_active' => true,
        ]);
        $this->advisorB->assignedCompanies()->attach($this->companyB->id, [
            'assigned_by' => $this->superAdmin->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->clientA = User::create([
            'id' => (string) Str::uuid(),
            'name' => 'Client Officer A',
            'email' => 'client_a_' . uniqid() . '@acme.com',
            'password' => Hash::make('secret123'),
            'role' => RoleType::CLIENT->value,
            'company_id' => $this->companyA->id,
            'is_active' => true,
        ]);

        $this->folderA = TransactionFolder::create([
            'company_id' => $this->companyA->id,
            'name' => '01 Due Diligence Legal',
            'index_code' => '01',
            'order_index' => 1,
        ]);

        $this->documentA = Document::create([
            'company_id' => $this->companyA->id,
            'folder_id' => $this->folderA->id,
            'uploaded_by_user_id' => $this->advisorA->id,
            'title' => 'NDA and Exclusivity Agreement',
            'type' => 'contract',
            'storage_path' => 'dataroom/' . $this->companyA->id . '/nda.pdf',
            'original_name' => 'nda.pdf',
            'size_bytes' => 2048,
            'mime_type' => 'application/pdf',
            'checksum_sha256' => hash('sha256', 'mock-nda-content'),
        ]);
    }

    public function test_unauthenticated_request_returns_401(): void
    {
        $this->getJson('/api/v1/documents/permissions/matrix')->assertStatus(401);
        $this->getJson('/api/v1/documents/permissions/effective')->assertStatus(401);
        $this->postJson('/api/v1/documents/permissions/folders/' . $this->folderA->id, [])->assertStatus(401);
    }

    public function test_matrix_endpoint_accessible_by_advisor_and_superadmin(): void
    {
        // 1. Advisor assigned to Company A
        Sanctum::actingAs($this->advisorA);
        $response = $this->getJson('/api/v1/documents/permissions/matrix?company_id=' . $this->companyA->id);
        $response->assertStatus(200)
            ->assertJsonPath('data.company_id', $this->companyA->id)
            ->assertJsonStructure([
                'data' => [
                    'company_id',
                    'folder_permissions',
                    'document_permissions',
                    'available_roles',
                    'available_levels',
                ],
            ]);

        // 2. SuperAdmin
        Sanctum::actingAs($this->superAdmin);
        $adminResponse = $this->getJson('/api/v1/documents/permissions/matrix?company_id=' . $this->companyA->id);
        $adminResponse->assertStatus(200)
            ->assertJsonPath('data.company_id', $this->companyA->id);
    }

    public function test_matrix_endpoint_forbidden_for_client_and_unassigned_advisor(): void
    {
        // Client cannot access matrix
        Sanctum::actingAs($this->clientA);
        $this->getJson('/api/v1/documents/permissions/matrix?company_id=' . $this->companyA->id)->assertStatus(403);

        // Advisor B cannot access Company A matrix
        Sanctum::actingAs($this->advisorB);
        $this->getJson('/api/v1/documents/permissions/matrix?company_id=' . $this->companyA->id)->assertStatus(403);
    }

    public function test_set_folder_permission_endpoint(): void
    {
        Sanctum::actingAs($this->advisorA);

        // 1. Set role permission on folder
        $payload = [
            'subject_type' => 'role',
            'subject_id' => 'client',
            'permission_level' => 'view',
            'watermark_required' => true,
            'company_id' => $this->companyA->id,
        ];

        $response = $this->postJson('/api/v1/documents/permissions/folders/' . $this->folderA->id, $payload);
        $response->assertStatus(200)
            ->assertJsonPath('data.folder_id', (string) $this->folderA->id)
            ->assertJsonPath('data.subject_type', 'role')
            ->assertJsonPath('data.subject_id', 'client')
            ->assertJsonPath('data.permission_level', 'view')
            ->assertJsonPath('data.watermark_required', true);

        $this->assertDatabaseHas('vdr_folder_permissions', [
            'folder_id' => $this->folderA->id,
            'subject_type' => 'role',
            'subject_id' => 'client',
            'permission_level' => 'view',
            'watermark_required' => true,
        ]);

        // 2. Update existing permission: change to download, watermark false
        $updatePayload = [
            'subject_type' => 'role',
            'subject_id' => 'client',
            'permission_level' => 'download',
            'watermark_required' => false,
            'company_id' => $this->companyA->id,
        ];

        $updateResponse = $this->postJson('/api/v1/documents/permissions/folders/' . $this->folderA->id, $updatePayload);
        $updateResponse->assertStatus(200)
            ->assertJsonPath('data.permission_level', 'download')
            ->assertJsonPath('data.watermark_required', false);

        $this->assertDatabaseHas('vdr_folder_permissions', [
            'folder_id' => $this->folderA->id,
            'permission_level' => 'download',
            'watermark_required' => false,
        ]);
    }

    public function test_set_document_permission_endpoint(): void
    {
        Sanctum::actingAs($this->advisorA);

        $payload = [
            'subject_type' => 'user',
            'subject_id' => (string) $this->clientA->id,
            'permission_level' => 'none',
            'watermark_required' => true,
            'company_id' => $this->companyA->id,
        ];

        $response = $this->postJson('/api/v1/documents/permissions/documents/' . $this->documentA->id, $payload);
        $response->assertStatus(200)
            ->assertJsonPath('data.document_id', (string) $this->documentA->id)
            ->assertJsonPath('data.subject_type', 'user')
            ->assertJsonPath('data.subject_id', (string) $this->clientA->id)
            ->assertJsonPath('data.permission_level', 'none')
            ->assertJsonPath('data.watermark_required', true);

        $this->assertDatabaseHas('vdr_document_permissions', [
            'document_id' => $this->documentA->id,
            'subject_type' => 'user',
            'subject_id' => (string) $this->clientA->id,
            'permission_level' => 'none',
        ]);
    }

    public function test_revoke_folder_and_document_permissions(): void
    {
        Sanctum::actingAs($this->advisorA);

        // Create folder perm and doc perm
        $folderPerm = VdrFolderPermission::create([
            'id' => (string) Str::uuid(),
            'company_id' => $this->companyA->id,
            'folder_id' => $this->folderA->id,
            'subject_type' => 'role',
            'subject_id' => 'client',
            'permission_level' => 'view',
            'watermark_required' => true,
        ]);

        $docPerm = VdrDocumentPermission::create([
            'id' => (string) Str::uuid(),
            'company_id' => $this->companyA->id,
            'document_id' => $this->documentA->id,
            'subject_type' => 'role',
            'subject_id' => 'client',
            'permission_level' => 'download',
            'watermark_required' => false,
        ]);

        // Revoke folder permission
        $this->deleteJson('/api/v1/documents/permissions/folder/' . $folderPerm->id . '?company_id=' . $this->companyA->id)
            ->assertStatus(200);

        $this->assertDatabaseMissing('vdr_folder_permissions', ['id' => $folderPerm->id]);

        // Revoke document permission
        $this->deleteJson('/api/v1/documents/permissions/document/' . $docPerm->id . '?company_id=' . $this->companyA->id)
            ->assertStatus(200);

        $this->assertDatabaseMissing('vdr_document_permissions', ['id' => $docPerm->id]);
    }

    public function test_effective_permission_endpoint(): void
    {
        // 1. Client checks effective permission on document (falls back to client default: VIEW with watermark)
        Sanctum::actingAs($this->clientA);
        $response = $this->getJson('/api/v1/documents/permissions/effective?document_id=' . $this->documentA->id);
        $response->assertStatus(200)
            ->assertJsonPath('data.level', 'view')
            ->assertJsonPath('data.watermark_required', true)
            ->assertJsonPath('data.can_view', true)
            ->assertJsonPath('data.can_download', false);

        // 2. Advisor checks effective permission on document (falls back to advisor default: DOWNLOAD without watermark)
        Sanctum::actingAs($this->advisorA);
        $advisorResponse = $this->getJson('/api/v1/documents/permissions/effective?document_id=' . $this->documentA->id . '&company_id=' . $this->companyA->id);
        $advisorResponse->assertStatus(200)
            ->assertJsonPath('data.level', 'download')
            ->assertJsonPath('data.watermark_required', false)
            ->assertJsonPath('data.can_download', true);

        // 3. SuperAdmin checks effective permission (unrestricted manage)
        Sanctum::actingAs($this->superAdmin);
        $adminResponse = $this->getJson('/api/v1/documents/permissions/effective?document_id=' . $this->documentA->id . '&company_id=' . $this->companyA->id);
        $adminResponse->assertStatus(200)
            ->assertJsonPath('data.level', 'manage')
            ->assertJsonPath('data.watermark_required', false)
            ->assertJsonPath('data.can_manage', true);
    }

    public function test_validation_errors_on_set_permission(): void
    {
        Sanctum::actingAs($this->advisorA);

        $invalidPayload = [
            'subject_type' => 'invalid_type',
            'subject_id' => 'client',
            'permission_level' => 'invalid_level',
            'company_id' => $this->companyA->id,
        ];

        $response = $this->postJson('/api/v1/documents/permissions/folders/' . $this->folderA->id, $invalidPayload);
        $response->assertStatus(422)
            ->assertJsonValidationErrors(['subject_type', 'permission_level']);
    }

    public function test_client_cannot_modify_permissions(): void
    {
        Sanctum::actingAs($this->clientA);

        $payload = [
            'subject_type' => 'role',
            'subject_id' => 'client',
            'permission_level' => 'manage',
            'watermark_required' => false,
            'company_id' => $this->companyA->id,
        ];

        $this->postJson('/api/v1/documents/permissions/folders/' . $this->folderA->id, $payload)
            ->assertStatus(403);

        $this->postJson('/api/v1/documents/permissions/documents/' . $this->documentA->id, $payload)
            ->assertStatus(403);

        $this->deleteJson('/api/v1/documents/permissions/folder/' . Str::uuid() . '?company_id=' . $this->companyA->id)
            ->assertStatus(403);
    }

    public function test_cross_company_isolation(): void
    {
        // Advisor B cannot access Company A folder permissions
        Sanctum::actingAs($this->advisorB);

        $payload = [
            'subject_type' => 'role',
            'subject_id' => 'client',
            'permission_level' => 'download',
            'watermark_required' => false,
            'company_id' => $this->companyA->id,
        ];

        $this->postJson('/api/v1/documents/permissions/folders/' . $this->folderA->id, $payload)
            ->assertStatus(403);
    }
}
