<?php

declare(strict_types=1);

namespace App\Contexts\DocumentManagement\Application\Queries\GetEffectiveVdrPermission;

final class GetEffectiveVdrPermissionQuery
{
    public function __construct(
        public readonly string $companyId,
        public readonly string $role,
        public readonly ?string $userId = null,
        public readonly ?string $folderId = null,
        public readonly ?string $documentId = null
    ) {
    }
}
