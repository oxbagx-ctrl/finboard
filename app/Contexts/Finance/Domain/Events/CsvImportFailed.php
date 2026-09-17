<?php

declare(strict_types=1);

namespace App\Contexts\Finance\Domain\Events;

use App\Shared\Domain\DomainEvent;
use DateTimeImmutable;

final class CsvImportFailed implements DomainEvent
{
    private DateTimeImmutable $occurredAt;

    /**
     * @param array<int, mixed> $errors
     */
    public function __construct(
        private readonly string $importId,
        private readonly string $companyId,
        private readonly int $errorCount,
        private readonly array $errors,
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
        return $this->importId;
    }

    public function companyId(): string
    {
        return $this->companyId;
    }

    public function errorCount(): int
    {
        return $this->errorCount;
    }

    /**
     * @return array<int, mixed>
     */
    public function errors(): array
    {
        return $this->errors;
    }

    public function toPayload(): array
    {
        return [
            'import_id' => $this->importId,
            'company_id' => $this->companyId,
            'error_count' => $this->errorCount,
            'errors' => $this->errors,
            'occurred_at' => $this->occurredAt->format(DateTimeImmutable::ATOM),
        ];
    }
}
