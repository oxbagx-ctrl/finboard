<?php

declare(strict_types=1);

namespace App\Contexts\DocumentManagement\Infrastructure\Services;

use App\Contexts\DocumentManagement\Domain\Services\PdfWatermarkServiceInterface;
use App\Contexts\DocumentManagement\Domain\ValueObjects\WatermarkOptions;
use Illuminate\Support\Facades\Log;
use setasign\Fpdi\PdfParser\StreamReader;
use Throwable;

final class FpdiPdfWatermarkService implements PdfWatermarkServiceInterface
{
    public function applyWatermark(string $pdfBinaryContent, WatermarkOptions $options): string
    {
        // 1. Basic validation: must have minimal PDF signature
        if (!str_starts_with(ltrim($pdfBinaryContent), '%PDF-')) {
            Log::info('Document does not match PDF signature, skipping dynamic watermark application.');
            return $pdfBinaryContent;
        }

        try {
            $stream = StreamReader::createByString($pdfBinaryContent);
            $pdf = new WatermarkFpdi();
            $pdf->SetAutoPageBreak(false);
            $pdf->SetCompression($options->compress);

            $pageCount = $pdf->setSourceFile($stream);

            for ($pageNo = 1; $pageNo <= $pageCount; $pageNo++) {
                $tpl = $pdf->importPage($pageNo);
                $size = $pdf->getTemplateSize($tpl);

                $width = (float) $size['width'];
                $height = (float) $size['height'];
                $orientation = (string) $size['orientation'];

                $pdf->AddPage($orientation, [$width, $height]);
                $pdf->useTemplate($tpl);

                // 2. Running Header Watermark
                if ($options->includeHeader) {
                    $pdf->SetFont('Helvetica', '', 7);
                    $pdf->SetTextColor(120, 120, 120);
                    $headerText = $options->headerText();
                    $pdf->Text(10, 6, $headerText);
                }

                // 3. Running Footer Watermark
                if ($options->includeFooter) {
                    $pdf->SetFont('Helvetica', '', 7);
                    $pdf->SetTextColor(120, 120, 120);
                    $footerText = $options->footerText($pageNo, $pageCount);
                    $pdf->Text(10, $height - 5, $footerText);
                }

                // 4. Large Diagonal Semi-Transparent Central Watermark
                if ($options->includeDiagonal) {
                    $cx = $width / 2.0;
                    $cy = $height / 2.0;

                    $pdf->setAlpha($options->alpha);
                    $pdf->SetTextColor($options->colorRgb[0], $options->colorRgb[1], $options->colorRgb[2]);

                    $pdf->rotate($options->angle, $cx, $cy);

                    // Primary line (Title & User)
                    $pdf->SetFont('Helvetica', 'B', $options->fontSize);
                    $line1 = $options->diagonalText();
                    $w1 = $pdf->GetStringWidth($line1);
                    $pdf->Text($cx - ($w1 / 2.0), $cy - 4.0, $line1);

                    // Secondary line (Timestamp, IP, Notice)
                    $secondarySize = max(8, (int) round($options->fontSize * 0.7));
                    $pdf->SetFont('Helvetica', '', $secondarySize);
                    $line2 = $options->secondaryDiagonalText();
                    $w2 = $pdf->GetStringWidth($line2);
                    $pdf->Text($cx - ($w2 / 2.0), $cy + 5.0, $line2);

                    $pdf->stopTransform();
                    $pdf->setAlpha(1.0);
                }
            }

            return (string) $pdf->Output('S');
        } catch (Throwable $e) {
            Log::warning('Failed to apply dynamic PDF watermark: ' . $e->getMessage(), [
                'exception' => $e,
            ]);

            // Always return original binary content rather than failing customer download
            return $pdfBinaryContent;
        }
    }

    public function supportsWatermarking(string $mimeType, string $filename): bool
    {
        $normalizedMime = strtolower(trim($mimeType));
        $normalizedName = strtolower(trim($filename));

        return str_contains($normalizedMime, 'pdf')
            || str_ends_with($normalizedName, '.pdf');
    }
}
