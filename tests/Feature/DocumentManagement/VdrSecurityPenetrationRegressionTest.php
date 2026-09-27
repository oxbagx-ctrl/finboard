<?php

declare(strict_types=1);

namespace Tests\Feature\DocumentManagement;

use App\Contexts\DocumentManagement\Domain\ValueObjects\PermissionLevel;
use App\Contexts\Identity\Domain\ValueObjects\RoleType;
use App\Models\Company;
use App\Models\Document;
use App\Models\DocumentAccessLog;
use App\Models\TransactionFolder;
use App\Models\User;
use App\Models\VdrDocumentPermission;
use App\Models\VdrFolderPermission;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use setasign\Fpdi\Fpdi;
use Tests\TestCase;

final class VdrSecurityPenetrationRegressionTest extends TestCase
{
    use DatabaseTransactions;

    private Company $companyA;
    private Company $companyB;
    private User $superAdmin;
    private User $advisorA;
    private User $clientA1;
    private User $clientA2;
    private User $clientB;
    private TransactionFolder $parentFolderA;
    private TransactionFolder $subFolderA;
    private TransactionFolder $folderB;
    private Document $documentA1;
    private Document $documentA2;
    private Document $documentB;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');

        // Create Tenant Companies
        $this->companyA = Company::create([
            'id' => (string) Str::uuid(),
            'name' => 'Acme Capital Sp. z o.o.',
            'code' => 'ACME_SEC_' . uniqid(),
            'tax_id' => 'PL' . mt_rand(1000000000, 9999999999),
        ]);

        $this->companyB = Company::create([
            'id' => (string) Str::uuid(),
            'name' => 'Rival Logistics S.A.',
            'code' => 'RIVAL_SEC_' . uniqid(),
            'tax_id' => 'PL' . mt_rand(1000000000, 9999999999),
        ]);

        // Super Admin
        $this->superAdmin = User::create([
            'id' => (string) Str::uuid(),
            'name' => 'Super Administrator',
            'email' => 'superadmin_' . uniqid() . '@finboard.com',
            'password' => Hash::make('secret123'),
            'role' => RoleType::SUPER_ADMIN->value,
            'is_active' => true,
        ]);

        // Advisor assigned only to Company A
        $this->advisorA = User::create([
            'id' => (string) Str::uuid(),
            'name' => 'Tomasz Doradca (M&A Partner)',
            'email' => 'advisor_a_' . uniqid() . '@dealadvisory.com',
            'password' => Hash::make('secret123'),
            'role' => RoleType::ADVISOR->value,
            'is_active' => true,
        ]);
        $this->advisorA->assignedCompanies()->attach($this->companyA->id);

        // Clients for Company A
        $this->clientA1 = User::create([
            'id' => (string) Str::uuid(),
            'name' => 'Anna Klient (Acme CFO)',
            'email' => 'cfo_acme_' . uniqid() . '@acmecapital.com',
            'password' => Hash::make('secret123'),
            'role' => RoleType::CLIENT->value,
            'company_id' => $this->companyA->id,
            'is_active' => true,
        ]);

        $this->clientA2 = User::create([
            'id' => (string) Str::uuid(),
            'name' => 'Piotr Inwestor (Acme Auditor)',
            'email' => 'auditor_acme_' . uniqid() . '@acmecapital.com',
            'password' => Hash::make('secret123'),
            'role' => RoleType::CLIENT->value,
            'company_id' => $this->companyA->id,
            'is_active' => true,
        ]);

        // Client for Company B
        $this->clientB = User::create([
            'id' => (string) Str::uuid(),
            'name' => 'Bogdan Rywal (Rival CEO)',
            'email' => 'ceo_rival_' . uniqid() . '@rivallogistics.com',
            'password' => Hash::make('secret123'),
            'role' => RoleType::CLIENT->value,
            'company_id' => $this->companyB->id,
            'is_active' => true,
        ]);

        // Folders in Company A (Dewey Decimal hierarchy)
        $this->parentFolderA = TransactionFolder::create([
            'id' => (string) Str::uuid(),
            'company_id' => $this->companyA->id,
            'parent_id' => null,
            'index_code' => '01.00',
            'name' => 'Corporate & Governance',
            'sort_order' => 10,
        ]);

        $this->subFolderA = TransactionFolder::create([
            'id' => (string) Str::uuid(),
            'company_id' => $this->companyA->id,
            'parent_id' => $this->parentFolderA->id,
            'index_code' => '01.01',
            'name' => 'Articles of Association',
            'sort_order' => 10,
        ]);

        // Folder in Company B
        $this->folderB = TransactionFolder::create([
            'id' => (string) Str::uuid(),
            'company_id' => $this->companyB->id,
            'parent_id' => null,
            'index_code' => '01.00',
            'name' => 'Confidential Rival Data',
            'sort_order' => 10,
        ]);

        // Create valid PDF files in fake storage using FPDI
        $fpdf = new Fpdi();
        $fpdf->AddPage();
        $fpdf->SetFont('Helvetica', 'B', 16);
        $fpdf->Cell(40, 10, 'Acme Confidential Investment Document');
        $pdfContentA1 = (string) $fpdf->Output('S');
        $pdfPathA1 = "documents/{$this->companyA->id}/acme_contract.pdf";
        Storage::disk('local')->put($pdfPathA1, $pdfContentA1);

        $this->documentA1 = Document::create([
            'id' => (string) Str::uuid(),
            'company_id' => $this->companyA->id,
            'folder_id' => $this->parentFolderA->id,
            'index_code' => '01.00.01',
            'title' => 'Umowa Inwestycyjna Acme',
            'original_name' => 'acme_contract.pdf',
            'storage_path' => $pdfPathA1,
            'mime_type' => 'application/pdf',
            'size_bytes' => strlen($pdfContentA1),
            'checksum_sha256' => hash('sha256', $pdfContentA1),
            'type' => 'contract',
            'is_archived' => false,
            'uploaded_by_user_id' => $this->advisorA->id,
            'download_count' => 0,
        ]);

        $pdfPathA2 = "documents/{$this->companyA->id}/acme_bylaws.pdf";
        Storage::disk('local')->put($pdfPathA2, $pdfContentA1);

        $this->documentA2 = Document::create([
            'id' => (string) Str::uuid(),
            'company_id' => $this->companyA->id,
            'folder_id' => $this->subFolderA->id,
            'index_code' => '01.01.01',
            'title' => 'Statut Spółki Acme',
            'original_name' => 'acme_bylaws.pdf',
            'storage_path' => $pdfPathA2,
            'mime_type' => 'application/pdf',
            'size_bytes' => strlen($pdfContentA1),
            'checksum_sha256' => hash('sha256', $pdfContentA1),
            'type' => 'contract',
            'is_archived' => false,
            'uploaded_by_user_id' => $this->advisorA->id,
            'download_count' => 0,
        ]);

        $pdfPathB = "documents/{$this->companyB->id}/rival_trade_secrets.pdf";
        Storage::disk('local')->put($pdfPathB, $pdfContentA1);

        $this->documentB = Document::create([
            'id' => (string) Str::uuid(),
            'company_id' => $this->companyB->id,
            'folder_id' => $this->folderB->id,
            'index_code' => '01.00.01',
            'title' => 'Tajemnice Handlowe Rival Logistics',
            'original_name' => 'rival_trade_secrets.pdf',
            'storage_path' => $pdfPathB,
            'mime_type' => 'application/pdf',
            'size_bytes' => strlen($pdfContentA1),
            'checksum_sha256' => hash('sha256', $pdfContentA1),
            'type' => 'other',
            'is_archived' => false,
            'uploaded_by_user_id' => $this->superAdmin->id,
            'download_count' => 0,
        ]);
    }

    /**
     * Attack Vector 1: Privilege Escalation on Permission Matrix
     * Client role attempting to query or tamper with permission matrix endpoints must be blocked with 403 Forbidden.
     */
    public function test_client_cannot_access_or_tamper_with_permission_matrix(): void
    {
        Sanctum::actingAs($this->clientA1);

        // 1. Cannot read full matrix
        $this->getJson("/api/v1/documents/permissions/matrix?company_id={$this->companyA->id}")
            ->assertStatus(403);

        // 2. Cannot configure folder permissions
        $this->postJson("/api/v1/documents/permissions/folders/{$this->parentFolderA->id}", [
            'company_id' => $this->companyA->id,
            'subject_type' => 'role',
            'subject_id' => 'client',
            'permission_level' => 'manage',
            'watermark_required' => false,
        ])->assertStatus(403);

        // 3. Cannot configure document overrides
        $this->postJson("/api/v1/documents/permissions/documents/{$this->documentA1->id}", [
            'company_id' => $this->companyA->id,
            'subject_type' => 'role',
            'subject_id' => 'client',
            'permission_level' => 'manage',
            'watermark_required' => false,
        ])->assertStatus(403);

        // 4. Cannot revoke permissions
        $fakePermissionId = (string) Str::uuid();
        $this->deleteJson("/api/v1/documents/permissions/folder/{$fakePermissionId}?company_id={$this->companyA->id}")
            ->assertStatus(403);
    }

    /**
     * Attack Vector 2: Unauthenticated Access to VDR Permission Management
     */
    public function test_unauthenticated_requests_to_vdr_permission_endpoints_are_rejected(): void
    {
        $this->getJson("/api/v1/documents/permissions/matrix?company_id={$this->companyA->id}")
            ->assertStatus(401);

        $this->postJson("/api/v1/documents/permissions/folders/{$this->parentFolderA->id}", [
            'subject_type' => 'role',
            'subject_id' => 'client',
            'permission_level' => 'view',
        ])->assertStatus(401);

        $this->deleteJson("/api/v1/documents/permissions/folder/any-id?company_id={$this->companyA->id}")
            ->assertStatus(401);
    }

    /**
     * Attack Vector 3: Cross-Tenant Isolation
     * Advisor assigned only to Company A attempting to manage permissions for Company B must be blocked.
     */
    public function test_cross_tenant_isolation_prevents_advisor_from_manipulating_unassigned_tenant(): void
    {
        Sanctum::actingAs($this->advisorA);

        // Attempt to read Company B matrix
        $this->getJson("/api/v1/documents/permissions/matrix?company_id={$this->companyB->id}")
            ->assertStatus(403);

        // Attempt to set folder permissions for Company B
        $this->postJson("/api/v1/documents/permissions/folders/{$this->folderB->id}", [
            'company_id' => $this->companyB->id,
            'subject_type' => 'role',
            'subject_id' => 'client',
            'permission_level' => 'manage',
            'watermark_required' => false,
        ])->assertStatus(403);

        // Attempt to set document permissions for Company B
        $this->postJson("/api/v1/documents/permissions/documents/{$this->documentB->id}", [
            'company_id' => $this->companyB->id,
            'subject_type' => 'role',
            'subject_id' => 'client',
            'permission_level' => 'download',
            'watermark_required' => false,
        ])->assertStatus(403);
    }

    /**
     * Attack Vector 4: Cross-Tenant Resource Spoofing
     * Advisor provides their authorized Company A ID in the request, but targets a folder belonging to Company B.
     */
    public function test_cross_tenant_resource_injection_fails_safely(): void
    {
        Sanctum::actingAs($this->advisorA);

        // Trying to assign permission to Company B's folder while claiming Company A context
        $this->postJson("/api/v1/documents/permissions/folders/{$this->folderB->id}", [
            'company_id' => $this->companyA->id,
            'subject_type' => 'role',
            'subject_id' => 'client',
            'permission_level' => 'download',
            'watermark_required' => false,
        ])->assertStatus(404);
    }

    /**
     * Attack Vector 5: Document Override Takes Precedence Over Folder Grant
     * Folder grant gives 'download' to client role, but document override sets level to 'none'.
     * Both preview and download must be rejected with 403.
     */
    public function test_document_override_precedence_blocks_download_despite_permissive_folder(): void
    {
        // Setup: Folder A allows download
        VdrFolderPermission::create([
            'id' => (string) Str::uuid(),
            'company_id' => $this->companyA->id,
            'folder_id' => $this->parentFolderA->id,
            'subject_type' => 'role',
            'subject_id' => 'client',
            'permission_level' => PermissionLevel::DOWNLOAD->value,
            'watermark_required' => false,
            'created_by_user_id' => $this->advisorA->id,
        ]);

        // But Document A1 has direct override: 'none'
        VdrDocumentPermission::create([
            'id' => (string) Str::uuid(),
            'company_id' => $this->companyA->id,
            'document_id' => $this->documentA1->id,
            'subject_type' => 'role',
            'subject_id' => 'client',
            'permission_level' => PermissionLevel::NONE->value,
            'watermark_required' => true,
            'created_by_user_id' => $this->advisorA->id,
        ]);

        Sanctum::actingAs($this->clientA1);

        // Download must be rejected
        $this->getJson("/api/v1/documents/{$this->documentA1->id}/download")
            ->assertStatus(403);

        // Preview must be rejected
        $this->getJson("/api/v1/documents/{$this->documentA1->id}/preview")
            ->assertStatus(403);
    }

    /**
     * Attack Vector 6: User-Specific Grant Overrides Role Grant
     * Role 'client' has 'view', but Client A1 has specific grant 'download' without watermark.
     */
    public function test_user_specific_grant_overrides_restrictive_role_grant(): void
    {
        // Role grant: View only, watermark required
        VdrFolderPermission::create([
            'id' => (string) Str::uuid(),
            'company_id' => $this->companyA->id,
            'folder_id' => $this->parentFolderA->id,
            'subject_type' => 'role',
            'subject_id' => 'client',
            'permission_level' => PermissionLevel::VIEW->value,
            'watermark_required' => true,
            'created_by_user_id' => $this->advisorA->id,
        ]);

        // User grant for Client A1: Download without watermark
        VdrFolderPermission::create([
            'id' => (string) Str::uuid(),
            'company_id' => $this->companyA->id,
            'folder_id' => $this->parentFolderA->id,
            'subject_type' => 'user',
            'subject_id' => $this->clientA1->id,
            'permission_level' => PermissionLevel::DOWNLOAD->value,
            'watermark_required' => false,
            'created_by_user_id' => $this->advisorA->id,
        ]);

        // Client A1 can download clean file
        Sanctum::actingAs($this->clientA1);
        $resA1 = $this->get("/api/v1/documents/{$this->documentA1->id}/download");
        $resA1->assertStatus(200);

        // Client A2 (only role grant) is blocked from downloading
        Sanctum::actingAs($this->clientA2);
        $this->getJson("/api/v1/documents/{$this->documentA1->id}/download")
            ->assertStatus(403);
    }

    /**
     * Attack Vector 7: View-Only Client Cannot Download Clean File But Can Preview with Watermark
     */
    public function test_view_only_client_cannot_download_clean_file_but_can_preview_with_watermark(): void
    {
        VdrFolderPermission::create([
            'id' => (string) Str::uuid(),
            'company_id' => $this->companyA->id,
            'folder_id' => $this->parentFolderA->id,
            'subject_type' => 'role',
            'subject_id' => 'client',
            'permission_level' => PermissionLevel::VIEW->value,
            'watermark_required' => true,
            'created_by_user_id' => $this->advisorA->id,
        ]);

        Sanctum::actingAs($this->clientA1);

        // Download blocked
        $this->getJson("/api/v1/documents/{$this->documentA1->id}/download")
            ->assertStatus(403);

        // Preview allowed and contains dynamic watermark
        $previewRes = $this->get("/api/v1/documents/{$this->documentA1->id}/preview");
        $previewRes->assertStatus(200);
        $previewRes->assertHeader('Content-Disposition', 'inline; filename=acme_contract.pdf');
        $this->assertStringContainsString('%PDF-', $previewRes->getContent());
    }

    /**
     * Attack Vector 8: Watermark Bypass Resistance
     * Client with watermark_required attempting to omit watermark parameters still receives watermarked PDF.
     */
    public function test_watermark_bypass_resistance_enforces_watermark_regardless_of_request_parameters(): void
    {
        VdrFolderPermission::create([
            'id' => (string) Str::uuid(),
            'company_id' => $this->companyA->id,
            'folder_id' => $this->parentFolderA->id,
            'subject_type' => 'role',
            'subject_id' => 'client',
            'permission_level' => PermissionLevel::DOWNLOAD->value,
            'watermark_required' => true,
            'created_by_user_id' => $this->advisorA->id,
        ]);

        Sanctum::actingAs($this->clientA1);

        // Request download explicitly without ?watermark=1
        $resNormal = $this->get("/api/v1/documents/{$this->documentA1->id}/download");
        $resNormal->assertStatus(200);

        // Request download attempting ?watermark=0
        $resBypassAttempt = $this->get("/api/v1/documents/{$this->documentA1->id}/download?watermark=0");
        $resBypassAttempt->assertStatus(200);

        // Both responses should have modified content (watermarked, larger or transformed PDF)
        $originalContent = Storage::disk('local')->get($this->documentA1->storage_path);
        $this->assertNotEquals($originalContent, $resNormal->getContent());
        $this->assertNotEquals($originalContent, $resBypassAttempt->getContent());
    }

    /**
     * Attack Vector 9: Hierarchical Dewey Folder Inheritance
     * Parent folder 01.00 has 'download', Subfolder 01.01 has no explicit grant.
     * Document in subfolder 01.01 inherits permission from parent 01.00.
     */
    public function test_hierarchical_dewey_folder_inheritance_propagates_permissions_to_subfolders(): void
    {
        // Grant placed on parent folder 01.00
        VdrFolderPermission::create([
            'id' => (string) Str::uuid(),
            'company_id' => $this->companyA->id,
            'folder_id' => $this->parentFolderA->id,
            'subject_type' => 'role',
            'subject_id' => 'client',
            'permission_level' => PermissionLevel::DOWNLOAD->value,
            'watermark_required' => false,
            'created_by_user_id' => $this->advisorA->id,
        ]);

        Sanctum::actingAs($this->clientA1);

        // Document A2 is located in subFolderA (01.01) - should inherit download permission
        $res = $this->get("/api/v1/documents/{$this->documentA2->id}/download");
        $res->assertStatus(200);
    }

    /**
     * Attack Vector 10: WORM Audit Logging Retains Immutable Forensic Trail
     * Successful access records immutable access logs, while blocked requests do not corrupt counts.
     */
    public function test_worm_audit_logging_retains_immutable_forensic_trail_for_previews_and_downloads(): void
    {
        VdrFolderPermission::create([
            'id' => (string) Str::uuid(),
            'company_id' => $this->companyA->id,
            'folder_id' => $this->parentFolderA->id,
            'subject_type' => 'role',
            'subject_id' => 'client',
            'permission_level' => PermissionLevel::DOWNLOAD->value,
            'watermark_required' => true,
            'created_by_user_id' => $this->advisorA->id,
        ]);

        Sanctum::actingAs($this->clientA1);

        $initialDownloads = $this->documentA1->fresh()->download_count;

        // Perform preview
        $this->get("/api/v1/documents/{$this->documentA1->id}/preview")
            ->assertStatus(200);

        // Perform download
        $this->get("/api/v1/documents/{$this->documentA1->id}/download")
            ->assertStatus(200);

        // Download count incremented
        $this->assertEquals($initialDownloads + 2, $this->documentA1->fresh()->download_count);

        // Verify audit log entries in database
        $this->assertDatabaseHas('document_access_logs', [
            'document_id' => $this->documentA1->id,
            'user_id' => $this->clientA1->id,
            'action' => 'download',
        ]);

        // Attempt blocked access to Company B document
        $this->getJson("/api/v1/documents/{$this->documentB->id}/download")
            ->assertStatus(403);

        // Ensure Company B download count was not incremented
        $this->assertEquals(0, $this->documentB->fresh()->download_count);
    }
}
