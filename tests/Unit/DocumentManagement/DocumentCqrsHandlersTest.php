<?php

declare(strict_types=1);

namespace Tests\Unit\DocumentManagement;

use App\Contexts\DocumentManagement\Application\Commands\ArchiveDocument\ArchiveDocumentCommand;
use App\Contexts\DocumentManagement\Application\Commands\ArchiveDocument\ArchiveDocumentHandler;
use App\Contexts\DocumentManagement\Application\Commands\DeleteDocument\DeleteDocumentCommand;
use App\Contexts\DocumentManagement\Application\Commands\DeleteDocument\DeleteDocumentHandler;
use App\Contexts\DocumentManagement\Application\Commands\DownloadDocument\DownloadDocumentCommand;
use App\Contexts\DocumentManagement\Application\Commands\DownloadDocument\DownloadDocumentHandler;
use App\Contexts\DocumentManagement\Application\Commands\UpdateDocument\UpdateDocumentCommand;
use App\Contexts\DocumentManagement\Application\Commands\UpdateDocument\UpdateDocumentHandler;
use App\Contexts\DocumentManagement\Application\Commands\UploadDocument\UploadDocumentCommand;
use App\Contexts\DocumentManagement\Application\Commands\UploadDocument\UploadDocumentHandler;
use App\Contexts\DocumentManagement\Application\Exceptions\DocumentNotFoundException;
use App\Contexts\DocumentManagement\Application\Exceptions\FileNotFoundInStorageException;
use App\Contexts\DocumentManagement\Application\Queries\GetDocumentById\GetDocumentByIdHandler;
use App\Contexts\DocumentManagement\Application\Queries\GetDocumentById\GetDocumentByIdQuery;
use App\Contexts\DocumentManagement\Application\Queries\GetDocuments\GetDocumentsHandler;
use App\Contexts\DocumentManagement\Application\Queries\GetDocuments\GetDocumentsQuery;
use App\Contexts\DocumentManagement\Domain\Repositories\DocumentRepositoryInterface;
use App\Contexts\DocumentManagement\Domain\Services\DocumentStorageInterface;
use App\Contexts\DocumentManagement\Domain\Services\TransactionalStorageManagerInterface;
use App\Models\Company;
use App\Models\Document;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

final class DocumentCqrsHandlersTest extends TestCase
{
    use DatabaseTransactions;

    private Company $company;
    private User $user;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');

        $this->company = Company::firstOrCreate(
            ['code' => 'CQRS_CO'],
            ['name' => 'CQRS Test Company Sp. z o.o.', 'tax_id' => 'PL9998887766']
        );

        $this->user = User::firstOrCreate(
            ['email' => 'cqrs_tester@finboard.pl'],
            [
                'name' => 'CQRS Tester',
                'password' => bcrypt('secret123'),
                'role' => 'client',
                'company_id' => $this->company->id,
                'is_active' => true,
            ]
        );
    }

    public function test_upload_and_get_document_by_id_handlers(): void
    {
        $uploadHandler = app(UploadDocumentHandler::class);
        $getByIdHandler = app(GetDocumentByIdHandler::class);

        $command = new UploadDocumentCommand(
            companyId: $this->company->id,
            userId: $this->user->id,
            title: 'CQRS Test Report',
            type: 'financial_report',
            fileContent: 'TEST_FILE_CONTENT_CQRS',
            originalName: 'test_report.pdf',
            mimeType: 'application/pdf',
            sizeBytes: 23,
            extension: 'pdf',
            ipAddress: '127.0.0.1',
            userAgent: 'PHPUnit CQRS Test'
        );

        $uploadedDoc = $uploadHandler->handle($command);

        $this->assertInstanceOf(Document::class, $uploadedDoc);
        $this->assertSame('CQRS Test Report', $uploadedDoc->title);
        $this->assertSame($this->company->id, $uploadedDoc->company_id);

        $fetchedDoc = $getByIdHandler->handle(new GetDocumentByIdQuery($uploadedDoc->id));
        $this->assertSame($uploadedDoc->id, $fetchedDoc->id);
        $this->assertSame('CQRS Test Report', $fetchedDoc->title);
    }

    public function test_get_document_by_id_throws_not_found_for_invalid_uuid(): void
    {
        $getByIdHandler = app(GetDocumentByIdHandler::class);

        $this->expectException(DocumentNotFoundException::class);
        $getByIdHandler->handle(new GetDocumentByIdQuery((string) Str::uuid()));
    }

    public function test_get_documents_query_handler_filters_by_type_and_search(): void
    {
        $uploadHandler = app(UploadDocumentHandler::class);
        $listHandler = app(GetDocumentsHandler::class);

        $uploadHandler->handle(new UploadDocumentCommand(
            companyId: $this->company->id,
            userId: $this->user->id,
            title: 'Umowa Inwestycyjna Seria A',
            type: 'contract',
            fileContent: 'UMOWA_CONTENT',
            originalName: 'umowa_seria_a.pdf',
            mimeType: 'application/pdf',
            sizeBytes: 13,
            extension: 'pdf'
        ));

        $uploadHandler->handle(new UploadDocumentCommand(
            companyId: $this->company->id,
            userId: $this->user->id,
            title: 'Sprawozdanie Finansowe 2025',
            type: 'financial_report',
            fileContent: 'SPRAWOZDANIE_CONTENT',
            originalName: 'sprawozdanie_2025.pdf',
            mimeType: 'application/pdf',
            sizeBytes: 20,
            extension: 'pdf'
        ));

        // Filter by type
        $contracts = $listHandler->handle(new GetDocumentsQuery(
            companyId: $this->company->id,
            type: 'contract'
        ));
        $this->assertGreaterThanOrEqual(1, $contracts->total());
        $this->assertTrue(collect($contracts->items())->every(fn ($doc) => $doc->type === 'contract'));

        // Filter by search
        $searchResults = $listHandler->handle(new GetDocumentsQuery(
            companyId: $this->company->id,
            search: 'Sprawozdanie'
        ));
        $this->assertGreaterThanOrEqual(1, $searchResults->total());
        $this->assertTrue(collect($searchResults->items())->contains(fn ($doc) => str_contains($doc->title, 'Sprawozdanie')));
    }

    public function test_update_document_handler_updates_title_and_type(): void
    {
        $uploadHandler = app(UploadDocumentHandler::class);
        $updateHandler = app(UpdateDocumentHandler::class);

        $doc = $uploadHandler->handle(new UploadDocumentCommand(
            companyId: $this->company->id,
            userId: $this->user->id,
            title: 'Draft Przed Aktualizacją',
            type: 'other',
            fileContent: 'CONTENT',
            originalName: 'draft.pdf',
            mimeType: 'application/pdf',
            sizeBytes: 7,
            extension: 'pdf'
        ));

        $updated = $updateHandler->handle(new UpdateDocumentCommand(
            id: $doc->id,
            title: 'Zaktualizowany Dokument Audytowy',
            type: 'audit_report',
            userId: $this->user->id,
            ipAddress: '192.168.1.100',
            userAgent: 'Unit Test Agent'
        ));

        $this->assertSame('Zaktualizowany Dokument Audytowy', $updated->title);
        $this->assertSame('audit_report', $updated->type);

        $this->assertDatabaseHas('document_access_logs', [
            'document_id' => $doc->id,
            'action' => 'update',
            'user_id' => $this->user->id,
        ]);
    }

    public function test_archive_document_handler_toggles_archive_status(): void
    {
        $uploadHandler = app(UploadDocumentHandler::class);
        $archiveHandler = app(ArchiveDocumentHandler::class);

        $doc = $uploadHandler->handle(new UploadDocumentCommand(
            companyId: $this->company->id,
            userId: $this->user->id,
            title: 'Dokument Do Archiwum',
            type: 'presentation',
            fileContent: 'PREZENTACJA',
            originalName: 'deck.pdf',
            mimeType: 'application/pdf',
            sizeBytes: 11,
            extension: 'pdf'
        ));

        $this->assertFalse((bool) $doc->is_archived);

        // Archive
        $archived = $archiveHandler->handle(new ArchiveDocumentCommand(
            id: $doc->id,
            userId: $this->user->id
        ));
        $this->assertTrue((bool) $archived->is_archived);

        // Unarchive
        $unarchived = $archiveHandler->handle(new ArchiveDocumentCommand(
            id: $doc->id,
            userId: $this->user->id
        ));
        $this->assertFalse((bool) $unarchived->is_archived);
    }

    public function test_download_document_handler_records_access_and_increments_counter(): void
    {
        $uploadHandler = app(UploadDocumentHandler::class);
        $downloadHandler = app(DownloadDocumentHandler::class);

        $doc = $uploadHandler->handle(new UploadDocumentCommand(
            companyId: $this->company->id,
            userId: $this->user->id,
            title: 'Plik Do Pobrania',
            type: 'contract',
            fileContent: 'POBIERANIE_TRESC',
            originalName: 'kontrakt.pdf',
            mimeType: 'application/pdf',
            sizeBytes: 16,
            extension: 'pdf',
            ipAddress: '10.0.0.1',
            userAgent: 'Downloader Client'
        ));

        $result = $downloadHandler->handle(new DownloadDocumentCommand(
            id: $doc->id,
            userId: $this->user->id,
            ipAddress: '10.0.0.2',
            userAgent: 'Downloader Browser'
        ));

        $this->assertSame('POBIERANIE_TRESC', $result->fileContent);
        $this->assertSame('kontrakt.pdf', $result->originalName);
        $this->assertSame('application/pdf', $result->mimeType);

        $this->assertDatabaseHas('documents', [
            'id' => $doc->id,
            'download_count' => 1,
        ]);

        $this->assertDatabaseHas('document_access_logs', [
            'document_id' => $doc->id,
            'action' => 'download',
            'user_id' => $this->user->id,
        ]);
    }

    public function test_delete_document_handler_removes_file_and_soft_deletes(): void
    {
        $uploadHandler = app(UploadDocumentHandler::class);
        $deleteHandler = app(DeleteDocumentHandler::class);

        $doc = $uploadHandler->handle(new UploadDocumentCommand(
            companyId: $this->company->id,
            userId: $this->user->id,
            title: 'Dokument Do Usuniecia',
            type: 'tax_declaration',
            fileContent: 'DEKLARACJA_VAT',
            originalName: 'vat.pdf',
            mimeType: 'application/pdf',
            sizeBytes: 14,
            extension: 'pdf'
        ));

        $deleteHandler->handle(new DeleteDocumentCommand(
            id: $doc->id,
            userId: $this->user->id,
            ipAddress: '127.0.0.1',
            userAgent: 'Deleter Client'
        ));

        $this->assertSoftDeleted('documents', [
            'id' => $doc->id,
        ]);

        $this->assertDatabaseHas('document_access_logs', [
            'document_id' => $doc->id,
            'action' => 'destroy',
            'user_id' => $this->user->id,
        ]);
    }
}
