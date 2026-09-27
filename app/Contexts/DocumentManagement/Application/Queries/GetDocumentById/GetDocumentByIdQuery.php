<?php

declare(strict_types=1);

namespace App\Contexts\DocumentManagement\Application\Queries\GetDocumentById;

final readonly class GetDocumentByIdQuery
{
    public function __construct(
        public string $id,
        public bool $withTrash = false
    ) {
    }
}
