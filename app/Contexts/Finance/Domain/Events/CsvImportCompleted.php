<?php

declare(strict_types=1);

namespace App\Contexts\Finance\Domain\Events;

use App\Shared\Domain\DomainEvent;
use DateTimeImmutable;

final class CsvImportCompleted implements DomainEvent
{
    private DateTimeImmutable $occurredAt;

    public function __construct(
        private readonly string $importId,
        private readonly string $companyId,
        private readonly int $importedRows,
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

    public function importedRows(): int
    {
        return $this->importedRows;
    }

    public function toPayload(): array
    {
        return [
            'import_id' => $this->importId,
            'company_id' => $this->companyId,
            'imported_rows' => $this->importedRows,
            'occurred_at' => $this->occurredAt->format(DateTimeImmutable::ATOM),
        ];
    }
}
