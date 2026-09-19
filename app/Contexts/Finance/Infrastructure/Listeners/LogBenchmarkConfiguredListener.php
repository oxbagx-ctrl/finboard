<?php

declare(strict_types=1);

namespace App\Contexts\Finance\Infrastructure\Listeners;

use App\Contexts\Finance\Domain\Events\FinancialBenchmarkConfigured;
use App\Contexts\Finance\Domain\Model\FinancialAuditLog;
use App\Contexts\Finance\Domain\Repositories\FinancialAuditLogRepositoryInterface;
use App\Contexts\Finance\Domain\ValueObjects\AuditAction;

final class LogBenchmarkConfiguredListener
{
    public function __construct(
        private readonly FinancialAuditLogRepositoryInterface $auditLogRepository
    ) {
    }

    public function handle(FinancialBenchmarkConfigured $event): void
    {
        $userId = $event->configuredBy() ?? auth()->id() ?? request()?->user()?->id;
        $ip = request()?->ip();
        $userAgent = request()?->userAgent();

        $log = FinancialAuditLog::create(
            companyId: $event->companyId(),
            action: AuditAction::BENCHMARK_CONFIGURED,
            entityType: 'financial_benchmark',
            entityId: $event->aggregateId(),
            userId: $userId !== null ? (string) $userId : null,
            description: "Skonfigurowano cel wskaźnika {$event->metricType()->label()}: cel={$event->targetValue()}, ostrzeżenie={$event->warningThreshold()}",
            oldValues: null,
            newValues: [
                'metric_type' => $event->metricType()->value,
                'target_value' => $event->targetValue(),
                'warning_threshold' => $event->warningThreshold(),
                'critical_threshold' => $event->criticalThreshold(),
                'higher_is_better' => $event->higherIsBetter(),
            ],
            ipAddress: $ip,
            userAgent: $userAgent,
            createdAt: $event->occurredAt()
        );

        $this->auditLogRepository->save($log);
    }
}
