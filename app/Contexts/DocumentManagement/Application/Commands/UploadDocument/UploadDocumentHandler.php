<?php

declare(strict_types=1);

namespace App\Contexts\DocumentManagement\Application\Commands\UploadDocument;

use App\Contexts\DocumentManagement\Domain\Model\Document as DomainDocument;
use App\Contexts\DocumentManagement\Domain\Repositories\DocumentRepositoryInterface;
use App\Contexts\DocumentManagement\Domain\Services\TransactionalStorageManagerInterface;
use App\Contexts\DocumentManagement\Domain\Services\VdrEncryptionServiceInterface;
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
        private readonly TransactionalStorageManagerInterface $storageManager,
        private readonly VdrEncryptionServiceInterface $encryptionService
    ) {
    }

    public function handle(UploadDocumentCommand $command): EloquentDocument
    {
        $docId = DocumentId::generate();

        // 1. Calculate SHA-256 checksum from original plaintext for substantive integrity verification
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

        // 2. Perform AES-256-GCM encryption at rest
        $encryptedPayload = $this->encryptionService->encrypt($command->fileContent, $command->keyId);
        $isEncrypted = true;
        $encryptionAlgo = $encryptedPayload->algorithm();
        $encryptionIv = $encryptedPayload->ivBase64();
        $encryptionTag = $encryptedPayload->tagBase64();
        $keyId = $encryptedPayload->keyId();
        $contentToStore = $encryptedPayload->ciphertext();

        // Memory cleanup of intermediate payload
        unset($encryptedPayload);

        // 3. Atomically write ciphertext to cloud/local storage and metadata to PostgreSQL
        try {
            return $this->storageManager->transaction(function (TransactionalStorageManagerInterface $manager) use (
                $command,
                $docId,
                $directory,
                $filename,
                $documentType,
                $metadata,
                $folderIdVO,
                $indexCodeVO,
                $contentToStore,
                $isEncrypted,
                $encryptionAlgo,
                $encryptionIv,
                $encryptionTag,
                $keyId
            ): EloquentDocument {
                $storagePath = $manager->store($contentToStore, $directory, $filename);

                $domainDoc = DomainDocument::upload(
                    id: $docId,
                    companyId: $command->companyId,
                    uploadedByUserId: $command->userId,
                    title: $command->title,
                    type: $documentType,
                    fileMetadata: $metadata,
                    storagePath: $storagePath,
                    folderId: $folderIdVO,
                    indexCode: $indexCodeVO,
                    isEncrypted: $isEncrypted,
                    encryptionAlgo: $encryptionAlgo,
                    encryptionIv: $encryptionIv,
                    encryptionTag: $encryptionTag,
                    keyId: $keyId
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
        } finally {
            unset($contentToStore);
        }
    }
}
