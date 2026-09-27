<?php

declare(strict_types=1);

namespace App\Contexts\DocumentManagement\Application\Commands\UpdateDocument;

final readonly class UpdateDocumentCommand
{
    public function __construct(
        public string $id,
        public string $title,
        public string $type,
        public string $userId,
        public ?string $folderId = null,
        public ?string $indexCode = null,
        public ?string $ipAddress = null,
        public ?string $userAgent = null
    ) {
    }
}
