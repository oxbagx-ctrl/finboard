<?php

declare(strict_types=1);

namespace App\Contexts\DocumentManagement\Application\Commands\DownloadDocument;

final readonly class DownloadDocumentResult
{
    public function __construct(
        public string $fileContent,
        public string $originalName,
        public string $mimeType,
        public int $sizeBytes
    ) {
    }
}
