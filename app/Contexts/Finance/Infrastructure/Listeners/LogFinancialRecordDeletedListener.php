<?php

declare(strict_types=1);

namespace App\Contexts\Finance\Infrastructure\Listeners;

use App\Contexts\Finance\Domain\Events\FinancialRecordDeleted;
use App\Contexts\Finance\Domain\Model\FinancialAuditLog;
use App\Contexts\Finance\Domain\Repositories\FinancialAuditLogRepositoryInterface;
use App\Contexts\Finance\Domain\ValueObjects\AuditAction;

final class LogFinancialRecordDeletedListener
{
    public function __construct(
        private readonly FinancialAuditLogRepositoryInterface $auditLogRepository
    ) {
    }

    public function handle(FinancialRecordDeleted $event): void
    {
        $userId = $event->deletedBy() ?? auth()->id() ?? request()?->user()?->id;
        $ip = request()?->ip();
        $userAgent = request()?->userAgent();

        $log = FinancialAuditLog::create(
            companyId: $event->companyId(),
            action: AuditAction::RECORD_DELETED,
            entityType: 'financial_record',
            entityId: $event->recordId()->value(),
            userId: $userId !== null ? (string) $userId : null,
            description: "Usunięto rekord finansowy",
            oldValues: $event->payload(),
            newValues: null,
            ipAddress: $ip,
            userAgent: $userAgent,
            createdAt: $event->occurredAt()
        );

        $this->auditLogRepository->save($log);
    }
}
