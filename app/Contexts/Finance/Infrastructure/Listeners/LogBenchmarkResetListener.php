<?php

declare(strict_types=1);

namespace App\Contexts\Finance\Infrastructure\Listeners;

use App\Contexts\Finance\Domain\Events\FinancialBenchmarkReset;
use App\Contexts\Finance\Domain\Model\FinancialAuditLog;
use App\Contexts\Finance\Domain\Repositories\FinancialAuditLogRepositoryInterface;
use App\Contexts\Finance\Domain\ValueObjects\AuditAction;

final class LogBenchmarkResetListener
{
    public function __construct(
        private readonly FinancialAuditLogRepositoryInterface $auditLogRepository
    ) {
    }

    public function handle(FinancialBenchmarkReset $event): void
    {
        $userId = $event->resetBy() ?? auth()->id() ?? request()?->user()?->id;
        $ip = request()?->ip();
        $userAgent = request()?->userAgent();

        $desc = $event->metricType() !== null
            ? "Zresetowano cele wskaźnika {$event->metricType()->label()} do domyślnych standardów rynkowych"
            : "Zresetowano wszystkie cele wskaźników do domyślnych standardów rynkowych";

        $log = FinancialAuditLog::create(
            companyId: $event->companyId(),
            action: AuditAction::BENCHMARK_RESET,
            entityType: 'financial_benchmark',
            entityId: $event->metricType()?->value,
            userId: $userId !== null ? (string) $userId : null,
            description: $desc,
            oldValues: null,
            newValues: [
                'metric_type' => $event->metricType()?->value,
                'reset_to' => 'market_defaults',
            ],
            ipAddress: $ip,
            userAgent: $userAgent,
            createdAt: $event->occurredAt()
        );

        $this->auditLogRepository->save($log);
    }
}
