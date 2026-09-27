<?php

declare(strict_types=1);

namespace App\Presentation\Api\Controllers;

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
use App\Contexts\DocumentManagement\Application\Queries\GetDocumentById\GetDocumentByIdHandler;
use App\Contexts\DocumentManagement\Application\Queries\GetDocumentById\GetDocumentByIdQuery;
use App\Contexts\DocumentManagement\Application\Queries\GetDocuments\GetDocumentsHandler;
use App\Contexts\DocumentManagement\Application\Queries\GetDocuments\GetDocumentsQuery;
use App\Contexts\DocumentManagement\Application\Queries\GetVdrAuditLogs\GetVdrAuditLogsHandler;
use App\Contexts\DocumentManagement\Application\Queries\GetVdrAuditLogs\GetVdrAuditLogsQuery;
use App\Models\Document as EloquentDocument;
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
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\HeaderUtils;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

final class DocumentController
{
    use ResolvesCompanyContext;

    public function __construct(
        private readonly GetDocumentsHandler $getDocumentsHandler,
        private readonly GetDocumentByIdHandler $getDocumentByIdHandler,
        private readonly UploadDocumentHandler $uploadDocumentHandler,
        private readonly UpdateDocumentHandler $updateDocumentHandler,
        private readonly ArchiveDocumentHandler $archiveDocumentHandler,
        private readonly DeleteDocumentHandler $deleteDocumentHandler,
        private readonly DownloadDocumentHandler $downloadDocumentHandler,
        private readonly GetVdrAuditLogsHandler $getVdrAuditLogsHandler
    ) {
    }

    /**
     * List documents for the authorized company with filtering.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $companyId = $this->resolveCompanyId($request);

        $query = new GetDocumentsQuery(
            companyId: $companyId,
            includeArchived: $request->boolean('include_archived', false),
            type: $request->filled('type') ? (string) $request->query('type') : null,
            search: $request->filled('search') ? (string) $request->query('search') : null,
            perPage: $request->integer('per_page', 20),
            page: $request->integer('page', 1)
        );

        $documents = $this->getDocumentsHandler->handle($query);

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

        $command = new UploadDocumentCommand(
            companyId: $companyId,
            userId: (string) $user->id,
            title: (string) $request->input('title'),
            type: (string) $request->input('type'),
            fileContent: (string) file_get_contents($file->getRealPath()),
            originalName: $file->getClientOriginalName(),
            mimeType: $file->getClientMimeType() ?: 'application/octet-stream',
            sizeBytes: (int) $file->getSize(),
            extension: (string) ($file->getClientOriginalExtension() ?: 'bin'),
            ipAddress: $request->ip(),
            userAgent: $request->userAgent()
        );

        $document = $this->uploadDocumentHandler->handle($command);

        return (new DocumentResource($document))
            ->response()
            ->setStatusCode(Response::HTTP_CREATED);
    }

    /**
     * Get document metadata.
     */
    public function show(string $id, Request $request): DocumentResource
    {
        $document = $this->getDocumentByIdHandler->handle(new GetDocumentByIdQuery(id: $id));

        $this->ensureCanAccessDocument($request->user(), $document);

        return new DocumentResource($document);
    }

    /**
     * Download document file content and record audit log.
     */
    public function download(string $id, Request $request): HttpResponse
    {
        $document = $this->getDocumentByIdHandler->handle(new GetDocumentByIdQuery(id: $id));

        $this->ensureCanAccessDocument($request->user(), $document);

        $result = $this->downloadDocumentHandler->handle(new DownloadDocumentCommand(
            id: $id,
            userId: (string) $request->user()->id,
            ipAddress: $request->ip(),
            userAgent: $request->userAgent()
        ));

        $originalName = $result->originalName;
        $fallbackName = Str::ascii($originalName);
        $fallbackName = preg_replace('/[^\x20-\x7e]/', '', $fallbackName) ?: 'document';
        $disposition = HeaderUtils::makeDisposition(
            HeaderUtils::DISPOSITION_ATTACHMENT,
            $originalName,
            $fallbackName
        );

        return response($result->fileContent, Response::HTTP_OK, [
            'Content-Type' => $result->mimeType,
            'Content-Length' => (string) $result->sizeBytes,
            'Content-Disposition' => $disposition,
        ]);
    }

    /**
     * Update document metadata (title, type).
     */
    public function update(
        string $id,
        UpdateDocumentRequest $request
    ): DocumentResource {
        $document = $this->getDocumentByIdHandler->handle(new GetDocumentByIdQuery(id: $id));

        $this->ensureCanAccessDocument($request->user(), $document);

        $updated = $this->updateDocumentHandler->handle(new UpdateDocumentCommand(
            id: $id,
            title: (string) $request->input('title'),
            type: (string) $request->input('type'),
            userId: (string) $request->user()->id,
            ipAddress: $request->ip(),
            userAgent: $request->userAgent()
        ));

        return new DocumentResource($updated);
    }

    /**
     * Toggle archive status of a document.
     */
    public function archive(string $id, Request $request): DocumentResource
    {
        $document = $this->getDocumentByIdHandler->handle(new GetDocumentByIdQuery(id: $id));

        $this->ensureCanAccessDocument($request->user(), $document);

        $archived = $this->archiveDocumentHandler->handle(new ArchiveDocumentCommand(
            id: $id,
            userId: (string) $request->user()->id,
            ipAddress: $request->ip(),
            userAgent: $request->userAgent()
        ));

        return new DocumentResource($archived);
    }

    /**
     * Delete document from storage and database.
     */
    public function destroy(string $id, Request $request): JsonResponse
    {
        $document = $this->getDocumentByIdHandler->handle(new GetDocumentByIdQuery(id: $id));

        $this->ensureCanAccessDocument($request->user(), $document);

        $this->deleteDocumentHandler->handle(new DeleteDocumentCommand(
            id: $id,
            userId: (string) $request->user()->id,
            ipAddress: $request->ip(),
            userAgent: $request->userAgent()
        ));

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
        $document = $this->getDocumentByIdHandler->handle(new GetDocumentByIdQuery(id: $id, withTrash: true));

        $this->ensureCanAccessDocument($request->user(), $document);

        $query = new GetVdrAuditLogsQuery(
            companyId: (string) $document->company_id,
            action: $request->filled('action') ? (string) $request->query('action') : null,
            search: $request->filled('search') ? (string) $request->query('search') : null,
            documentId: $id,
            perPage: $request->integer('per_page', 20),
            page: $request->integer('page', 1)
        );

        $logs = $this->getVdrAuditLogsHandler->handle($query);

        return DocumentAccessLogResource::collection($logs);
    }

    /**
     * Get all audit logs for the company's Data Room with server-side action and search filtering.
     */
    public function allAuditLogs(Request $request): AnonymousResourceCollection
    {
        $companyId = $this->resolveCompanyId($request);

        $query = new GetVdrAuditLogsQuery(
            companyId: $companyId,
            action: $request->filled('action') ? (string) $request->query('action') : null,
            search: $request->filled('search') ? (string) $request->query('search') : null,
            documentId: $request->filled('document_id') ? (string) $request->query('document_id') : null,
            perPage: $request->integer('per_page', 25),
            page: $request->integer('page', 1)
        );

        $logs = $this->getVdrAuditLogsHandler->handle($query);

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
