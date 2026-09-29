<?php

declare(strict_types=1);

namespace App\Contexts\DocumentManagement\Domain\Model;

use App\Contexts\DocumentManagement\Domain\Events\DocumentArchived;
use App\Contexts\DocumentManagement\Domain\Events\DocumentDownloaded;
use App\Contexts\DocumentManagement\Domain\Events\DocumentUploaded;
use App\Contexts\DocumentManagement\Domain\ValueObjects\DocumentId;
use App\Contexts\DocumentManagement\Domain\ValueObjects\DocumentType;
use App\Contexts\DocumentManagement\Domain\ValueObjects\FileMetadata;
use App\Shared\Domain\AggregateRoot;
use DateTimeImmutable;
use InvalidArgumentException;

final class Document extends AggregateRoot
{
    public function __construct(
        private readonly DocumentId $id,
        private readonly string $companyId,
        private readonly string $uploadedByUserId,
        private string $title,
        private DocumentType $type,
        private readonly FileMetadata $fileMetadata,
        private readonly string $storagePath,
        private ?\App\Contexts\DocumentManagement\Domain\ValueObjects\FolderId $folderId = null,
        private ?\App\Contexts\DocumentManagement\Domain\ValueObjects\DeweyIndexCode $indexCode = null,
        private int $downloadCount = 0,
        private bool $isArchived = false,
        private readonly DateTimeImmutable $createdAt = new DateTimeImmutable(),
        private ?DateTimeImmutable $updatedAt = null,
        private bool $isEncrypted = false,
        private ?string $encryptionAlgo = null,
        private ?string $encryptionIv = null,
        private ?string $encryptionTag = null,
        private string $keyId = 'vdr-key-1'
    ) {
        if (trim($this->title) === '') {
            throw new InvalidArgumentException('Document title cannot be empty.');
        }

        if (trim($this->companyId) === '') {
            throw new InvalidArgumentException('Document must be associated with a valid company.');
        }

        if (trim($this->storagePath) === '') {
            throw new InvalidArgumentException('Document storage path cannot be empty.');
        }
    }

    public static function upload(
        DocumentId $id,
        string $companyId,
        string $uploadedByUserId,
        string $title,
        DocumentType $type,
        FileMetadata $fileMetadata,
        string $storagePath,
        ?\App\Contexts\DocumentManagement\Domain\ValueObjects\FolderId $folderId = null,
        ?\App\Contexts\DocumentManagement\Domain\ValueObjects\DeweyIndexCode $indexCode = null,
        bool $isEncrypted = false,
        ?string $encryptionAlgo = null,
        ?string $encryptionIv = null,
        ?string $encryptionTag = null,
        string $keyId = 'vdr-key-1'
    ): self {
        $document = new self(
            id: $id,
            companyId: trim($companyId),
            uploadedByUserId: trim($uploadedByUserId),
            title: trim($title),
            type: $type,
            fileMetadata: $fileMetadata,
            storagePath: trim($storagePath),
            folderId: $folderId,
            indexCode: $indexCode,
            downloadCount: 0,
            isArchived: false,
            createdAt: new DateTimeImmutable(),
            updatedAt: null,
            isEncrypted: $isEncrypted,
            encryptionAlgo: $encryptionAlgo,
            encryptionIv: $encryptionIv,
            encryptionTag: $encryptionTag,
            keyId: $keyId
        );

        $document->recordThat(new DocumentUploaded(
            documentId: $id,
            companyId: $document->companyId,
            uploadedByUserId: $document->uploadedByUserId,
            title: $document->title,
            documentType: $type->value,
            storagePath: $document->storagePath
        ));

        return $document;
    }

    public function id(): string
    {
        return $this->id->value();
    }

    public function documentId(): DocumentId
    {
        return $this->id;
    }

    public function companyId(): string
    {
        return $this->companyId;
    }

    public function uploadedByUserId(): string
    {
        return $this->uploadedByUserId;
    }

    public function title(): string
    {
        return $this->title;
    }

    public function type(): DocumentType
    {
        return $this->type;
    }

    public function fileMetadata(): FileMetadata
    {
        return $this->fileMetadata;
    }

    public function storagePath(): string
    {
        return $this->storagePath;
    }

    public function downloadCount(): int
    {
        return $this->downloadCount;
    }

    public function isArchived(): bool
    {
        return $this->isArchived;
    }

    public function createdAt(): DateTimeImmutable
    {
        return $this->createdAt;
    }

    public function updatedAt(): ?DateTimeImmutable
    {
        return $this->updatedAt;
    }

    public function recordDownload(string $userId): void
    {
        $this->downloadCount++;
        $this->updatedAt = new DateTimeImmutable();

        $this->recordThat(new DocumentDownloaded(
            documentId: $this->id,
            companyId: $this->companyId,
            downloadedByUserId: $userId,
            newDownloadCount: $this->downloadCount
        ));
    }

    public function archive(): void
    {
        if ($this->isArchived) {
            return;
        }

        $this->isArchived = true;
        $this->updatedAt = new DateTimeImmutable();

        $this->recordThat(new DocumentArchived(
            documentId: $this->id,
            companyId: $this->companyId
        ));
    }

    public function unarchive(): void
    {
        if (!$this->isArchived) {
            return;
        }

        $this->isArchived = false;
        $this->updatedAt = new DateTimeImmutable();
    }

    public function updateTitle(string $newTitle): void
    {
        $trimmed = trim($newTitle);
        if ($trimmed === '') {
            throw new InvalidArgumentException('Document title cannot be empty.');
        }

        $this->title = $trimmed;
        $this->updatedAt = new DateTimeImmutable();
    }

    public function updateType(DocumentType $newType): void
    {
        $this->type = $newType;
        $this->updatedAt = new DateTimeImmutable();
    }

    public function folderId(): ?\App\Contexts\DocumentManagement\Domain\ValueObjects\FolderId
    {
        return $this->folderId;
    }

    public function indexCode(): ?\App\Contexts\DocumentManagement\Domain\ValueObjects\DeweyIndexCode
    {
        return $this->indexCode;
    }

    public function assignToFolder(
        ?\App\Contexts\DocumentManagement\Domain\ValueObjects\FolderId $folderId,
        ?\App\Contexts\DocumentManagement\Domain\ValueObjects\DeweyIndexCode $indexCode = null
    ): void {
        $this->folderId = $folderId;
        $this->indexCode = $indexCode;
        $this->updatedAt = new DateTimeImmutable();
    }

    public function updateIndexCode(?\App\Contexts\DocumentManagement\Domain\ValueObjects\DeweyIndexCode $indexCode): void
    {
        $this->indexCode = $indexCode;
        $this->updatedAt = new DateTimeImmutable();
    }

    public function isEncrypted(): bool
    {
        return $this->isEncrypted;
    }

    public function encryptionAlgo(): ?string
    {
        return $this->encryptionAlgo;
    }

    public function encryptionIv(): ?string
    {
        return $this->encryptionIv;
    }

    public function encryptionTag(): ?string
    {
        return $this->encryptionTag;
    }

    public function keyId(): string
    {
        return $this->keyId;
    }

    public function markAsEncrypted(
        string $encryptionAlgo,
        string $encryptionIv,
        string $encryptionTag,
        string $keyId
    ): void {
        $this->isEncrypted = true;
        $this->encryptionAlgo = $encryptionAlgo;
        $this->encryptionIv = $encryptionIv;
        $this->encryptionTag = $encryptionTag;
        $this->keyId = $keyId;
        $this->updatedAt = new DateTimeImmutable();
    }
}
