<?php

declare(strict_types=1);

namespace App\Contexts\DocumentManagement\Domain\Events;

use App\Contexts\DocumentManagement\Domain\ValueObjects\DocumentId;
use App\Shared\Domain\DomainEvent;
use DateTimeImmutable;

final class DocumentDownloaded implements DomainEvent
{
    private DateTimeImmutable $occurredAt;

    public function __construct(
        private readonly DocumentId $documentId,
        private readonly string $companyId,
        private readonly string $downloadedByUserId,
        private readonly int $newDownloadCount,
        ?DateTimeImmutable $occurredAt = null
    ) {
        $this->occurredAt = $occurredAt ?? new DateTimeImmutable();
    }

    public function occurredAt(): DateTimeImmutable
    {
        return $this->occurredAt;
    }

    public function aggregateId(): string
    {
        return $this->documentId->value();
    }

    public function companyId(): string
    {
        return $this->companyId;
    }

    public function toPayload(): array
    {
        return [
            'document_id' => $this->documentId->value(),
            'company_id' => $this->companyId,
            'downloaded_by_user_id' => $this->downloadedByUserId,
            'new_download_count' => $this->newDownloadCount,
            'occurred_at' => $this->occurredAt->format(DateTimeImmutable::ATOM),
        ];
    }
}
