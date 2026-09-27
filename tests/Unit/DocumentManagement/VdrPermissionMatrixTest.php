<?php

declare(strict_types=1);

namespace Tests\Unit\DocumentManagement;

use App\Contexts\DocumentManagement\Domain\Events\VdrDocumentPermissionGranted;
use App\Contexts\DocumentManagement\Domain\Events\VdrDocumentPermissionRevoked;
use App\Contexts\DocumentManagement\Domain\Events\VdrFolderPermissionGranted;
use App\Contexts\DocumentManagement\Domain\Events\VdrFolderPermissionRevoked;
use App\Contexts\DocumentManagement\Domain\Model\VdrDocumentPermission;
use App\Contexts\DocumentManagement\Domain\Model\VdrFolderPermission;
use App\Contexts\DocumentManagement\Domain\Model\VdrPermissionMatrix;
use App\Contexts\DocumentManagement\Domain\ValueObjects\AccessSubject;
use App\Contexts\DocumentManagement\Domain\ValueObjects\DocumentId;
use App\Contexts\DocumentManagement\Domain\ValueObjects\EffectivePermission;
use App\Contexts\DocumentManagement\Domain\ValueObjects\FolderId;
use App\Contexts\DocumentManagement\Domain\ValueObjects\PermissionLevel;
use App\Contexts\DocumentManagement\Domain\ValueObjects\VdrPermissionId;
use PHPUnit\Framework\TestCase;

final class VdrPermissionMatrixTest extends TestCase
{
    private string $companyId;
    private FolderId $rootFolderId;
    private FolderId $childFolderId;
    private DocumentId $docInChildId;

    protected function setUp(): void
    {
        parent::setUp();

        $this->companyId = 'company-test-uuid';
        $this->rootFolderId = FolderId::generate();
        $this->childFolderId = FolderId::generate();
        $this->docInChildId = DocumentId::generate();
    }

    public function test_super_admin_always_receives_manage_without_watermark(): void
    {
        $matrix = VdrPermissionMatrix::forCompany($this->companyId);

        $effective = $matrix->resolve(
            role: 'super_admin',
            userId: 'user-admin-1',
            folderId: $this->childFolderId,
            documentId: $this->docInChildId
        );

        $this->assertSame(PermissionLevel::MANAGE, $effective->level());
        $this->assertTrue($effective->canManage());
        $this->assertFalse($effective->watermarkRequired());
        $this->assertSame(EffectivePermission::SOURCE_SUPER_ADMIN, $effective->source());
    }

    public function test_default_role_fallback_when_no_grants_exist(): void
    {
        $matrix = VdrPermissionMatrix::forCompany($this->companyId);

        // Advisor gets DOWNLOAD with watermark false
        $advisorEff = $matrix->resolve(role: 'advisor', userId: 'adv-1');
        $this->assertSame(PermissionLevel::DOWNLOAD, $advisorEff->level());
        $this->assertFalse($advisorEff->watermarkRequired());
        $this->assertSame(EffectivePermission::SOURCE_ROLE_DEFAULT, $advisorEff->source());

        // Client gets VIEW with watermark true
        $clientEff = $matrix->resolve(role: 'client', userId: 'cli-1');
        $this->assertSame(PermissionLevel::VIEW, $clientEff->level());
        $this->assertTrue($clientEff->watermarkRequired());
        $this->assertSame(EffectivePermission::SOURCE_ROLE_DEFAULT, $clientEff->source());

        // Unknown role gets NONE
        $guestEff = $matrix->resolve(role: 'guest');
        $this->assertSame(PermissionLevel::NONE, $guestEff->level());
        $this->assertTrue($guestEff->isNone());
    }

    public function test_folder_permission_grant_and_update_domain_events(): void
    {
        $perm = VdrFolderPermission::grant(
            id: VdrPermissionId::generate(),
            companyId: $this->companyId,
            folderId: $this->rootFolderId,
            subject: AccessSubject::forRole('client'),
            permissionLevel: PermissionLevel::DOWNLOAD,
            watermarkRequired: true
        );

        $this->assertSame($this->companyId, $perm->companyId());
        $this->assertSame(PermissionLevel::DOWNLOAD, $perm->permissionLevel());
        $this->assertTrue($perm->watermarkRequired());

        $events = $perm->releaseEvents();
        $this->assertCount(1, $events);
        $this->assertInstanceOf(VdrFolderPermissionGranted::class, $events[0]);

        // Update
        $perm->update(PermissionLevel::MANAGE, false);
        $this->assertSame(PermissionLevel::MANAGE, $perm->permissionLevel());
        $this->assertFalse($perm->watermarkRequired());

        $updateEvents = $perm->releaseEvents();
        $this->assertCount(1, $updateEvents);
        $this->assertInstanceOf(VdrFolderPermissionGranted::class, $updateEvents[0]);

        // Revoke
        $perm->revoke();
        $revokeEvents = $perm->releaseEvents();
        $this->assertCount(1, $revokeEvents);
        $this->assertInstanceOf(VdrFolderPermissionRevoked::class, $revokeEvents[0]);
    }

    public function test_document_permission_grant_and_revoke_domain_events(): void
    {
        $perm = VdrDocumentPermission::grant(
            id: VdrPermissionId::generate(),
            companyId: $this->companyId,
            documentId: $this->docInChildId,
            subject: AccessSubject::forUser('special-user-1'),
            permissionLevel: PermissionLevel::MANAGE,
            watermarkRequired: false
        );

        $events = $perm->releaseEvents();
        $this->assertCount(1, $events);
        $this->assertInstanceOf(VdrDocumentPermissionGranted::class, $events[0]);

        $perm->revoke();
        $revokeEvents = $perm->releaseEvents();
        $this->assertCount(1, $revokeEvents);
        $this->assertInstanceOf(VdrDocumentPermissionRevoked::class, $revokeEvents[0]);
    }

    public function test_direct_document_permission_overrides_folder_permission(): void
    {
        $matrix = VdrPermissionMatrix::forCompany($this->companyId);

        // Folder grant: client has VIEW
        $matrix->addFolderPermission(VdrFolderPermission::grant(
            id: VdrPermissionId::generate(),
            companyId: $this->companyId,
            folderId: $this->rootFolderId,
            subject: AccessSubject::forRole('client'),
            permissionLevel: PermissionLevel::VIEW,
            watermarkRequired: true
        ));

        // Document grant: client has DOWNLOAD
        $matrix->addDocumentPermission(VdrDocumentPermission::grant(
            id: VdrPermissionId::generate(),
            companyId: $this->companyId,
            documentId: $this->docInChildId,
            subject: AccessSubject::forRole('client'),
            permissionLevel: PermissionLevel::DOWNLOAD,
            watermarkRequired: false
        ));

        $effective = $matrix->resolve(
            role: 'client',
            userId: 'cli-user-1',
            folderId: $this->rootFolderId,
            documentId: $this->docInChildId
        );

        $this->assertSame(PermissionLevel::DOWNLOAD, $effective->level());
        $this->assertFalse($effective->watermarkRequired());
        $this->assertSame(EffectivePermission::SOURCE_DIRECT_DOCUMENT_ROLE, $effective->source());
    }

    public function test_user_specific_document_permission_overrides_role_document_permission(): void
    {
        $matrix = VdrPermissionMatrix::forCompany($this->companyId);

        // Role has NONE
        $matrix->addDocumentPermission(VdrDocumentPermission::grant(
            id: VdrPermissionId::generate(),
            companyId: $this->companyId,
            documentId: $this->docInChildId,
            subject: AccessSubject::forRole('client'),
            permissionLevel: PermissionLevel::NONE,
            watermarkRequired: false
        ));

        // Specific user has VIEW with watermark
        $matrix->addDocumentPermission(VdrDocumentPermission::grant(
            id: VdrPermissionId::generate(),
            companyId: $this->companyId,
            documentId: $this->docInChildId,
            subject: AccessSubject::forUser('privileged-user-1'),
            permissionLevel: PermissionLevel::VIEW,
            watermarkRequired: true
        ));

        $effPrivileged = $matrix->resolve(
            role: 'client',
            userId: 'privileged-user-1',
            documentId: $this->docInChildId
        );
        $this->assertSame(PermissionLevel::VIEW, $effPrivileged->level());
        $this->assertTrue($effPrivileged->watermarkRequired());
        $this->assertSame(EffectivePermission::SOURCE_DIRECT_DOCUMENT_USER, $effPrivileged->source());

        $effRegular = $matrix->resolve(
            role: 'client',
            userId: 'regular-user-2',
            documentId: $this->docInChildId
        );
        $this->assertSame(PermissionLevel::NONE, $effRegular->level());
        $this->assertSame(EffectivePermission::SOURCE_DIRECT_DOCUMENT_ROLE, $effRegular->source());
    }

    public function test_folder_hierarchy_inheritance(): void
    {
        $matrix = VdrPermissionMatrix::forCompany($this->companyId);

        // Setup hierarchy: child -> root
        $matrix->setFolderHierarchy([
            $this->childFolderId->value() => $this->rootFolderId->value(),
            $this->rootFolderId->value() => null,
        ]);

        // Grant on ROOT folder: client has DOWNLOAD, watermark: true
        $matrix->addFolderPermission(VdrFolderPermission::grant(
            id: VdrPermissionId::generate(),
            companyId: $this->companyId,
            folderId: $this->rootFolderId,
            subject: AccessSubject::forRole('client'),
            permissionLevel: PermissionLevel::DOWNLOAD,
            watermarkRequired: true
        ));

        // Resolving on CHILD folder without explicit grant should inherit from ROOT
        $effective = $matrix->resolve(
            role: 'client',
            userId: 'cli-user-1',
            folderId: $this->childFolderId
        );

        $this->assertSame(PermissionLevel::DOWNLOAD, $effective->level());
        $this->assertTrue($effective->watermarkRequired());
        $this->assertSame(EffectivePermission::SOURCE_INHERITED_FOLDER_ROLE, $effective->source());
        $this->assertSame($this->rootFolderId->value(), $effective->sourceId());

        // Now if child folder has explicit grant: NONE
        $matrix->addFolderPermission(VdrFolderPermission::grant(
            id: VdrPermissionId::generate(),
            companyId: $this->companyId,
            folderId: $this->childFolderId,
            subject: AccessSubject::forRole('client'),
            permissionLevel: PermissionLevel::NONE,
            watermarkRequired: false
        ));

        $childEff = $matrix->resolve(
            role: 'client',
            userId: 'cli-user-1',
            folderId: $this->childFolderId
        );

        $this->assertSame(PermissionLevel::NONE, $childEff->level());
        $this->assertSame(EffectivePermission::SOURCE_DIRECT_FOLDER_ROLE, $childEff->source());
        $this->assertSame($this->childFolderId->value(), $childEff->sourceId());
    }
}
