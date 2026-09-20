<?php

declare(strict_types=1);

namespace App\Contexts\Finance\Infrastructure\Listeners;

use App\Contexts\Finance\Domain\Events\FinancialRecordsBatchDeleted;
use App\Contexts\Finance\Domain\Model\FinancialAuditLog;
use App\Contexts\Finance\Domain\Repositories\FinancialAuditLogRepositoryInterface;
use App\Contexts\Finance\Domain\ValueObjects\AuditAction;

final class LogFinancialRecordsBatchDeletedListener
{
    public function __construct(
        private readonly FinancialAuditLogRepositoryInterface $auditLogRepository
    ) {
    }

    public function handle(FinancialRecordsBatchDeleted $event): void
    {
        $userId = $event->userId() ?? auth()->id() ?? request()?->user()?->id;
        $ip = $event->ipAddress() ?? request()?->ip();
        $userAgent = request()?->userAgent();

        $log = FinancialAuditLog::create(
            companyId: $event->companyId(),
            action: AuditAction::RECORDS_BATCH_DELETED,
            entityType: 'financial_record',
            entityId: null,
            userId: $userId !== null ? (string) $userId : null,
            description: sprintf(
                'Masowo usunięto %d operacji finansowych na łączną kwotę %s PLN',
                $event->deletedCount(),
                number_format($event->totalAmount(), 2, '.', ' ')
            ),
            oldValues: [
                'count' => $event->deletedCount(),
                'total_amount' => $event->totalAmount(),
                'record_ids' => $event->recordIds(),
            ],
            newValues: null,
            ipAddress: $ip,
            userAgent: $userAgent,
            createdAt: $event->occurredAt()
        );

        $this->auditLogRepository->save($log);
    }
}
