<?php

declare(strict_types=1);

namespace Tests\Unit\DocumentManagement;

use App\Contexts\DocumentManagement\Domain\Events\DocumentArchived;
use App\Contexts\DocumentManagement\Domain\Events\DocumentDownloaded;
use App\Contexts\DocumentManagement\Domain\Events\DocumentUploaded;
use App\Contexts\DocumentManagement\Domain\Model\Document;
use App\Contexts\DocumentManagement\Domain\ValueObjects\DocumentId;
use App\Contexts\DocumentManagement\Domain\ValueObjects\DocumentType;
use App\Contexts\DocumentManagement\Domain\ValueObjects\FileMetadata;
use InvalidArgumentException;
use PHPUnit\Framework\TestCase;

final class DocumentTest extends TestCase
{
    private const COMPANY_ID = '22222222-2222-2222-2222-222222222222';
    private const USER_ID = '33333333-3333-3333-3333-333333333333';

    private function createSampleMetadata(): FileMetadata
    {
        return new FileMetadata(
            originalName: 'bilans_2025.pdf',
            mimeType: 'application/pdf',
            sizeInBytes: 2048576,
            checksumSha256: hash('sha256', 'dummy-content-123')
        );
    }

    public function test_document_upload_records_event_and_sets_properties(): void
    {
        $id = DocumentId::generate();
        $metadata = $this->createSampleMetadata();

        $document = Document::upload(
            id: $id,
            companyId: self::COMPANY_ID,
            uploadedByUserId: self::USER_ID,
            title: 'Bilans Finansowy 2025',
            type: DocumentType::FINANCIAL_REPORT,
            fileMetadata: $metadata,
            storagePath: 'documents/2025/bilans_2025.pdf'
        );

        $this->assertSame($id->value(), $document->id());
        $this->assertSame(self::COMPANY_ID, $document->companyId());
        $this->assertSame(self::USER_ID, $document->uploadedByUserId());
        $this->assertSame('Bilans Finansowy 2025', $document->title());
        $this->assertSame(DocumentType::FINANCIAL_REPORT, $document->type());
        $this->assertSame(0, $document->downloadCount());
        $this->assertFalse($document->isArchived());

        $events = $document->releaseEvents();
        $this->assertCount(1, $events);
        $this->assertInstanceOf(DocumentUploaded::class, $events[0]);
    }

    public function test_empty_title_throws_exception(): void
    {
        $this->expectException(InvalidArgumentException::class);

        Document::upload(
            id: DocumentId::generate(),
            companyId: self::COMPANY_ID,
            uploadedByUserId: self::USER_ID,
            title: '   ',
            type: DocumentType::CONTRACT,
            fileMetadata: $this->createSampleMetadata(),
            storagePath: 'documents/contract.pdf'
        );
    }

    public function test_file_metadata_validation_and_helpers(): void
    {
        $meta = $this->createSampleMetadata();
        $this->assertSame('pdf', $meta->extension());
        $this->assertStringContainsString('MB', $meta->formattedSize());

        $this->expectException(InvalidArgumentException::class);
        new FileMetadata(
            originalName: 'test.txt',
            mimeType: 'text/plain',
            sizeInBytes: 0,
            checksumSha256: hash('sha256', 'x')
        );
    }

    public function test_record_download_increments_count_and_records_event(): void
    {
        $document = Document::upload(
            id: DocumentId::generate(),
            companyId: self::COMPANY_ID,
            uploadedByUserId: self::USER_ID,
            title: 'Umowa Spółki',
            type: DocumentType::CONTRACT,
            fileMetadata: $this->createSampleMetadata(),
            storagePath: 'documents/umowa.pdf'
        );
        $document->releaseEvents(); // Clear upload event

        $document->recordDownload('user-reader-id');
        $this->assertSame(1, $document->downloadCount());

        $events = $document->releaseEvents();
        $this->assertCount(1, $events);
        $this->assertInstanceOf(DocumentDownloaded::class, $events[0]);
    }

    public function test_archive_and_unarchive_lifecycle(): void
    {
        $document = Document::upload(
            id: DocumentId::generate(),
            companyId: self::COMPANY_ID,
            uploadedByUserId: self::USER_ID,
            title: 'Stara Deklaracja CIT',
            type: DocumentType::TAX_DECLARATION,
            fileMetadata: $this->createSampleMetadata(),
            storagePath: 'documents/cit.pdf'
        );
        $document->releaseEvents();

        $document->archive();
        $this->assertTrue($document->isArchived());

        $events = $document->releaseEvents();
        $this->assertCount(1, $events);
        $this->assertInstanceOf(DocumentArchived::class, $events[0]);

        $document->unarchive();
        $this->assertFalse($document->isArchived());
    }
}
