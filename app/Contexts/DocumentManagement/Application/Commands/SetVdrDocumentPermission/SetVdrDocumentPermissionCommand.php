<?php

declare(strict_types=1);

namespace App\Contexts\DocumentManagement\Application\Commands\SetVdrDocumentPermission;

final class SetVdrDocumentPermissionCommand
{
    public function __construct(
        public readonly string $companyId,
        public readonly string $documentId,
        public readonly string $subjectType,
        public readonly string $subjectId,
        public readonly string $permissionLevel,
        public readonly bool $watermarkRequired = false
    ) {
    }
}
