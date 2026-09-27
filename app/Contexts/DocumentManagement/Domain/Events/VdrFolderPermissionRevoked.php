<?php

declare(strict_types=1);

namespace App\Contexts\DocumentManagement\Domain\Events;

use App\Contexts\DocumentManagement\Domain\ValueObjects\AccessSubject;
use App\Contexts\DocumentManagement\Domain\ValueObjects\FolderId;
use App\Contexts\DocumentManagement\Domain\ValueObjects\VdrPermissionId;
use App\Shared\Domain\DomainEvent;
use DateTimeImmutable;

final class VdrFolderPermissionRevoked implements DomainEvent
{
    private DateTimeImmutable $occurredAt;

    public function __construct(
        private readonly VdrPermissionId $permissionId,
        private readonly string $companyId,
        private readonly FolderId $folderId,
        private readonly AccessSubject $subject,
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
        return $this->permissionId->value();
    }

    public function companyId(): string
    {
        return $this->companyId;
    }

    public function folderId(): FolderId
    {
        return $this->folderId;
    }

    public function subject(): AccessSubject
    {
        return $this->subject;
    }

    public function toPayload(): array
    {
        return [
            'permission_id' => $this->permissionId->value(),
            'company_id' => $this->companyId,
            'folder_id' => $this->folderId->value(),
            'subject_type' => $this->subject->type(),
            'subject_id' => $this->subject->id(),
            'occurred_at' => $this->occurredAt->format(DateTimeImmutable::ATOM),
        ];
    }
}
