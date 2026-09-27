<?php

declare(strict_types=1);

namespace App\Contexts\DocumentManagement\Application\Commands\UpdateDocument;

use App\Contexts\DocumentManagement\Application\Exceptions\DocumentNotFoundException;
use App\Contexts\DocumentManagement\Domain\Repositories\DocumentRepositoryInterface;
use App\Contexts\DocumentManagement\Domain\ValueObjects\DocumentId;
use App\Contexts\DocumentManagement\Domain\ValueObjects\DocumentType;
use App\Models\Document as EloquentDocument;

final class UpdateDocumentHandler
{
    public function __construct(
        private readonly DocumentRepositoryInterface $repository
    ) {
    }

    public function handle(UpdateDocumentCommand $command): EloquentDocument
    {
        $domainDoc = $this->repository->findById(DocumentId::fromString($command->id));

        if ($domainDoc === null) {
            throw DocumentNotFoundException::withId($command->id);
        }

        $domainDoc->updateTitle($command->title);
        $domainDoc->updateType(DocumentType::from($command->type));

        $this->repository->save($domainDoc);

        $this->repository->logAccess(
            documentId: $domainDoc->documentId(),
            userId: $command->userId,
            action: 'update',
            ipAddress: $command->ipAddress,
            userAgent: $command->userAgent,
            documentTitle: $domainDoc->title(),
            companyId: $domainDoc->companyId()
        );

        return EloquentDocument::with('uploader')->findOrFail($command->id);
    }
}
