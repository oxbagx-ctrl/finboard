<?php

declare(strict_types=1);

namespace App\Contexts\DocumentManagement\Domain\Model;

use App\Contexts\DocumentManagement\Domain\Events\VdrDocumentPermissionGranted;
use App\Contexts\DocumentManagement\Domain\Events\VdrDocumentPermissionRevoked;
use App\Contexts\DocumentManagement\Domain\ValueObjects\AccessSubject;
use App\Contexts\DocumentManagement\Domain\ValueObjects\DocumentId;
use App\Contexts\DocumentManagement\Domain\ValueObjects\PermissionLevel;
use App\Contexts\DocumentManagement\Domain\ValueObjects\VdrPermissionId;
use App\Shared\Domain\AggregateRoot;
use DateTimeImmutable;
use InvalidArgumentException;

final class VdrDocumentPermission extends AggregateRoot
{
    public function __construct(
        private readonly VdrPermissionId $id,
        private readonly string $companyId,
        private readonly DocumentId $documentId,
        private readonly AccessSubject $subject,
        private PermissionLevel $permissionLevel,
        private bool $watermarkRequired = false,
        private readonly DateTimeImmutable $createdAt = new DateTimeImmutable(),
        private ?DateTimeImmutable $updatedAt = null
    ) {
        if (trim($this->companyId) === '') {
            throw new InvalidArgumentException('Document permission must be associated with a valid company.');
        }
    }

    public static function grant(
        VdrPermissionId $id,
        string $companyId,
        DocumentId $documentId,
        AccessSubject $subject,
        PermissionLevel $permissionLevel,
        bool $watermarkRequired = false
    ): self {
        $permission = new self(
            id: $id,
            companyId: trim($companyId),
            documentId: $documentId,
            subject: $subject,
            permissionLevel: $permissionLevel,
            watermarkRequired: $watermarkRequired,
            createdAt: new DateTimeImmutable()
        );

        $permission->recordThat(new VdrDocumentPermissionGranted(
            permissionId: $permission->id,
            companyId: $permission->companyId,
            documentId: $permission->documentId,
            subject: $permission->subject,
            permissionLevel: $permission->permissionLevel,
            watermarkRequired: $permission->watermarkRequired,
            occurredAt: $permission->createdAt
        ));

        return $permission;
    }

    public function update(PermissionLevel $newLevel, bool $watermarkRequired): void
    {
        $this->permissionLevel = $newLevel;
        $this->watermarkRequired = $watermarkRequired;
        $this->updatedAt = new DateTimeImmutable();

        $this->recordThat(new VdrDocumentPermissionGranted(
            permissionId: $this->id,
            companyId: $this->companyId,
            documentId: $this->documentId,
            subject: $this->subject,
            permissionLevel: $this->permissionLevel,
            watermarkRequired: $this->watermarkRequired,
            occurredAt: $this->updatedAt
        ));
    }

    public function revoke(): void
    {
        $this->recordThat(new VdrDocumentPermissionRevoked(
            permissionId: $this->id,
            companyId: $this->companyId,
            documentId: $this->documentId,
            subject: $this->subject,
            occurredAt: new DateTimeImmutable()
        ));
    }

    public function id(): string
    {
        return $this->id->value();
    }

    public function permissionId(): VdrPermissionId
    {
        return $this->id;
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

    public function createdAt(): DateTimeImmutable
    {
        return $this->createdAt;
    }

    public function updatedAt(): ?DateTimeImmutable
    {
        return $this->updatedAt;
    }
}
