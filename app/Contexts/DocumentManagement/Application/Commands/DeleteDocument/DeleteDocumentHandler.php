<?php

declare(strict_types=1);

namespace App\Contexts\DocumentManagement\Application\Commands\DeleteDocument;

use App\Contexts\DocumentManagement\Application\Exceptions\DocumentNotFoundException;
use App\Contexts\DocumentManagement\Domain\Repositories\DocumentRepositoryInterface;
use App\Contexts\DocumentManagement\Domain\Services\TransactionalStorageManagerInterface;
use App\Contexts\DocumentManagement\Domain\ValueObjects\DocumentId;

final class DeleteDocumentHandler
{
    public function __construct(
        private readonly DocumentRepositoryInterface $repository,
        private readonly TransactionalStorageManagerInterface $storageManager
    ) {
    }

    public function handle(DeleteDocumentCommand $command): void
    {
        $domainDoc = $this->repository->findById(DocumentId::fromString($command->id));

        if ($domainDoc === null) {
            throw DocumentNotFoundException::withId($command->id);
        }

        $this->storageManager->transaction(function (TransactionalStorageManagerInterface $manager) use (
            $domainDoc,
            $command
        ): void {
            $this->repository->logAccess(
                documentId: $domainDoc->documentId(),
                userId: $command->userId,
                action: 'destroy',
                ipAddress: $command->ipAddress,
                userAgent: $command->userAgent,
                documentTitle: $domainDoc->title(),
                companyId: $domainDoc->companyId()
            );

            $this->repository->delete($domainDoc->documentId());
            $manager->stageDeletion($domainDoc->storagePath());
        });
    }
}
