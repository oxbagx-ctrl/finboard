<?php

declare(strict_types=1);

namespace App\Contexts\DocumentManagement\Domain\Model;

use App\Contexts\DocumentManagement\Domain\ValueObjects\AccessSubject;
use App\Contexts\DocumentManagement\Domain\ValueObjects\DocumentId;
use App\Contexts\DocumentManagement\Domain\ValueObjects\EffectivePermission;
use App\Contexts\DocumentManagement\Domain\ValueObjects\FolderId;
use App\Contexts\DocumentManagement\Domain\ValueObjects\PermissionLevel;
use App\Contexts\Identity\Domain\ValueObjects\RoleType;

final class VdrPermissionMatrix
{
    /**
     * @param string $companyId
     * @param array<string, VdrFolderPermission> $folderPermissions Keyed by "folder_id:subject_identifier"
     * @param array<string, VdrDocumentPermission> $documentPermissions Keyed by "document_id:subject_identifier"
     * @param array<string, ?string> $folderParentMap Keyed by folderId => parentFolderId
     */
    public function __construct(
        private readonly string $companyId,
        private array $folderPermissions = [],
        private array $documentPermissions = [],
        private array $folderParentMap = []
    ) {
    }

    public static function forCompany(string $companyId): self
    {
        return new self($companyId);
    }

    public function addFolderPermission(VdrFolderPermission $permission): self
    {
        $key = sprintf('%s:%s', $permission->folderId()->value(), $permission->subject()->identifier());
        $this->folderPermissions[$key] = $permission;

        return $this;
    }

    public function addDocumentPermission(VdrDocumentPermission $permission): self
    {
        $key = sprintf('%s:%s', $permission->documentId()->value(), $permission->subject()->identifier());
        $this->documentPermissions[$key] = $permission;

        return $this;
    }

    public function setFolderHierarchy(array $parentMap): self
    {
        $this->folderParentMap = $parentMap;

        return $this;
    }

    public function resolve(
        string $role,
        ?string $userId = null,
        ?FolderId $folderId = null,
        ?DocumentId $documentId = null
    ): EffectivePermission {
        $normalizedRole = strtolower(trim($role));

        // 1. SuperAdmin / Admin has global unrestricted access
        if ($normalizedRole === RoleType::SUPER_ADMIN->value || $normalizedRole === RoleType::ADMIN->value) {
            return EffectivePermission::superAdmin();
        }

        // 2. Direct Document Permissions
        if ($documentId !== null) {
            $docIdStr = $documentId->value();

            // 2a. Direct Document Permission for specific User
            if ($userId !== null) {
                $userKey = sprintf('%s:user:%s', $docIdStr, trim($userId));
                if (isset($this->documentPermissions[$userKey])) {
                    $grant = $this->documentPermissions[$userKey];
                    return new EffectivePermission(
                        level: $grant->permissionLevel(),
                        watermarkRequired: $grant->watermarkRequired(),
                        source: EffectivePermission::SOURCE_DIRECT_DOCUMENT_USER,
                        sourceId: $docIdStr
                    );
                }
            }

            // 2b. Direct Document Permission for Role
            $roleKey = sprintf('%s:role:%s', $docIdStr, $normalizedRole);
            if (isset($this->documentPermissions[$roleKey])) {
                $grant = $this->documentPermissions[$roleKey];
                return new EffectivePermission(
                    level: $grant->permissionLevel(),
                    watermarkRequired: $grant->watermarkRequired(),
                    source: EffectivePermission::SOURCE_DIRECT_DOCUMENT_ROLE,
                    sourceId: $docIdStr
                );
            }
        }

        // 3. Folder Permissions (Current folder and inherited parent folders)
        if ($folderId !== null) {
            $currentFolderId = $folderId->value();
            $isDirectFolder = true;
            $visited = [];

            while ($currentFolderId !== null && !isset($visited[$currentFolderId])) {
                $visited[$currentFolderId] = true;

                // 3a. Folder Permission for specific User
                if ($userId !== null) {
                    $userKey = sprintf('%s:user:%s', $currentFolderId, trim($userId));
                    if (isset($this->folderPermissions[$userKey])) {
                        $grant = $this->folderPermissions[$userKey];
                        return new EffectivePermission(
                            level: $grant->permissionLevel(),
                            watermarkRequired: $grant->watermarkRequired(),
                            source: $isDirectFolder
                                ? EffectivePermission::SOURCE_DIRECT_FOLDER_USER
                                : EffectivePermission::SOURCE_INHERITED_FOLDER_USER,
                            sourceId: $currentFolderId
                        );
                    }
                }

                // 3b. Folder Permission for Role
                $roleKey = sprintf('%s:role:%s', $currentFolderId, $normalizedRole);
                if (isset($this->folderPermissions[$roleKey])) {
                    $grant = $this->folderPermissions[$roleKey];
                    return new EffectivePermission(
                        level: $grant->permissionLevel(),
                        watermarkRequired: $grant->watermarkRequired(),
                        source: $isDirectFolder
                            ? EffectivePermission::SOURCE_DIRECT_FOLDER_ROLE
                            : EffectivePermission::SOURCE_INHERITED_FOLDER_ROLE,
                            sourceId: $currentFolderId
                    );
                }

                // Move up to parent folder in hierarchy
                $currentFolderId = $this->folderParentMap[$currentFolderId] ?? null;
                $isDirectFolder = false;
            }
        }

        // 4. Default Role Fallback within Company Context
        return match ($normalizedRole) {
            RoleType::ADVISOR->value => new EffectivePermission(
                level: PermissionLevel::DOWNLOAD,
                watermarkRequired: false,
                source: EffectivePermission::SOURCE_ROLE_DEFAULT
            ),
            RoleType::CLIENT->value => new EffectivePermission(
                level: PermissionLevel::VIEW,
                watermarkRequired: true,
                source: EffectivePermission::SOURCE_ROLE_DEFAULT
            ),
            default => EffectivePermission::none(EffectivePermission::SOURCE_ROLE_DEFAULT),
        };
    }

    public function companyId(): string
    {
        return $this->companyId;
    }

    /**
     * @return array<string, VdrFolderPermission>
     */
    public function folderPermissions(): array
    {
        return $this->folderPermissions;
    }

    /**
     * @return array<string, VdrDocumentPermission>
     */
    public function documentPermissions(): array
    {
        return $this->documentPermissions;
    }
}
