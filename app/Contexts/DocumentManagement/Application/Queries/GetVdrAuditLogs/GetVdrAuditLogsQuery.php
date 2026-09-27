<?php

declare(strict_types=1);

namespace App\Contexts\DocumentManagement\Application\Queries\GetVdrAuditLogs;

final readonly class GetVdrAuditLogsQuery
{
    public function __construct(
        public string $companyId,
        public ?string $action = null,
        public ?string $search = null,
        public ?string $documentId = null,
        public int $perPage = 25,
        public int $page = 1
    ) {
    }
}
