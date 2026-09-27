<?php

declare(strict_types=1);

namespace App\Contexts\DocumentManagement\Domain\Events;

use App\Contexts\DocumentManagement\Domain\ValueObjects\FolderId;
use App\Shared\Domain\DomainEvent;
use DateTimeImmutable;

final class TransactionFolderDeleted implements DomainEvent
{
    private DateTimeImmutable $occurredAt;

    public function __construct(
        private readonly FolderId $folderId,
        private readonly string $companyId,
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
        return $this->folderId->value();
    }

    public function companyId(): string
    {
        return $this->companyId;
    }

    public function toPayload(): array
    {
        return [
            'folder_id' => $this->folderId->value(),
            'company_id' => $this->companyId,
            'occurred_at' => $this->occurredAt->format(DateTimeImmutable::ATOM),
        ];
    }
}
