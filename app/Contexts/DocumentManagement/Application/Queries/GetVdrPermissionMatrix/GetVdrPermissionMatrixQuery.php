<?php

declare(strict_types=1);

namespace App\Contexts\DocumentManagement\Application\Queries\GetVdrPermissionMatrix;

final class GetVdrPermissionMatrixQuery
{
    public function __construct(
        public readonly string $companyId
    ) {
    }
}
