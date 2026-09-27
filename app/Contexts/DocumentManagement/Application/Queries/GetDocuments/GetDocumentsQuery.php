<?php

declare(strict_types=1);

namespace App\Contexts\DocumentManagement\Application\Queries\GetDocuments;

final readonly class GetDocumentsQuery
{
    public function __construct(
        public string $companyId,
        public bool $includeArchived = false,
        public ?string $type = null,
        public ?string $search = null,
        public ?string $folderId = null,
        public int $perPage = 20,
        public int $page = 1
    ) {
    }
}
