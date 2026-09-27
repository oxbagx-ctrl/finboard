<?php

declare(strict_types=1);

namespace App\Contexts\DocumentManagement\Domain\Services;

use App\Contexts\DocumentManagement\Domain\ValueObjects\WatermarkOptions;

interface PdfWatermarkServiceInterface
{
    /**
     * Stamped dynamic watermark onto the given PDF binary content according to options.
     *
     * @param string $pdfBinaryContent Raw binary contents of the source document
     * @param WatermarkOptions $options Custom watermark options (user info, stamp, timestamp)
     * @return string Watermarked PDF binary content
     */
    public function applyWatermark(string $pdfBinaryContent, WatermarkOptions $options): string;

    /**
     * Determine if a document format supports PDF watermarking.
     *
     * @param string $mimeType Document MIME type (e.g. application/pdf)
     * @param string $filename Original file name (e.g. memo.pdf)
     */
    public function supportsWatermarking(string $mimeType, string $filename): bool;
}
