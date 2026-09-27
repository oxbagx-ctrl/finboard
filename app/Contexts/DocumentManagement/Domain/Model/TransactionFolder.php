<?php

declare(strict_types=1);

namespace App\Contexts\DocumentManagement\Domain\Model;

use App\Contexts\DocumentManagement\Domain\Events\TransactionFolderCreated;
use App\Contexts\DocumentManagement\Domain\Events\TransactionFolderDeleted;
use App\Contexts\DocumentManagement\Domain\Events\TransactionFolderUpdated;
use App\Contexts\DocumentManagement\Domain\ValueObjects\DeweyIndexCode;
use App\Contexts\DocumentManagement\Domain\ValueObjects\FolderId;
use App\Shared\Domain\AggregateRoot;
use DateTimeImmutable;
use InvalidArgumentException;

final class TransactionFolder extends AggregateRoot
{
    public function __construct(
        private readonly FolderId $id,
        private readonly string $companyId,
        private DeweyIndexCode $indexCode,
        private string $name,
        private ?FolderId $parentId = null,
        private ?string $description = null,
        private int $sortOrder = 0,
        private readonly DateTimeImmutable $createdAt = new DateTimeImmutable(),
        private ?DateTimeImmutable $updatedAt = null
    ) {
        if (trim($this->name) === '') {
            throw new InvalidArgumentException('Folder name cannot be empty.');
        }

        if (trim($this->companyId) === '') {
            throw new InvalidArgumentException('Folder must be associated with a valid company.');
        }
    }

    public static function create(
        FolderId $id,
        string $companyId,
        DeweyIndexCode $indexCode,
        string $name,
        ?FolderId $parentId = null,
        ?string $description = null,
        int $sortOrder = 0
    ): self {
        $folder = new self(
            id: $id,
            companyId: trim($companyId),
            indexCode: $indexCode,
            name: trim($name),
            parentId: $parentId,
            description: $description !== null ? trim($description) : null,
            sortOrder: $sortOrder,
            createdAt: new DateTimeImmutable()
        );

        $folder->recordThat(new TransactionFolderCreated(
            folderId: $folder->id,
            companyId: $folder->companyId,
            indexCode: $folder->indexCode,
            name: $folder->name,
            parentId: $folder->parentId,
            occurredAt: $folder->createdAt
        ));

        return $folder;
    }

    public function id(): string
    {
        return $this->id->value();
    }

    public function folderId(): FolderId
    {
        return $this->id;
    }

    public function companyId(): string
    {
        return $this->companyId;
    }

    public function parentId(): ?FolderId
    {
        return $this->parentId;
    }

    public function indexCode(): DeweyIndexCode
    {
        return $this->indexCode;
    }

    public function name(): string
    {
        return $this->name;
    }

    public function description(): ?string
    {
        return $this->description;
    }

    public function sortOrder(): int
    {
        return $this->sortOrder;
    }

    public function createdAt(): DateTimeImmutable
    {
        return $this->createdAt;
    }

    public function updatedAt(): ?DateTimeImmutable
    {
        return $this->updatedAt;
    }

    public function rename(string $newName): void
    {
        $trimmed = trim($newName);
        if ($trimmed === '') {
            throw new InvalidArgumentException('Folder name cannot be empty.');
        }

        if ($this->name === $trimmed) {
            return;
        }

        $this->name = $trimmed;
        $this->touch();
    }

    public function updateIndexCode(DeweyIndexCode $newCode): void
    {
        if ($this->indexCode->equals($newCode)) {
            return;
        }

        $this->indexCode = $newCode;
        $this->touch();
    }

    public function moveToParent(?FolderId $newParentId): void
    {
        if ($newParentId !== null && $this->id->equals($newParentId)) {
            throw new InvalidArgumentException('Folder cannot be its own parent.');
        }

        if ($this->parentId !== null && $newParentId !== null && $this->parentId->equals($newParentId)) {
            return;
        }

        if ($this->parentId === null && $newParentId === null) {
            return;
        }

        $this->parentId = $newParentId;
        $this->touch();
    }

    public function updateDescription(?string $description): void
    {
        $trimmed = $description !== null ? trim($description) : null;
        if ($this->description === $trimmed) {
            return;
        }

        $this->description = $trimmed;
        $this->touch();
    }

    public function updateSortOrder(int $sortOrder): void
    {
        if ($this->sortOrder === $sortOrder) {
            return;
        }

        $this->sortOrder = $sortOrder;
        $this->touch();
    }

    public function updateDetails(?string $name = null, ?string $description = null, ?int $sortOrder = null): void
    {
        if ($name !== null) {
            $this->rename($name);
        }
        if ($description !== null) {
            $this->updateDescription($description);
        }
        if ($sortOrder !== null) {
            $this->updateSortOrder($sortOrder);
        }
    }

    public function markDeleted(): void
    {
        $this->recordThat(new TransactionFolderDeleted(
            folderId: $this->id,
            companyId: $this->companyId,
            occurredAt: new DateTimeImmutable()
        ));
    }

    private function touch(): void
    {
        $this->updatedAt = new DateTimeImmutable();
        $this->recordThat(new TransactionFolderUpdated(
            folderId: $this->id,
            companyId: $this->companyId,
            indexCode: $this->indexCode,
            name: $this->name,
            parentId: $this->parentId,
            occurredAt: $this->updatedAt
        ));
    }
}
