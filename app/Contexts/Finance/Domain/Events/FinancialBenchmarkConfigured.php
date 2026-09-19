<?php

declare(strict_types=1);

namespace App\Contexts\Finance\Domain\Events;

use App\Contexts\Finance\Domain\ValueObjects\BenchmarkMetricType;
use App\Contexts\Finance\Domain\ValueObjects\FinancialBenchmarkId;
use App\Shared\Domain\DomainEvent;
use DateTimeImmutable;

final class FinancialBenchmarkConfigured implements DomainEvent
{
    private DateTimeImmutable $occurredAt;

    public function __construct(
        private readonly FinancialBenchmarkId $benchmarkId,
        private readonly string $companyId,
        private readonly BenchmarkMetricType $metricType,
        private readonly float $targetValue,
        private readonly float $warningThreshold,
        private readonly ?float $criticalThreshold,
        private readonly bool $higherIsBetter,
        private readonly ?string $configuredBy = null,
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
        return $this->benchmarkId->value();
    }

    public function companyId(): string
    {
        return $this->companyId;
    }

    public function metricType(): BenchmarkMetricType
    {
        return $this->metricType;
    }

    public function targetValue(): float
    {
        return $this->targetValue;
    }

    public function warningThreshold(): float
    {
        return $this->warningThreshold;
    }

    public function criticalThreshold(): ?float
    {
        return $this->criticalThreshold;
    }

    public function higherIsBetter(): bool
    {
        return $this->higherIsBetter;
    }

    public function configuredBy(): ?string
    {
        return $this->configuredBy;
    }

    /**
     * @return array<string, mixed>
     */
    public function toPayload(): array
    {
        return [
            'benchmark_id' => $this->benchmarkId->value(),
            'company_id' => $this->companyId,
            'metric_type' => $this->metricType->value,
            'target_value' => $this->targetValue,
            'warning_threshold' => $this->warningThreshold,
            'critical_threshold' => $this->criticalThreshold,
            'higher_is_better' => $this->higherIsBetter,
            'configured_by' => $this->configuredBy,
            'occurred_at' => $this->occurredAt->format(DATE_ATOM),
        ];
    }
}
