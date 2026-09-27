<?php

declare(strict_types=1);

namespace App\Presentation\Api\Controllers;

use App\Contexts\DocumentManagement\Domain\Model\Document as DomainDocument;
use App\Contexts\DocumentManagement\Domain\Repositories\DocumentRepositoryInterface;
use App\Contexts\DocumentManagement\Domain\Services\DocumentStorageInterface;
use App\Contexts\DocumentManagement\Domain\ValueObjects\DocumentId;
use App\Contexts\DocumentManagement\Domain\ValueObjects\DocumentType;
use App\Contexts\DocumentManagement\Domain\ValueObjects\FileMetadata;
use App\Models\Document as EloquentDocument;
use App\Models\DocumentAccessLog;
use App\Models\User;
use App\Presentation\Api\Requests\UpdateDocumentRequest;
use App\Presentation\Api\Requests\UploadDocumentRequest;
use App\Presentation\Api\Resources\DocumentAccessLogResource;
use App\Presentation\Api\Resources\DocumentResource;
use App\Presentation\Api\Traits\ResolvesCompanyContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response as HttpResponse;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

final class DocumentController
{
    use ResolvesCompanyContext;

    public function __construct(
        private readonly DocumentRepositoryInterface $repository,
        private readonly DocumentStorageInterface $storage
    ) {
    }

    /**
     * List documents for the authorized company with filtering.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $companyId = $this->resolveCompanyId($request);

        $query = EloquentDocument::query()
            ->with('uploader')
            ->where('company_id', $companyId);

        if (!$request->boolean('include_archived', false)) {
            $query->where('is_archived', false);
        }

        if ($request->filled('type')) {
            $query->where('type', $request->query('type'));
        }

        if ($request->filled('search')) {
            $search = '%' . trim((string) $request->query('search')) . '%';
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', $search)
                  ->orWhere('original_name', 'like', $search);
            });
        }

        $documents = $query
            ->orderBy('created_at', 'desc')
            ->paginate($request->integer('per_page', 20));

        return DocumentResource::collection($documents);
    }

    /**
     * Upload and register a new document in the Data Room.
     */
    public function store(UploadDocumentRequest $request): JsonResponse
    {
        $companyId = $this->resolveCompanyId($request);
        $user = $request->user();
        $file = $request->file('file');

        $docId = DocumentId::generate();
        $fileContent = (string) file_get_contents($file->getRealPath());
        $checksum = hash('sha256', $fileContent);
        $originalName = $file->getClientOriginalName();
        $mimeType = $file->getClientMimeType() ?: 'application/octet-stream';
        $sizeBytes = $file->getSize();

        $metadata = new FileMetadata(
            originalName: $originalName,
            mimeType: $mimeType,
            sizeInBytes: $sizeBytes,
            checksumSha256: $checksum
        );

        $extension = $file->getClientOriginalExtension() ?: 'bin';
        $directory = sprintf('dataroom/%s', $companyId);
        $filename = sprintf('%s.%s', $docId->value(), $extension);

        $storagePath = $this->storage->store($fileContent, $directory, $filename);

        $documentType = DocumentType::from((string) $request->input('type'));

        $domainDoc = DomainDocument::upload(
            id: $docId,
            companyId: $companyId,
            uploadedByUserId: $user->id,
            title: (string) $request->input('title'),
            type: $documentType,
            fileMetadata: $metadata,
            storagePath: $storagePath
        );

        $this->repository->save($domainDoc);

        $this->repository->logAccess(
            documentId: $docId,
            userId: $user->id,
            action: 'upload',
            ipAddress: $request->ip(),
            userAgent: $request->userAgent()
        );

        $eloquentDoc = EloquentDocument::with('uploader')->findOrFail($docId->value());

        return (new DocumentResource($eloquentDoc))
            ->response()
            ->setStatusCode(Response::HTTP_CREATED);
    }

    /**
     * Get document metadata.
     */
    public function show(string $id, Request $request): DocumentResource
    {
        $document = EloquentDocument::with('uploader')->find($id);

        if ($document === null) {
            throw new NotFoundHttpException('Dokument nie został odnaleziony.');
        }

        $this->ensureCanAccessDocument($request->user(), $document);

        return new DocumentResource($document);
    }

    /**
     * Download document file content and record audit log.
     */
    public function download(string $id, Request $request): HttpResponse
    {
        $domainDoc = $this->repository->findById(DocumentId::fromString($id));

        if ($domainDoc === null) {
            throw new NotFoundHttpException('Dokument nie został odnaleziony.');
        }

        $user = $request->user();
        $this->ensureCanAccessCompany($user, $domainDoc->companyId());

        $fileContent = $this->storage->get($domainDoc->storagePath());

        if ($fileContent === null) {
            throw new NotFoundHttpException('Plik dokumentu nie istnieje na dysku.');
        }

        $domainDoc->recordDownload($user->id);
        $this->repository->save($domainDoc);

        $this->repository->logAccess(
            documentId: $domainDoc->documentId(),
            userId: $user->id,
            action: 'download',
            ipAddress: $request->ip(),
            userAgent: $request->userAgent()
        );

        return response($fileContent, Response::HTTP_OK, [
            'Content-Type' => $domainDoc->fileMetadata()->mimeType(),
            'Content-Length' => (string) strlen($fileContent),
            'Content-Disposition' => sprintf('attachment; filename="%s"', addslashes($domainDoc->fileMetadata()->originalName())),
        ]);
    }

    /**
     * Update document metadata (title, type).
     */
    public function update(
        string $id,
        UpdateDocumentRequest $request
    ): DocumentResource {
        $domainDoc = $this->repository->findById(DocumentId::fromString($id));

        if ($domainDoc === null) {
            throw new NotFoundHttpException('Dokument nie został odnaleziony.');
        }

        $this->ensureCanAccessCompany($request->user(), $domainDoc->companyId());

        $domainDoc->updateTitle((string) $request->input('title'));
        $domainDoc->updateType(DocumentType::from((string) $request->input('type')));

        $this->repository->save($domainDoc);

        $eloquentDoc = EloquentDocument::with('uploader')->findOrFail($id);

        return new DocumentResource($eloquentDoc);
    }

    /**
     * Toggle archive status of a document.
     */
    public function archive(string $id, Request $request): DocumentResource
    {
        $domainDoc = $this->repository->findById(DocumentId::fromString($id));

        if ($domainDoc === null) {
            throw new NotFoundHttpException('Dokument nie został odnaleziony.');
        }

        $user = $request->user();
        $this->ensureCanAccessCompany($user, $domainDoc->companyId());

        if ($domainDoc->isArchived()) {
            $domainDoc->unarchive();
            $action = 'unarchive';
        } else {
            $domainDoc->archive();
            $action = 'archive';
        }

        $this->repository->save($domainDoc);

        $this->repository->logAccess(
            documentId: $domainDoc->documentId(),
            userId: $user->id,
            action: $action,
            ipAddress: $request->ip(),
            userAgent: $request->userAgent()
        );

        $eloquentDoc = EloquentDocument::with('uploader')->findOrFail($id);

        return new DocumentResource($eloquentDoc);
    }

    /**
     * Delete document from storage and database.
     */
    public function destroy(string $id, Request $request): JsonResponse
    {
        $domainDoc = $this->repository->findById(DocumentId::fromString($id));

        if ($domainDoc === null) {
            throw new NotFoundHttpException('Dokument nie został odnaleziony.');
        }

        $this->ensureCanAccessCompany($request->user(), $domainDoc->companyId());

        $this->storage->delete($domainDoc->storagePath());
        $this->repository->delete($domainDoc->documentId());

        return new JsonResponse([
            'status' => 'deleted',
            'message' => 'Dokument został trwale usunięty z wirtualnego pokoju danych.',
        ], Response::HTTP_OK);
    }

    /**
     * Get audit log history for a specific document.
     */
    public function auditLogs(string $id, Request $request): AnonymousResourceCollection
    {
        $document = EloquentDocument::withTrashed()->find($id);

        if ($document === null) {
            throw new NotFoundHttpException('Dokument nie został odnaleziony.');
        }

        $this->ensureCanAccessDocument($request->user(), $document);

        $logs = DocumentAccessLog::query()
            ->with(['user', 'document' => function ($q) {
                $q->withTrashed();
            }])
            ->where('document_id', $id)
            ->orderBy('created_at', 'desc')
            ->paginate($request->integer('per_page', 20));

        return DocumentAccessLogResource::collection($logs);
    }

    /**
     * Get all audit logs for the company's Data Room.
     */
    public function allAuditLogs(Request $request): AnonymousResourceCollection
    {
        $companyId = $this->resolveCompanyId($request);

        $logs = DocumentAccessLog::query()
            ->where(function ($query) use ($companyId) {
                $query->where('company_id', $companyId)
                    ->orWhereHas('document', function ($q) use ($companyId) {
                        $q->withTrashed()->where('company_id', $companyId);
                    });
            })
            ->with(['user', 'document' => function ($q) {
                $q->withTrashed();
            }])
            ->orderBy('created_at', 'desc')
            ->paginate($request->integer('per_page', 25));

        return DocumentAccessLogResource::collection($logs);
    }

    private function ensureCanAccessDocument(User $user, EloquentDocument $doc): void
    {
        $this->ensureCanAccessCompany($user, (string) $doc->company_id);
    }

    private function ensureCanAccessCompany(User $user, string $companyId): void
    {
        if (!$user->canAccessCompany($companyId)) {
            throw new AccessDeniedHttpException('Brak uprawnień do zasobów wirtualnego pokoju danych innej firmy.');
        }
    }
}
