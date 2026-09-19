<?php

declare(strict_types=1);

namespace App\Contexts\Finance\Infrastructure\Listeners;

use App\Contexts\Finance\Domain\Events\CsvImportCompleted;
use App\Contexts\Finance\Domain\Events\CsvImportFailed;
use App\Contexts\Finance\Domain\Model\FinancialAuditLog;
use App\Contexts\Finance\Domain\Repositories\FinancialAuditLogRepositoryInterface;
use App\Contexts\Finance\Domain\ValueObjects\AuditAction;

final class LogCsvImportAuditListener
{
    public function __construct(
        private readonly FinancialAuditLogRepositoryInterface $auditLogRepository
    ) {
    }

    public function handleImportCompleted(CsvImportCompleted $event): void
    {
        $log = FinancialAuditLog::create(
            companyId: $event->companyId(),
            action: AuditAction::CSV_IMPORT_PROCESSED,
            entityType: 'csv_import',
            entityId: $event->aggregateId(),
            userId: auth()->id() !== null ? (string) auth()->id() : null,
            description: "Zakończono import pliku CSV: pomyślnie zaimportowano {$event->importedRows()} wierszy",
            oldValues: null,
            newValues: $event->toPayload(),
            ipAddress: request()?->ip(),
            userAgent: request()?->userAgent(),
            createdAt: $event->occurredAt()
        );

        $this->auditLogRepository->save($log);
    }

    public function handleImportFailed(CsvImportFailed $event): void
    {
        $log = FinancialAuditLog::create(
            companyId: $event->companyId(),
            action: AuditAction::CSV_IMPORT_FAILED,
            entityType: 'csv_import',
            entityId: $event->aggregateId(),
            userId: auth()->id() !== null ? (string) auth()->id() : null,
            description: "Błąd przetwarzania importu CSV: napotkano {$event->errorCount()} błędów",
            oldValues: null,
            newValues: $event->toPayload(),
            ipAddress: request()?->ip(),
            userAgent: request()?->userAgent(),
            createdAt: $event->occurredAt()
        );

        $this->auditLogRepository->save($log);
    }
}
