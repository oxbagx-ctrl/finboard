<?php

declare(strict_types=1);

namespace Tests\Unit\DocumentManagement;

use App\Contexts\DocumentManagement\Application\Commands\RevokeVdrPermission\RevokeVdrPermissionCommand;
use App\Contexts\DocumentManagement\Application\Commands\RevokeVdrPermission\RevokeVdrPermissionHandler;
use App\Contexts\DocumentManagement\Application\Commands\SetVdrDocumentPermission\SetVdrDocumentPermissionCommand;
use App\Contexts\DocumentManagement\Application\Commands\SetVdrDocumentPermission\SetVdrDocumentPermissionHandler;
use App\Contexts\DocumentManagement\Application\Commands\SetVdrFolderPermission\SetVdrFolderPermissionCommand;
use App\Contexts\DocumentManagement\Application\Commands\SetVdrFolderPermission\SetVdrFolderPermissionHandler;
use App\Contexts\DocumentManagement\Application\Queries\GetEffectiveVdrPermission\GetEffectiveVdrPermissionHandler;
use App\Contexts\DocumentManagement\Application\Queries\GetEffectiveVdrPermission\GetEffectiveVdrPermissionQuery;
use App\Contexts\DocumentManagement\Application\Queries\GetVdrPermissionMatrix\GetVdrPermissionMatrixHandler;
use App\Contexts\DocumentManagement\Application\Queries\GetVdrPermissionMatrix\GetVdrPermissionMatrixQuery;
use App\Contexts\DocumentManagement\Domain\Model\TransactionFolder;
use App\Contexts\DocumentManagement\Domain\Model\VdrDocumentPermission;
use App\Contexts\DocumentManagement\Domain\Model\VdrFolderPermission;
use App\Contexts\DocumentManagement\Domain\Model\VdrPermissionMatrix;
use App\Contexts\DocumentManagement\Domain\Repositories\DocumentRepositoryInterface;
use App\Contexts\DocumentManagement\Domain\Repositories\TransactionFolderRepositoryInterface;
use App\Contexts\DocumentManagement\Domain\Repositories\VdrPermissionRepositoryInterface;
use App\Contexts\DocumentManagement\Domain\ValueObjects\AccessSubject;
use App\Contexts\DocumentManagement\Domain\ValueObjects\DeweyIndexCode;
use App\Contexts\DocumentManagement\Domain\ValueObjects\DocumentChecksum;
use App\Contexts\DocumentManagement\Domain\ValueObjects\DocumentFilename;
use App\Contexts\DocumentManagement\Domain\ValueObjects\DocumentId;
use App\Contexts\DocumentManagement\Domain\ValueObjects\DocumentMimeType;
use App\Contexts\DocumentManagement\Domain\ValueObjects\DocumentSize;
use App\Contexts\DocumentManagement\Domain\ValueObjects\DocumentStoragePath;
use App\Contexts\DocumentManagement\Domain\ValueObjects\DocumentTitle;
use App\Contexts\DocumentManagement\Domain\ValueObjects\DocumentType;
use App\Contexts\DocumentManagement\Domain\ValueObjects\EffectivePermission;
use App\Contexts\DocumentManagement\Domain\ValueObjects\FolderId;
use App\Contexts\DocumentManagement\Domain\ValueObjects\FolderName;
use App\Contexts\DocumentManagement\Domain\ValueObjects\PermissionLevel;
use App\Contexts\DocumentManagement\Domain\ValueObjects\VdrPermissionId;
use App\Models\Company;
use App\Models\Document as EloquentDocument;
use App\Models\TransactionFolder as EloquentFolder;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use InvalidArgumentException;
use Tests\TestCase;

final class VdrPermissionCqrsHandlersTest extends TestCase
{
    use DatabaseTransactions;

    private Company $company;
    private User $user;
    private EloquentFolder $folderModel;
    private EloquentDocument $documentModel;

    protected function setUp(): void
    {
        parent::setUp();

        $this->company = Company::firstOrCreate(
            ['code' => 'VDR_CQRS_CO'],
            ['name' => 'VDR CQRS Test Company Sp. z o.o.', 'tax_id' => 'PL1122334455']
        );

        $this->user = User::firstOrCreate(
            ['email' => 'vdr_cqrs_user@finboard.pl'],
            [
                'name' => 'VDR CQRS User',
                'password' => bcrypt('secret123'),
                'role' => 'client',
                'company_id' => $this->company->id,
                'is_active' => true,
            ]
        );

        $this->folderModel = EloquentFolder::create([
            'company_id' => $this->company->id,
            'name' => '01 Corporate Governance',
            'index_code' => '01',
            'order_index' => 1,
        ]);

        $this->documentModel = EloquentDocument::create([
            'company_id' => $this->company->id,
            'folder_id' => $this->folderModel->id,
            'uploaded_by_user_id' => $this->user->id,
            'title' => 'Articles of Association',
            'type' => 'contract',
            'storage_path' => 'dataroom/' . $this->company->id . '/aoa.pdf',
            'original_name' => 'aoa.pdf',
            'size_bytes' => 1024,
            'mime_type' => 'application/pdf',
            'checksum_sha256' => hash('sha256', 'mock-vdr-content'),
        ]);
    }

    public function test_set_vdr_folder_permission_handler_creates_and_updates_permission(): void
    {
        $permRepo = $this->app->make(VdrPermissionRepositoryInterface::class);
        $folderRepo = $this->app->make(TransactionFolderRepositoryInterface::class);

        $handler = new SetVdrFolderPermissionHandler($permRepo, $folderRepo);

        // 1. Create new folder permission grant
        $command = new SetVdrFolderPermissionCommand(
            companyId: $this->company->id,
            folderId: (string) $this->folderModel->id,
            subjectType: 'role',
            subjectId: 'client',
            permissionLevel: 'view',
            watermarkRequired: true
        );

        $result = $handler->handle($command);

        $this->assertInstanceOf(VdrFolderPermission::class, $result);
        $this->assertSame($this->company->id, $result->companyId());
        $this->assertSame((string) $this->folderModel->id, $result->folderId()->value());
        $this->assertSame('role', $result->subject()->type());
        $this->assertSame('client', $result->subject()->id());
        $this->assertSame(PermissionLevel::VIEW, $result->permissionLevel());
        $this->assertTrue($result->watermarkRequired());

        // 2. Update existing folder permission grant
        $updateCommand = new SetVdrFolderPermissionCommand(
            companyId: $this->company->id,
            folderId: (string) $this->folderModel->id,
            subjectType: 'role',
            subjectId: 'client',
            permissionLevel: 'download',
            watermarkRequired: false
        );

        $updatedResult = $handler->handle($updateCommand);

        $this->assertSame($result->id(), $updatedResult->id());
        $this->assertSame(PermissionLevel::DOWNLOAD, $updatedResult->permissionLevel());
        $this->assertFalse($updatedResult->watermarkRequired());
    }

    public function test_set_vdr_folder_permission_handler_throws_on_invalid_folder(): void
    {
        $permRepo = $this->app->make(VdrPermissionRepositoryInterface::class);
        $folderRepo = $this->app->make(TransactionFolderRepositoryInterface::class);

        $handler = new SetVdrFolderPermissionHandler($permRepo, $folderRepo);

        $this->expectException(InvalidArgumentException::class);

        $handler->handle(new SetVdrFolderPermissionCommand(
            companyId: $this->company->id,
            folderId: (string) \Illuminate\Support\Str::uuid(),
            subjectType: 'role',
            subjectId: 'client',
            permissionLevel: 'view',
            watermarkRequired: false
        ));
    }

    public function test_set_vdr_document_permission_handler_creates_and_updates_permission(): void
    {
        $permRepo = $this->app->make(VdrPermissionRepositoryInterface::class);
        $docRepo = $this->app->make(DocumentRepositoryInterface::class);

        $handler = new SetVdrDocumentPermissionHandler($permRepo, $docRepo);

        // 1. Create document permission override
        $command = new SetVdrDocumentPermissionCommand(
            companyId: $this->company->id,
            documentId: (string) $this->documentModel->id,
            subjectType: 'user',
            subjectId: (string) $this->user->id,
            permissionLevel: 'manage',
            watermarkRequired: false
        );

        $result = $handler->handle($command);

        $this->assertInstanceOf(VdrDocumentPermission::class, $result);
        $this->assertSame($this->company->id, $result->companyId());
        $this->assertSame((string) $this->documentModel->id, $result->documentId()->value());
        $this->assertSame('user', $result->subject()->type());
        $this->assertSame((string) $this->user->id, $result->subject()->id());
        $this->assertSame(PermissionLevel::MANAGE, $result->permissionLevel());
        $this->assertFalse($result->watermarkRequired());

        // 2. Update document permission override
        $updateCommand = new SetVdrDocumentPermissionCommand(
            companyId: $this->company->id,
            documentId: (string) $this->documentModel->id,
            subjectType: 'user',
            subjectId: (string) $this->user->id,
            permissionLevel: 'none',
            watermarkRequired: true
        );

        $updatedResult = $handler->handle($updateCommand);

        $this->assertSame($result->id(), $updatedResult->id());
        $this->assertSame(PermissionLevel::NONE, $updatedResult->permissionLevel());
        $this->assertTrue($updatedResult->watermarkRequired());
    }

    public function test_set_vdr_document_permission_handler_throws_on_invalid_document(): void
    {
        $permRepo = $this->app->make(VdrPermissionRepositoryInterface::class);
        $docRepo = $this->app->make(DocumentRepositoryInterface::class);

        $handler = new SetVdrDocumentPermissionHandler($permRepo, $docRepo);

        $this->expectException(InvalidArgumentException::class);

        $handler->handle(new SetVdrDocumentPermissionCommand(
            companyId: $this->company->id,
            documentId: (string) \Illuminate\Support\Str::uuid(),
            subjectType: 'user',
            subjectId: (string) $this->user->id,
            permissionLevel: 'view',
            watermarkRequired: false
        ));
    }

    public function test_revoke_vdr_permission_handler_deletes_folder_and_document_permissions(): void
    {
        $permRepo = $this->app->make(VdrPermissionRepositoryInterface::class);
        $folderRepo = $this->app->make(TransactionFolderRepositoryInterface::class);
        $docRepo = $this->app->make(DocumentRepositoryInterface::class);

        $setFolderHandler = new SetVdrFolderPermissionHandler($permRepo, $folderRepo);
        $setDocHandler = new SetVdrDocumentPermissionHandler($permRepo, $docRepo);
        $revokeHandler = new RevokeVdrPermissionHandler($permRepo);

        // Grant folder permission
        $folderPerm = $setFolderHandler->handle(new SetVdrFolderPermissionCommand(
            companyId: $this->company->id,
            folderId: (string) $this->folderModel->id,
            subjectType: 'role',
            subjectId: 'client',
            permissionLevel: 'view',
            watermarkRequired: true
        ));

        // Grant document permission
        $docPerm = $setDocHandler->handle(new SetVdrDocumentPermissionCommand(
            companyId: $this->company->id,
            documentId: (string) $this->documentModel->id,
            subjectType: 'role',
            subjectId: 'client',
            permissionLevel: 'download',
            watermarkRequired: false
        ));

        // Revoke folder permission
        $revokeHandler->handle(new RevokeVdrPermissionCommand(
            companyId: $this->company->id,
            permissionType: 'folder',
            permissionId: $folderPerm->id()
        ));

        $this->assertNull($permRepo->findFolderPermission(
            FolderId::fromString((string) $this->folderModel->id),
            AccessSubject::fromTypeAndId('role', 'client')
        ));

        // Revoke document permission
        $revokeHandler->handle(new RevokeVdrPermissionCommand(
            companyId: $this->company->id,
            permissionType: 'document',
            permissionId: $docPerm->id()
        ));

        $this->assertNull($permRepo->findDocumentPermission(
            DocumentId::fromString((string) $this->documentModel->id),
            AccessSubject::fromTypeAndId('role', 'client')
        ));
    }

    public function test_revoke_vdr_permission_throws_on_invalid_type(): void
    {
        $permRepo = $this->app->make(VdrPermissionRepositoryInterface::class);
        $revokeHandler = new RevokeVdrPermissionHandler($permRepo);

        $this->expectException(InvalidArgumentException::class);

        $revokeHandler->handle(new RevokeVdrPermissionCommand(
            companyId: $this->company->id,
            permissionType: 'unknown_type',
            permissionId: (string) \Illuminate\Support\Str::uuid()
        ));
    }

    public function test_get_effective_vdr_permission_handler(): void
    {
        $permRepo = $this->app->make(VdrPermissionRepositoryInterface::class);
        $folderRepo = $this->app->make(TransactionFolderRepositoryInterface::class);
        $docRepo = $this->app->make(DocumentRepositoryInterface::class);

        $setFolderHandler = new SetVdrFolderPermissionHandler($permRepo, $folderRepo);
        $setDocHandler = new SetVdrDocumentPermissionHandler($permRepo, $docRepo);
        $effectiveHandler = new GetEffectiveVdrPermissionHandler($permRepo);

        // 1. Initial resolution (default client role fallback: VIEW with watermark)
        $effective = $effectiveHandler->handle(new GetEffectiveVdrPermissionQuery(
            companyId: $this->company->id,
            role: 'client',
            userId: (string) $this->user->id,
            documentId: (string) $this->documentModel->id
        ));

        $this->assertSame(PermissionLevel::VIEW, $effective->level());
        $this->assertTrue($effective->watermarkRequired());
        $this->assertSame(EffectivePermission::SOURCE_ROLE_DEFAULT, $effective->source());

        // 2. Set folder permission: client role -> DOWNLOAD without watermark
        $setFolderHandler->handle(new SetVdrFolderPermissionCommand(
            companyId: $this->company->id,
            folderId: (string) $this->folderModel->id,
            subjectType: 'role',
            subjectId: 'client',
            permissionLevel: 'download',
            watermarkRequired: false
        ));

        $effectiveAfterFolder = $effectiveHandler->handle(new GetEffectiveVdrPermissionQuery(
            companyId: $this->company->id,
            role: 'client',
            userId: (string) $this->user->id,
            documentId: (string) $this->documentModel->id
        ));

        $this->assertSame(PermissionLevel::DOWNLOAD, $effectiveAfterFolder->level());
        $this->assertFalse($effectiveAfterFolder->watermarkRequired());
        $this->assertSame(EffectivePermission::SOURCE_DIRECT_FOLDER_ROLE, $effectiveAfterFolder->source());

        // 3. Set specific document permission for this user: NONE
        $setDocHandler->handle(new SetVdrDocumentPermissionCommand(
            companyId: $this->company->id,
            documentId: (string) $this->documentModel->id,
            subjectType: 'user',
            subjectId: (string) $this->user->id,
            permissionLevel: 'none',
            watermarkRequired: true
        ));

        $effectiveAfterDocOverride = $effectiveHandler->handle(new GetEffectiveVdrPermissionQuery(
            companyId: $this->company->id,
            role: 'client',
            userId: (string) $this->user->id,
            documentId: (string) $this->documentModel->id
        ));

        $this->assertSame(PermissionLevel::NONE, $effectiveAfterDocOverride->level());
        $this->assertTrue($effectiveAfterDocOverride->watermarkRequired());
        $this->assertSame(EffectivePermission::SOURCE_DIRECT_DOCUMENT_USER, $effectiveAfterDocOverride->source());
    }

    public function test_get_vdr_permission_matrix_handler(): void
    {
        $permRepo = $this->app->make(VdrPermissionRepositoryInterface::class);
        $folderRepo = $this->app->make(TransactionFolderRepositoryInterface::class);
        $setFolderHandler = new SetVdrFolderPermissionHandler($permRepo, $folderRepo);
        $matrixHandler = new GetVdrPermissionMatrixHandler($permRepo);

        $setFolderHandler->handle(new SetVdrFolderPermissionCommand(
            companyId: $this->company->id,
            folderId: (string) $this->folderModel->id,
            subjectType: 'role',
            subjectId: 'client',
            permissionLevel: 'view',
            watermarkRequired: true
        ));

        $matrix = $matrixHandler->handle(new GetVdrPermissionMatrixQuery($this->company->id));

        $this->assertIsArray($matrix);
        $this->assertSame($this->company->id, $matrix['company_id']);
        $this->assertCount(1, $matrix['folder_permissions']);
        $this->assertSame('01 Corporate Governance', $matrix['folder_permissions'][0]['folder_name']);
        $this->assertSame('view', $matrix['folder_permissions'][0]['permission_level']);
        $this->assertTrue($matrix['folder_permissions'][0]['watermark_required']);
        $this->assertNotEmpty($matrix['available_roles']);
        $this->assertNotEmpty($matrix['available_levels']);
    }
}
