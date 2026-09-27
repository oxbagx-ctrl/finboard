<?php

declare(strict_types=1);

namespace App\Contexts\DocumentManagement\Application\Commands\DeleteDocument;

final readonly class DeleteDocumentCommand
{
    public function __construct(
        public string $id,
        public string $userId,
        public ?string $ipAddress = null,
        public ?string $userAgent = null
    ) {
    }
}
