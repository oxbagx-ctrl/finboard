<?php

declare(strict_types=1);

namespace App\Contexts\Finance\Domain\Model;

use App\Contexts\Finance\Domain\ValueObjects\AuditAction;
use App\Contexts\Finance\Domain\ValueObjects\FinancialAuditLogId;
use App\Shared\Domain\Entity;
use DateTimeImmutable;
use InvalidArgumentException;

final class FinancialAuditLog extends Entity
{
    public function __construct(
        private readonly FinancialAuditLogId $id,
        private readonly string $companyId,
        private readonly ?string $userId,
        private readonly AuditAction $action,
        private readonly string $entityType,
        private readonly ?string $entityId = null,
        private readonly ?string $description = null,
        private readonly ?array $oldValues = null,
        private readonly ?array $newValues = null,
        private readonly ?string $ipAddress = null,
        private readonly ?string $userAgent = null,
        private readonly DateTimeImmutable $createdAt = new DateTimeImmutable()
    ) {
        if (trim($this->companyId) === '') {
            throw new InvalidArgumentException('FinancialAuditLog must be associated with a valid companyId.');
        }

        if (trim($this->entityType) === '') {
            throw new InvalidArgumentException('FinancialAuditLog entityType cannot be empty.');
        }
    }

    public static function create(
        string $companyId,
        AuditAction $action,
        string $entityType,
        ?string $entityId = null,
        ?string $userId = null,
        ?string $description = null,
        ?array $oldValues = null,
        ?array $newValues = null,
        ?string $ipAddress = null,
        ?string $userAgent = null,
        ?FinancialAuditLogId $id = null,
        ?DateTimeImmutable $createdAt = null
    ): self {
        return new self(
            id: $id ?? FinancialAuditLogId::generate(),
            companyId: $companyId,
            userId: $userId,
            action: $action,
            entityType: $entityType,
            entityId: $entityId,
            description: $description,
            oldValues: $oldValues,
            newValues: $newValues,
            ipAddress: $ipAddress,
            userAgent: $userAgent,
            createdAt: $createdAt ?? new DateTimeImmutable()
        );
    }

    public function id(): string
    {
        return $this->id->value();
    }

    public function auditLogId(): FinancialAuditLogId
    {
        return $this->id;
    }

    public function companyId(): string
    {
        return $this->companyId;
    }

    public function userId(): ?string
    {
        return $this->userId;
    }

    public function action(): AuditAction
    {
        return $this->action;
    }

    public function entityType(): string
    {
        return $this->entityType;
    }

    public function entityId(): ?string
    {
        return $this->entityId;
    }

    public function description(): ?string
    {
        return $this->description;
    }

    public function oldValues(): ?array
    {
        return $this->oldValues;
    }

    public function newValues(): ?array
    {
        return $this->newValues;
    }

    public function ipAddress(): ?string
    {
        return $this->ipAddress;
    }

    public function userAgent(): ?string
    {
        return $this->userAgent;
    }

    public function createdAt(): DateTimeImmutable
    {
        return $this->createdAt;
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'id' => $this->id->value(),
            'company_id' => $this->companyId,
            'user_id' => $this->userId,
            'action' => $this->action->value,
            'action_label' => $this->action->label(),
            'action_color' => $this->action->color(),
            'entity_type' => $this->entityType,
            'entity_id' => $this->entityId,
            'description' => $this->description,
            'old_values' => $this->oldValues,
            'new_values' => $this->newValues,
            'ip_address' => $this->ipAddress,
            'user_agent' => $this->userAgent,
            'created_at' => $this->createdAt->format(DATE_ATOM),
        ];
    }
}
