<?php

declare(strict_types=1);

namespace App\Contexts\DocumentManagement\Domain\Events;

use App\Contexts\DocumentManagement\Domain\ValueObjects\AccessSubject;
use App\Contexts\DocumentManagement\Domain\ValueObjects\DocumentId;
use App\Contexts\DocumentManagement\Domain\ValueObjects\PermissionLevel;
use App\Contexts\DocumentManagement\Domain\ValueObjects\VdrPermissionId;
use App\Shared\Domain\DomainEvent;
use DateTimeImmutable;

final class VdrDocumentPermissionGranted implements DomainEvent
{
    private DateTimeImmutable $occurredAt;

    public function __construct(
        private readonly VdrPermissionId $permissionId,
        private readonly string $companyId,
        private readonly DocumentId $documentId,
        private readonly AccessSubject $subject,
        private readonly PermissionLevel $permissionLevel,
        private readonly bool $watermarkRequired,
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

    public function documentId(): DocumentId
    {
        return $this->documentId;
    }

    public function subject(): AccessSubject
    {
        return $this->subject;
    }

    public function permissionLevel(): PermissionLevel
    {
        return $this->permissionLevel;
    }

    public function watermarkRequired(): bool
    {
        return $this->watermarkRequired;
    }

    public function toPayload(): array
    {
        return [
            'permission_id' => $this->permissionId->value(),
            'company_id' => $this->companyId,
            'document_id' => $this->documentId->value(),
            'subject_type' => $this->subject->type(),
            'subject_id' => $this->subject->id(),
            'permission_level' => $this->permissionLevel->value,
            'watermark_required' => $this->watermarkRequired,
            'occurred_at' => $this->occurredAt->format(DateTimeImmutable::ATOM),
        ];
    }
}
