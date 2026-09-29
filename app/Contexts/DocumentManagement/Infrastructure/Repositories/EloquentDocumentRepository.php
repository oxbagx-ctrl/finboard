<?php

declare(strict_types=1);

namespace App\Contexts\DocumentManagement\Infrastructure\Repositories;

use App\Contexts\DocumentManagement\Domain\Model\Document;
use App\Contexts\DocumentManagement\Domain\Repositories\DocumentRepositoryInterface;
use App\Contexts\DocumentManagement\Domain\ValueObjects\DocumentId;
use App\Contexts\DocumentManagement\Domain\ValueObjects\DocumentType;
use App\Contexts\DocumentManagement\Domain\ValueObjects\FileMetadata;
use App\Models\Document as EloquentDocument;
use App\Models\DocumentAccessLog as EloquentAccessLog;
use DateTimeImmutable;
use Illuminate\Contracts\Events\Dispatcher;
use Illuminate\Support\Str;

final class EloquentDocumentRepository implements DocumentRepositoryInterface
{
    public function __construct(
        private readonly Dispatcher $dispatcher
    ) {
    }

    public function findById(DocumentId $id): ?Document
    {
        /** @var EloquentDocument|null $eloquent */
        $eloquent = EloquentDocument::find($id->value());

        if ($eloquent === null) {
            return null;
        }

        return $this->toDomain($eloquent);
    }

    /**
     * @return array<Document>
     */
    public function findByCompanyId(string $companyId, bool $includeArchived = false): array
    {
        $query = EloquentDocument::query()
            ->where('company_id', $companyId)
            ->orderBy('created_at', 'desc');

        if (!$includeArchived) {
            $query->where('is_archived', false);
        }

        return $query->get()
            ->map(fn (EloquentDocument $doc) => $this->toDomain($doc))
            ->all();
    }

    public function save(Document $document): void
    {
        EloquentDocument::query()->updateOrCreate(
            ['id' => $document->id()],
            [
                'company_id' => $document->companyId(),
                'uploaded_by_user_id' => $document->uploadedByUserId(),
                'title' => $document->title(),
                'type' => $document->type()->value,
                'original_name' => $document->fileMetadata()->originalName(),
                'mime_type' => $document->fileMetadata()->mimeType(),
                'size_bytes' => $document->fileMetadata()->sizeInBytes(),
                'checksum_sha256' => $document->fileMetadata()->checksumSha256(),
                'storage_path' => $document->storagePath(),
                'folder_id' => $document->folderId()?->value(),
                'index_code' => $document->indexCode()?->value(),
                'download_count' => $document->downloadCount(),
                'is_archived' => $document->isArchived(),
                'is_encrypted' => $document->isEncrypted(),
                'encryption_algo' => $document->encryptionAlgo(),
                'encryption_iv' => $document->encryptionIv(),
                'encryption_tag' => $document->encryptionTag(),
                'key_id' => $document->keyId(),
            ]
        );

        foreach ($document->releaseEvents() as $event) {
            $this->dispatcher->dispatch($event);
        }
    }

    public function delete(DocumentId $id): void
    {
        EloquentDocument::destroy($id->value());
    }

    public function logAccess(
        DocumentId $documentId,
        string $userId,
        string $action,
        ?string $ipAddress = null,
        ?string $userAgent = null,
        ?string $documentTitle = null,
        ?string $companyId = null
    ): void {
        if ($documentTitle === null || $companyId === null) {
            $doc = EloquentDocument::withTrashed()->find($documentId->value());
            $documentTitle = $documentTitle ?? $doc?->title;
            $companyId = $companyId ?? $doc?->company_id;
        }

        EloquentAccessLog::create([
            'id' => Str::uuid()->toString(),
            'document_id' => $documentId->value(),
            'document_title' => $documentTitle,
            'company_id' => $companyId,
            'user_id' => $userId,
            'action' => $action,
            'ip_address' => $ipAddress,
            'user_agent' => $userAgent,
            'created_at' => now(),
        ]);
    }

    private function toDomain(EloquentDocument $eloquent): Document
    {
        $metadata = new FileMetadata(
            originalName: $eloquent->original_name,
            mimeType: $eloquent->mime_type,
            sizeInBytes: (int) $eloquent->size_bytes,
            checksumSha256: $eloquent->checksum_sha256
        );

        $createdAt = new DateTimeImmutable($eloquent->created_at?->format(DateTimeImmutable::ATOM) ?? 'now');
        $updatedAt = $eloquent->updated_at ? new DateTimeImmutable($eloquent->updated_at->format(DateTimeImmutable::ATOM)) : null;

        return new Document(
            id: DocumentId::fromString($eloquent->id),
            companyId: $eloquent->company_id,
            uploadedByUserId: $eloquent->uploaded_by_user_id,
            title: $eloquent->title,
            type: DocumentType::from($eloquent->type),
            fileMetadata: $metadata,
            storagePath: $eloquent->storage_path,
            folderId: $eloquent->folder_id !== null ? \App\Contexts\DocumentManagement\Domain\ValueObjects\FolderId::fromString($eloquent->folder_id) : null,
            indexCode: $eloquent->index_code !== null ? \App\Contexts\DocumentManagement\Domain\ValueObjects\DeweyIndexCode::fromString($eloquent->index_code) : null,
            downloadCount: (int) $eloquent->download_count,
            isArchived: (bool) $eloquent->is_archived,
            createdAt: $createdAt,
            updatedAt: $updatedAt,
            isEncrypted: (bool) ($eloquent->is_encrypted ?? false),
            encryptionAlgo: $eloquent->encryption_algo,
            encryptionIv: $eloquent->encryption_iv,
            encryptionTag: $eloquent->encryption_tag,
            keyId: (string) ($eloquent->key_id ?? 'vdr-key-1')
        );
    }
}
