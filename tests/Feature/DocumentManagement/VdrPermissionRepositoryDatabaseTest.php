<?php

declare(strict_types=1);

namespace Tests\Feature\DocumentManagement;

use App\Contexts\DocumentManagement\Domain\Model\VdrDocumentPermission;
use App\Contexts\DocumentManagement\Domain\Model\VdrFolderPermission;
use App\Contexts\DocumentManagement\Domain\Repositories\VdrPermissionRepositoryInterface;
use App\Contexts\DocumentManagement\Domain\ValueObjects\AccessSubject;
use App\Contexts\DocumentManagement\Domain\ValueObjects\DocumentId;
use App\Contexts\DocumentManagement\Domain\ValueObjects\EffectivePermission;
use App\Contexts\DocumentManagement\Domain\ValueObjects\FolderId;
use App\Contexts\DocumentManagement\Domain\ValueObjects\PermissionLevel;
use App\Contexts\DocumentManagement\Domain\ValueObjects\VdrPermissionId;
use App\Models\Company;
use App\Models\Document;
use App\Models\TransactionFolder;
use App\Models\User;
use App\Models\VdrDocumentPermission as EloquentDocPermission;
use App\Models\VdrFolderPermission as EloquentFolderPermission;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Str;
use Tests\TestCase;

final class VdrPermissionRepositoryDatabaseTest extends TestCase
{
    use DatabaseTransactions;

    private VdrPermissionRepositoryInterface $repository;
    private Company $company;
    private User $user;
    private TransactionFolder $parentFolder;
    private TransactionFolder $childFolder;
    private Document $document;

    protected function setUp(): void
    {
        parent::setUp();

        $this->repository = app(VdrPermissionRepositoryInterface::class);

        $this->company = Company::create([
            'id' => (string) Str::uuid(),
            'name' => 'Acme Holding M&A VDR Corp',
            'code' => 'ACME-VDR-' . Str::random(4),
            'tax_id' => '1112223344',
        ]);

        $this->user = User::create([
            'id' => (string) Str::uuid(),
            'company_id' => $this->company->id,
            'name' => 'Tomasz Analityk',
            'email' => 'tomasz.vdr.' . Str::random(6) . '@example.com',
            'password' => bcrypt('Secret123!'),
            'role' => 'client',
        ]);

        $this->parentFolder = TransactionFolder::create([
            'id' => (string) Str::uuid(),
            'company_id' => $this->company->id,
            'index_code' => '01.00',
            'name' => 'Informacje Korporacyjne',
            'sort_order' => 10,
        ]);

        $this->childFolder = TransactionFolder::create([
            'id' => (string) Str::uuid(),
            'company_id' => $this->company->id,
            'parent_id' => $this->parentFolder->id,
            'index_code' => '01.01',
            'name' => 'Umowy Spółki',
            'sort_order' => 20,
        ]);

        $this->document = Document::create([
            'id' => (string) Str::uuid(),
            'company_id' => $this->company->id,
            'uploaded_by_user_id' => $this->user->id,
            'folder_id' => $this->childFolder->id,
            'index_code' => '01.01.01',
            'title' => 'Umowa Spółki z o.o. Notarialna',
            'type' => 'legal_contract',
            'original_name' => 'umowa_notarialna.pdf',
            'mime_type' => 'application/pdf',
            'size_bytes' => 10240,
            'checksum_sha256' => hash('sha256', 'dummy-contract-content'),
            'storage_path' => 'vdr/' . $this->company->id . '/umowa.pdf',
            'is_archived' => false,
        ]);
    }

    public function test_can_persist_and_retrieve_folder_permission(): void
    {
        $permId = VdrPermissionId::generate();
        $folderId = FolderId::fromString($this->parentFolder->id);
        $subject = AccessSubject::forRole('client');

        $folderPerm = VdrFolderPermission::grant(
            id: $permId,
            companyId: $this->company->id,
            folderId: $folderId,
            subject: $subject,
            permissionLevel: PermissionLevel::VIEW,
            watermarkRequired: true
        );

        $this->repository->saveFolderPermission($folderPerm);

        // Verify in DB
        $this->assertDatabaseHas('vdr_folder_permissions', [
            'id' => $permId->value(),
            'company_id' => $this->company->id,
            'folder_id' => $folderId->value(),
            'subject_type' => 'role',
            'subject_id' => 'client',
            'permission_level' => 'view',
            'watermark_required' => true,
        ]);

        // Find by subject
        $retrieved = $this->repository->findFolderPermission($folderId, $subject);
        $this->assertNotNull($retrieved);
        $this->assertSame($permId->value(), $retrieved->id());
        $this->assertSame(PermissionLevel::VIEW, $retrieved->permissionLevel());
        $this->assertTrue($retrieved->watermarkRequired());

        // Update permission
        $retrieved->update(PermissionLevel::MANAGE, false);
        $this->repository->saveFolderPermission($retrieved);

        $this->assertDatabaseHas('vdr_folder_permissions', [
            'id' => $permId->value(),
            'permission_level' => 'manage',
            'watermark_required' => false,
        ]);
    }

    public function test_can_persist_and_retrieve_document_permission(): void
    {
        $permId = VdrPermissionId::generate();
        $docId = DocumentId::fromString($this->document->id);
        $subject = AccessSubject::forUser($this->user->id);

        $docPerm = VdrDocumentPermission::grant(
            id: $permId,
            companyId: $this->company->id,
            documentId: $docId,
            subject: $subject,
            permissionLevel: PermissionLevel::DOWNLOAD,
            watermarkRequired: true
        );

        $this->repository->saveDocumentPermission($docPerm);

        $this->assertDatabaseHas('vdr_document_permissions', [
            'id' => $permId->value(),
            'company_id' => $this->company->id,
            'document_id' => $docId->value(),
            'subject_type' => 'user',
            'subject_id' => $this->user->id,
            'permission_level' => 'download',
            'watermark_required' => true,
        ]);

        $retrieved = $this->repository->findDocumentPermission($docId, $subject);
        $this->assertNotNull($retrieved);
        $this->assertSame($permId->value(), $retrieved->id());
        $this->assertSame(PermissionLevel::DOWNLOAD, $retrieved->permissionLevel());
    }

    public function test_delete_folder_and_document_permissions(): void
    {
        $folderPermId = VdrPermissionId::generate();
        $this->repository->saveFolderPermission(VdrFolderPermission::grant(
            id: $folderPermId,
            companyId: $this->company->id,
            folderId: FolderId::fromString($this->parentFolder->id),
            subject: AccessSubject::forRole('advisor'),
            permissionLevel: PermissionLevel::MANAGE
        ));

        $docPermId = VdrPermissionId::generate();
        $this->repository->saveDocumentPermission(VdrDocumentPermission::grant(
            id: $docPermId,
            companyId: $this->company->id,
            documentId: DocumentId::fromString($this->document->id),
            subject: AccessSubject::forRole('advisor'),
            permissionLevel: PermissionLevel::VIEW
        ));

        $this->assertDatabaseHas('vdr_folder_permissions', ['id' => $folderPermId->value()]);
        $this->assertDatabaseHas('vdr_document_permissions', ['id' => $docPermId->value()]);

        $this->repository->deleteFolderPermission($folderPermId);
        $this->repository->deleteDocumentPermission($docPermId);

        $this->assertDatabaseMissing('vdr_folder_permissions', ['id' => $folderPermId->value()]);
        $this->assertDatabaseMissing('vdr_document_permissions', ['id' => $docPermId->value()]);
    }

    public function test_load_permission_matrix_with_database_hierarchy(): void
    {
        // Set grant on parent folder: client has VIEW with watermark
        $this->repository->saveFolderPermission(VdrFolderPermission::grant(
            id: VdrPermissionId::generate(),
            companyId: $this->company->id,
            folderId: FolderId::fromString($this->parentFolder->id),
            subject: AccessSubject::forRole('client'),
            permissionLevel: PermissionLevel::VIEW,
            watermarkRequired: true
        ));

        // Load complete matrix from repository
        $matrix = $this->repository->loadPermissionMatrix($this->company->id);

        // Access child folder should inherit from parent folder
        $effChildFolder = $matrix->resolve(
            role: 'client',
            userId: $this->user->id,
            folderId: FolderId::fromString($this->childFolder->id)
        );

        $this->assertSame(PermissionLevel::VIEW, $effChildFolder->level());
        $this->assertTrue($effChildFolder->watermarkRequired());
        $this->assertSame(EffectivePermission::SOURCE_INHERITED_FOLDER_ROLE, $effChildFolder->source());
        $this->assertSame($this->parentFolder->id, $effChildFolder->sourceId());

        // Now set document override for user: DOWNLOAD without watermark
        $this->repository->saveDocumentPermission(VdrDocumentPermission::grant(
            id: VdrPermissionId::generate(),
            companyId: $this->company->id,
            documentId: DocumentId::fromString($this->document->id),
            subject: AccessSubject::forUser($this->user->id),
            permissionLevel: PermissionLevel::DOWNLOAD,
            watermarkRequired: false
        ));

        $reloadedMatrix = $this->repository->loadPermissionMatrix($this->company->id);

        $effDoc = $reloadedMatrix->resolve(
            role: 'client',
            userId: $this->user->id,
            folderId: FolderId::fromString($this->childFolder->id),
            documentId: DocumentId::fromString($this->document->id)
        );

        $this->assertSame(PermissionLevel::DOWNLOAD, $effDoc->level());
        $this->assertFalse($effDoc->watermarkRequired());
        $this->assertSame(EffectivePermission::SOURCE_DIRECT_DOCUMENT_USER, $effDoc->source());
    }

    public function test_cascading_delete_on_folder_and_document_removal(): void
    {
        $folderPerm = VdrFolderPermission::grant(
            id: VdrPermissionId::generate(),
            companyId: $this->company->id,
            folderId: FolderId::fromString($this->childFolder->id),
            subject: AccessSubject::forRole('client'),
            permissionLevel: PermissionLevel::MANAGE
        );
        $this->repository->saveFolderPermission($folderPerm);

        $docPerm = VdrDocumentPermission::grant(
            id: VdrPermissionId::generate(),
            companyId: $this->company->id,
            documentId: DocumentId::fromString($this->document->id),
            subject: AccessSubject::forRole('client'),
            permissionLevel: PermissionLevel::VIEW
        );
        $this->repository->saveDocumentPermission($docPerm);

        $this->assertDatabaseHas('vdr_folder_permissions', ['id' => $folderPerm->id()]);
        $this->assertDatabaseHas('vdr_document_permissions', ['id' => $docPerm->id()]);

        // Delete document directly -> cascades
        $this->document->forceDelete();
        $this->assertDatabaseMissing('vdr_document_permissions', ['id' => $docPerm->id()]);

        // Delete folder directly -> cascades
        $this->childFolder->delete();
        $this->assertDatabaseMissing('vdr_folder_permissions', ['id' => $folderPerm->id()]);
    }
}
