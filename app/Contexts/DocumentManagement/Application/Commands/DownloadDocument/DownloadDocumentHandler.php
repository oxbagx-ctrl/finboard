<?php

declare(strict_types=1);

namespace App\Contexts\DocumentManagement\Application\Commands\DownloadDocument;

use App\Contexts\DocumentManagement\Application\Exceptions\DocumentNotFoundException;
use App\Contexts\DocumentManagement\Application\Exceptions\FileNotFoundInStorageException;
use App\Contexts\DocumentManagement\Domain\Repositories\DocumentRepositoryInterface;
use App\Contexts\DocumentManagement\Domain\Services\DocumentStorageInterface;
use App\Contexts\DocumentManagement\Domain\Services\PdfWatermarkServiceInterface;
use App\Contexts\DocumentManagement\Domain\Services\VdrEncryptionServiceInterface;
use App\Contexts\DocumentManagement\Domain\ValueObjects\DocumentId;

final class DownloadDocumentHandler
{
    private readonly VdrEncryptionServiceInterface $encryptionService;

    public function __construct(
        private readonly DocumentRepositoryInterface $repository,
        private readonly DocumentStorageInterface $storage,
        private readonly PdfWatermarkServiceInterface $watermarkService,
        ?VdrEncryptionServiceInterface $encryptionService = null
    ) {
        $this->encryptionService = $encryptionService ?? app(VdrEncryptionServiceInterface::class);
    }

    public function handle(DownloadDocumentCommand $command): DownloadDocumentResult
    {
        $domainDoc = $this->repository->findById(DocumentId::fromString($command->id));

        if ($domainDoc === null) {
            throw DocumentNotFoundException::withId($command->id);
        }

        $fileContent = $this->storage->get($domainDoc->storagePath());

        if ($fileContent === null) {
            throw FileNotFoundInStorageException::defaultMessage();
        }

        if ($domainDoc->isEncrypted()) {
            $fileContent = $this->encryptionService->decrypt(
                cipherContent: $fileContent,
                iv: (string) $domainDoc->encryptionIv(),
                tag: (string) $domainDoc->encryptionTag(),
                keyId: $domainDoc->keyId(),
                algorithm: $domainDoc->encryptionAlgo() ?? 'aes-256-gcm'
            );
        }

        $domainDoc->recordDownload($command->userId);
        $this->repository->save($domainDoc);

        $this->repository->logAccess(
            documentId: $domainDoc->documentId(),
            userId: $command->userId,
            action: 'download',
            ipAddress: $command->ipAddress,
            userAgent: $command->userAgent,
            documentTitle: $domainDoc->title(),
            companyId: $domainDoc->companyId()
        );

        if (
            $command->watermarkOptions !== null &&
            $this->watermarkService->supportsWatermarking(
                $domainDoc->fileMetadata()->mimeType(),
                $domainDoc->fileMetadata()->originalName()
            )
        ) {
            $fileContent = $this->watermarkService->applyWatermark($fileContent, $command->watermarkOptions);
        }

        return new DownloadDocumentResult(
            fileContent: $fileContent,
            originalName: $domainDoc->fileMetadata()->originalName(),
            mimeType: $domainDoc->fileMetadata()->mimeType(),
            sizeBytes: (int) strlen($fileContent)
        );
    }
}
