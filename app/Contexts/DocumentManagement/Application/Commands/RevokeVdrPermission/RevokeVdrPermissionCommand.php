<?php

declare(strict_types=1);

namespace App\Contexts\DocumentManagement\Application\Commands\RevokeVdrPermission;

final class RevokeVdrPermissionCommand
{
    public function __construct(
        public readonly string $companyId,
        public readonly string $permissionType, // 'folder' or 'document'
        public readonly string $permissionId
    ) {
    }
}
