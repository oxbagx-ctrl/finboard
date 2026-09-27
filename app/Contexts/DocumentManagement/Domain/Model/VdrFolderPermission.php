<?php

declare(strict_types=1);

namespace App\Contexts\DocumentManagement\Domain\Model;

use App\Contexts\DocumentManagement\Domain\Events\VdrFolderPermissionGranted;
use App\Contexts\DocumentManagement\Domain\Events\VdrFolderPermissionRevoked;
use App\Contexts\DocumentManagement\Domain\ValueObjects\AccessSubject;
use App\Contexts\DocumentManagement\Domain\ValueObjects\FolderId;
use App\Contexts\DocumentManagement\Domain\ValueObjects\PermissionLevel;
use App\Contexts\DocumentManagement\Domain\ValueObjects\VdrPermissionId;
use App\Shared\Domain\AggregateRoot;
use DateTimeImmutable;
use InvalidArgumentException;

final class VdrFolderPermission extends AggregateRoot
{
    public function __construct(
        private readonly VdrPermissionId $id,
        private readonly string $companyId,
        private readonly FolderId $folderId,
        private readonly AccessSubject $subject,
        private PermissionLevel $permissionLevel,
        private bool $watermarkRequired = false,
        private readonly DateTimeImmutable $createdAt = new DateTimeImmutable(),
        private ?DateTimeImmutable $updatedAt = null
    ) {
        if (trim($this->companyId) === '') {
            throw new InvalidArgumentException('Folder permission must be associated with a valid company.');
        }
    }

    public static function grant(
        VdrPermissionId $id,
        string $companyId,
        FolderId $folderId,
        AccessSubject $subject,
        PermissionLevel $permissionLevel,
        bool $watermarkRequired = false
    ): self {
        $permission = new self(
            id: $id,
            companyId: trim($companyId),
            folderId: $folderId,
            subject: $subject,
            permissionLevel: $permissionLevel,
            watermarkRequired: $watermarkRequired,
            createdAt: new DateTimeImmutable()
        );

        $permission->recordThat(new VdrFolderPermissionGranted(
            permissionId: $permission->id,
            companyId: $permission->companyId,
            folderId: $permission->folderId,
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

        $this->recordThat(new VdrFolderPermissionGranted(
            permissionId: $this->id,
            companyId: $this->companyId,
            folderId: $this->folderId,
            subject: $this->subject,
            permissionLevel: $this->permissionLevel,
            watermarkRequired: $this->watermarkRequired,
            occurredAt: $this->updatedAt
        ));
    }

    public function revoke(): void
    {
        $this->recordThat(new VdrFolderPermissionRevoked(
            permissionId: $this->id,
            companyId: $this->companyId,
            folderId: $this->folderId,
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

    public function folderId(): FolderId
    {
        return $this->folderId;
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
