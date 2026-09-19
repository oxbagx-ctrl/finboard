<?php

declare(strict_types=1);

namespace App\Contexts\Finance\Infrastructure\Listeners;

use App\Contexts\Finance\Domain\Events\FinancialRecordCreated;
use App\Contexts\Finance\Domain\Model\FinancialAuditLog;
use App\Contexts\Finance\Domain\Repositories\FinancialAuditLogRepositoryInterface;
use App\Contexts\Finance\Domain\ValueObjects\AuditAction;

final class LogFinancialRecordCreatedListener
{
    public function __construct(
        private readonly FinancialAuditLogRepositoryInterface $auditLogRepository
    ) {
    }

    public function handle(FinancialRecordCreated $event): void
    {
        $userId = auth()->id() ?? request()?->user()?->id;
        $ip = request()?->ip();
        $userAgent = request()?->userAgent();

        $log = FinancialAuditLog::create(
            companyId: $event->companyId(),
            action: AuditAction::RECORD_CREATED,
            entityType: 'financial_record',
            entityId: $event->recordId()->value(),
            userId: $userId !== null ? (string) $userId : null,
            description: "Zaksięgowano rekord finansowy: {$event->amount()} {$event->currency()}",
            oldValues: null,
            newValues: $event->toPayload(),
            ipAddress: $ip,
            userAgent: $userAgent,
            createdAt: $event->occurredAt()
        );

        $this->auditLogRepository->save($log);
    }
}
