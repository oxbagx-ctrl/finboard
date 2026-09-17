<?php

declare(strict_types=1);

namespace Tests\Unit\DocumentManagement;

use App\Contexts\DocumentManagement\Domain\Model\Document;
use App\Contexts\DocumentManagement\Domain\Repositories\DocumentRepositoryInterface;
use App\Contexts\DocumentManagement\Domain\Services\DocumentStorageInterface;
use App\Contexts\DocumentManagement\Domain\ValueObjects\DocumentId;
use App\Contexts\DocumentManagement\Domain\ValueObjects\DocumentType;
use App\Contexts\DocumentManagement\Domain\ValueObjects\FileMetadata;
use App\Models\Company;
use App\Models\DocumentAccessLog;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

final class DocumentRepositoryTest extends TestCase
{
    use DatabaseTransactions;

    private DocumentRepositoryInterface $repository;
    private DocumentStorageInterface $storage;
    private string $companyId;
    private string $userId;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
        $this->repository = $this->app->make(DocumentRepositoryInterface::class);
        $this->storage = $this->app->make(DocumentStorageInterface::class);

        $company = Company::firstOrCreate(
            ['code' => 'TEST_CO'],
            ['name' => 'Test Company S.A.', 'tax_id' => 'PL9999999999']
        );
        $this->companyId = $company->id;

        $user = User::first() ?? User::factory()->create(['company_id' => $this->companyId]);
        $this->userId = $user->id;
    }

    public function test_document_storage_operations(): void
    {
        $content = 'DUMMY PDF CONTENT';
        $path = $this->storage->store($content, 'vdr/' . $this->companyId, 'test_report.pdf');

        $this->assertTrue($this->storage->exists($path));
        $this->assertSame($content, $this->storage->get($path));

        $deleted = $this->storage->delete($path);
        $this->assertTrue($deleted);
        $this->assertFalse($this->storage->exists($path));
    }

    public function test_document_repository_save_and_retrieve(): void
    {
        $id = DocumentId::generate();
        $metadata = new FileMetadata(
            originalName: 'statut_spolki.pdf',
            mimeType: 'application/pdf',
            sizeInBytes: 524288,
            checksumSha256: hash('sha256', 'statut-content')
        );

        $document = Document::upload(
            id: $id,
            companyId: $this->companyId,
            uploadedByUserId: $this->userId,
            title: 'Statut Spółki Akcyjnej Acme',
            type: DocumentType::CONTRACT,
            fileMetadata: $metadata,
            storagePath: 'vdr/acme/statut.pdf'
        );

        $this->repository->save($document);

        $retrieved = $this->repository->findById($id);
        $this->assertNotNull($retrieved);
        $this->assertSame($id->value(), $retrieved->id());
        $this->assertSame('Statut Spółki Akcyjnej Acme', $retrieved->title());
        $this->assertSame(DocumentType::CONTRACT, $retrieved->type());
        $this->assertSame(524288, $retrieved->fileMetadata()->sizeInBytes());

        // Test company query
        $companyDocs = $this->repository->findByCompanyId($this->companyId);
        $this->assertNotEmpty($companyDocs);

        // Test access log
        $this->repository->logAccess($id, $this->userId, 'download', '127.0.0.1', 'Mozilla/5.0');
        $this->assertTrue(
            DocumentAccessLog::where('document_id', $id->value())
                ->where('user_id', $this->userId)
                ->where('action', 'download')
                ->exists()
        );
    }
}
