<?php

declare(strict_types=1);

namespace App\Contexts\DocumentManagement\Application\Commands\UpdateDocument;

use App\Contexts\DocumentManagement\Application\Exceptions\DocumentNotFoundException;
use App\Contexts\DocumentManagement\Domain\Repositories\DocumentRepositoryInterface;
use App\Contexts\DocumentManagement\Domain\ValueObjects\DeweyIndexCode;
use App\Contexts\DocumentManagement\Domain\ValueObjects\DocumentId;
use App\Contexts\DocumentManagement\Domain\ValueObjects\DocumentType;
use App\Contexts\DocumentManagement\Domain\ValueObjects\FolderId;
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

        if ($command->folderId !== null) {
            $folderIdVO = trim($command->folderId) !== '' ? FolderId::fromString($command->folderId) : null;
            $indexCodeVO = $command->indexCode !== null && trim($command->indexCode) !== ''
                ? DeweyIndexCode::fromString($command->indexCode)
                : null;
            $domainDoc->assignToFolder($folderIdVO, $indexCodeVO);
        } elseif ($command->indexCode !== null) {
            $indexCodeVO = trim($command->indexCode) !== '' ? DeweyIndexCode::fromString($command->indexCode) : null;
            $domainDoc->updateIndexCode($indexCodeVO);
        }

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

        return EloquentDocument::with(['uploader', 'folder'])->findOrFail($command->id);
    }
}
