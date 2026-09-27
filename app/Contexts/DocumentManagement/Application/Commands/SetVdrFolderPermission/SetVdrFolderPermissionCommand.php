<?php

declare(strict_types=1);

namespace App\Contexts\DocumentManagement\Application\Commands\SetVdrFolderPermission;

final class SetVdrFolderPermissionCommand
{
    public function __construct(
        public readonly string $companyId,
        public readonly string $folderId,
        public readonly string $subjectType,
        public readonly string $subjectId,
        public readonly string $permissionLevel,
        public readonly bool $watermarkRequired = false
    ) {
    }
}
