<?php

declare(strict_types=1);

namespace App\Contexts\DocumentManagement\Application\Commands\UploadDocument;

final readonly class UploadDocumentCommand
{
    public function __construct(
        public string $companyId,
        public string $userId,
        public string $title,
        public string $type,
        public string $fileContent,
        public string $originalName,
        public string $mimeType,
        public int $sizeBytes,
        public string $extension,
        public ?string $folderId = null,
        public ?string $indexCode = null,
        public ?string $ipAddress = null,
        public ?string $userAgent = null
    ) {
    }
}
