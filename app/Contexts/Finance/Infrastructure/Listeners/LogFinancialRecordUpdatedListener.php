<?php

declare(strict_types=1);

namespace App\Contexts\Finance\Infrastructure\Listeners;

use App\Contexts\Finance\Domain\Events\FinancialRecordUpdated;
use App\Contexts\Finance\Domain\Model\FinancialAuditLog;
use App\Contexts\Finance\Domain\Repositories\FinancialAuditLogRepositoryInterface;
use App\Contexts\Finance\Domain\ValueObjects\AuditAction;
use App\Models\FinancialRecord as EloquentFinancialRecord;

final class LogFinancialRecordUpdatedListener
{
    public function __construct(
        private readonly FinancialAuditLogRepositoryInterface $auditLogRepository
    ) {
    }

    public function handle(FinancialRecordUpdated $event): void
    {
        $userId = auth()->id() ?? request()?->user()?->id;
        $ip = request()?->ip();
        $userAgent = request()?->userAgent();

        $companyId = $event->companyId();
        if ($companyId === null) {
            $eloquent = EloquentFinancialRecord::find($event->recordId()->value());
            $companyId = $eloquent?->company_id;
        }

        if ($companyId === null || trim($companyId) === '') {
            return;
        }

        $log = FinancialAuditLog::create(
            companyId: $companyId,
            action: AuditAction::RECORD_UPDATED,
            entityType: 'financial_record',
            entityId: $event->recordId()->value(),
            userId: $userId !== null ? (string) $userId : null,
            description: "Zaktualizowano kwotę rekordu z {$event->previousAmount()} na {$event->newAmount()} {$event->currency()}",
            oldValues: [
                'amount' => $event->previousAmount(),
                'currency' => $event->currency(),
            ],
            newValues: [
                'amount' => $event->newAmount(),
                'currency' => $event->currency(),
            ],
            ipAddress: $ip,
            userAgent: $userAgent,
            createdAt: $event->occurredAt()
        );

        $this->auditLogRepository->save($log);
    }
}
