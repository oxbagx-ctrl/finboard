<?php

declare(strict_types=1);

namespace App\Contexts\DocumentManagement\Domain\Repositories;

use App\Contexts\DocumentManagement\Domain\Model\VdrDocumentPermission;
use App\Contexts\DocumentManagement\Domain\Model\VdrFolderPermission;
use App\Contexts\DocumentManagement\Domain\Model\VdrPermissionMatrix;
use App\Contexts\DocumentManagement\Domain\ValueObjects\AccessSubject;
use App\Contexts\DocumentManagement\Domain\ValueObjects\DocumentId;
use App\Contexts\DocumentManagement\Domain\ValueObjects\FolderId;
use App\Contexts\DocumentManagement\Domain\ValueObjects\VdrPermissionId;

interface VdrPermissionRepositoryInterface
{
    public function saveFolderPermission(VdrFolderPermission $permission): void;

    public function saveDocumentPermission(VdrDocumentPermission $permission): void;

    public function deleteFolderPermission(VdrPermissionId $id): void;

    public function deleteDocumentPermission(VdrPermissionId $id): void;

    public function findFolderPermission(FolderId $folderId, AccessSubject $subject): ?VdrFolderPermission;

    public function findDocumentPermission(DocumentId $documentId, AccessSubject $subject): ?VdrDocumentPermission;

    /**
     * @return array<VdrFolderPermission>
     */
    public function getFolderPermissions(FolderId $folderId): array;

    /**
     * @return array<VdrDocumentPermission>
     */
    public function getDocumentPermissions(DocumentId $documentId): array;

    /**
     * @return array<VdrFolderPermission>
     */
    public function getCompanyFolderPermissions(string $companyId): array;

    /**
     * @return array<VdrDocumentPermission>
     */
    public function getCompanyDocumentPermissions(string $companyId): array;

    public function loadPermissionMatrix(string $companyId): VdrPermissionMatrix;
}
