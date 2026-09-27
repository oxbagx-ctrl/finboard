<?php

declare(strict_types=1);

namespace Tests\Unit\DocumentManagement;

use App\Contexts\DocumentManagement\Domain\ValueObjects\WatermarkOptions;
use App\Contexts\DocumentManagement\Infrastructure\Services\FpdiPdfWatermarkService;
use DateTimeImmutable;
use Tests\TestCase;
use setasign\Fpdi\Fpdi;

final class PdfWatermarkServiceTest extends TestCase
{
    private FpdiPdfWatermarkService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = new FpdiPdfWatermarkService();
    }

    public function test_supports_watermarking(): void
    {
        $this->assertTrue($this->service->supportsWatermarking('application/pdf', 'sample.pdf'));
        $this->assertTrue($this->service->supportsWatermarking('application/x-pdf', 'report.PDF'));
        $this->assertTrue($this->service->supportsWatermarking('application/octet-stream', 'document.pdf'));

        $this->assertFalse($this->service->supportsWatermarking('text/plain', 'notes.txt'));
        $this->assertFalse($this->service->supportsWatermarking('image/png', 'chart.png'));
        $this->assertFalse($this->service->supportsWatermarking('application/vnd.ms-excel', 'data.xlsx'));
    }

    public function test_apply_watermark_to_single_page_pdf(): void
    {
        // 1. Generate clean 1-page sample PDF
        $fpdf = new Fpdi();
        $fpdf->AddPage();
        $fpdf->SetFont('Helvetica', 'B', 16);
        $fpdf->Cell(40, 10, 'Initial Clean Content');
        $rawPdf = $fpdf->Output('S');

        $this->assertStringStartsWith('%PDF-', $rawPdf);

        // 2. Apply watermark
        $timestamp = new DateTimeImmutable('2026-09-27 18:00:00 UTC');
        $options = WatermarkOptions::create(
            userName: 'Jan Kowalski',
            userEmail: 'jan@acme.com',
            ipAddress: '192.168.1.10',
            timestamp: $timestamp,
            companyName: 'Acme Sp. z o.o.',
            customNotice: 'ACME STRICTLY CONFIDENTIAL',
            compress: false
        );

        $watermarkedPdf = $this->service->applyWatermark($rawPdf, $options);

        $this->assertStringStartsWith('%PDF-', $watermarkedPdf);
        $this->assertGreaterThan(strlen($rawPdf), strlen($watermarkedPdf));
        $this->assertStringContainsString('Jan Kowalski', $watermarkedPdf);
        $this->assertStringContainsString('jan@acme.com', $watermarkedPdf);
        $this->assertStringContainsString('ACME STRICTLY CONFIDENTIAL', $watermarkedPdf);
    }

    public function test_apply_watermark_to_multi_page_pdf(): void
    {
        // Generate 3-page PDF
        $fpdf = new Fpdi();
        for ($i = 1; $i <= 3; $i++) {
            $fpdf->AddPage();
            $fpdf->SetFont('Helvetica', 'B', 14);
            $fpdf->Cell(40, 10, sprintf('Section Page %d', $i));
        }
        $rawPdf = $fpdf->Output('S');

        $options = WatermarkOptions::create(
            userName: 'Lead Due Diligence Partner',
            userEmail: 'partner@helvest.com',
            ipAddress: '10.20.30.40',
            compress: false
        );

        $watermarkedPdf = $this->service->applyWatermark($rawPdf, $options);

        $this->assertStringStartsWith('%PDF-', $watermarkedPdf);
        $this->assertStringContainsString('Lead Due Diligence Partner', $watermarkedPdf);
        $this->assertStringContainsString('Page 1 of 3', $watermarkedPdf);
        $this->assertStringContainsString('Page 3 of 3', $watermarkedPdf);
    }

    public function test_gracefully_handles_non_pdf_or_corrupt_content(): void
    {
        $nonPdfContent = 'PLAIN TEXT FILE NOT A PDF';
        $options = WatermarkOptions::create(userName: 'Tester');

        $result = $this->service->applyWatermark($nonPdfContent, $options);
        $this->assertSame($nonPdfContent, $result);

        $corruptPdf = '%PDF-corrupt-data-not-a-valid-structure';
        $corruptResult = $this->service->applyWatermark($corruptPdf, $options);
        $this->assertSame($corruptPdf, $corruptResult);
    }
}
