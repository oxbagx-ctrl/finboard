<?php

declare(strict_types=1);

namespace App\Contexts\DocumentManagement\Application\Commands\DownloadDocument;

use App\Contexts\DocumentManagement\Domain\ValueObjects\WatermarkOptions;

final readonly class DownloadDocumentCommand
{
    public function __construct(
        public string $id,
        public string $userId,
        public ?string $ipAddress = null,
        public ?string $userAgent = null,
        public ?WatermarkOptions $watermarkOptions = null
    ) {
    }
}
