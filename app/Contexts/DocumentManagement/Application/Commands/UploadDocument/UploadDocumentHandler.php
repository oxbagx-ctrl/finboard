<?php

declare(strict_types=1);

namespace App\Contexts\DocumentManagement\Application\Commands\UploadDocument;

use App\Contexts\DocumentManagement\Domain\Model\Document as DomainDocument;
use App\Contexts\DocumentManagement\Domain\Repositories\DocumentRepositoryInterface;
use App\Contexts\DocumentManagement\Domain\Services\TransactionalStorageManagerInterface;
use App\Contexts\DocumentManagement\Domain\ValueObjects\DeweyIndexCode;
use App\Contexts\DocumentManagement\Domain\ValueObjects\DocumentId;
use App\Contexts\DocumentManagement\Domain\ValueObjects\DocumentType;
use App\Contexts\DocumentManagement\Domain\ValueObjects\FileMetadata;
use App\Contexts\DocumentManagement\Domain\ValueObjects\FolderId;
use App\Models\Document as EloquentDocument;

final class UploadDocumentHandler
{
    public function __construct(
        private readonly DocumentRepositoryInterface $repository,
        private readonly TransactionalStorageManagerInterface $storageManager
    ) {
    }

    public function handle(UploadDocumentCommand $command): EloquentDocument
    {
        $docId = DocumentId::generate();
        $checksum = hash('sha256', $command->fileContent);

        $metadata = new FileMetadata(
            originalName: $command->originalName,
            mimeType: $command->mimeType,
            sizeInBytes: $command->sizeBytes,
            checksumSha256: $checksum
        );

        $directory = sprintf('dataroom/%s', $command->companyId);
        $filename = sprintf('%s.%s', $docId->value(), $command->extension ?: 'bin');
        $documentType = DocumentType::from($command->type);

        $folderIdVO = $command->folderId !== null && trim($command->folderId) !== ''
            ? FolderId::fromString($command->folderId)
            : null;

        $indexCodeVO = $command->indexCode !== null && trim($command->indexCode) !== ''
            ? DeweyIndexCode::fromString($command->indexCode)
            : null;

        return $this->storageManager->transaction(function (TransactionalStorageManagerInterface $manager) use (
            $command,
            $docId,
            $directory,
            $filename,
            $documentType,
            $metadata,
            $folderIdVO,
            $indexCodeVO
        ): EloquentDocument {
            $storagePath = $manager->store($command->fileContent, $directory, $filename);

            $domainDoc = DomainDocument::upload(
                id: $docId,
                companyId: $command->companyId,
                uploadedByUserId: $command->userId,
                title: $command->title,
                type: $documentType,
                fileMetadata: $metadata,
                storagePath: $storagePath,
                folderId: $folderIdVO,
                indexCode: $indexCodeVO
            );

            $this->repository->save($domainDoc);

            $this->repository->logAccess(
                documentId: $docId,
                userId: $command->userId,
                action: 'upload',
                ipAddress: $command->ipAddress,
                userAgent: $command->userAgent,
                documentTitle: $domainDoc->title(),
                companyId: $command->companyId
            );

            return EloquentDocument::with(['uploader', 'folder'])->findOrFail($docId->value());
        });
    }
}
