<?php

declare(strict_types=1);

namespace App\Contexts\DocumentManagement\Application\Commands\ArchiveDocument;

use App\Contexts\DocumentManagement\Application\Exceptions\DocumentNotFoundException;
use App\Contexts\DocumentManagement\Domain\Repositories\DocumentRepositoryInterface;
use App\Contexts\DocumentManagement\Domain\ValueObjects\DocumentId;
use App\Models\Document as EloquentDocument;

final class ArchiveDocumentHandler
{
    public function __construct(
        private readonly DocumentRepositoryInterface $repository
    ) {
    }

    public function handle(ArchiveDocumentCommand $command): EloquentDocument
    {
        $domainDoc = $this->repository->findById(DocumentId::fromString($command->id));

        if ($domainDoc === null) {
            throw DocumentNotFoundException::withId($command->id);
        }

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
            userId: $command->userId,
            action: $action,
            ipAddress: $command->ipAddress,
            userAgent: $command->userAgent,
            documentTitle: $domainDoc->title(),
            companyId: $domainDoc->companyId()
        );

        return EloquentDocument::with('uploader')->findOrFail($command->id);
    }
}
