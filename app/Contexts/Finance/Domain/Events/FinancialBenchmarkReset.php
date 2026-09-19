<?php

declare(strict_types=1);

namespace App\Contexts\Finance\Domain\Events;

use App\Contexts\Finance\Domain\ValueObjects\BenchmarkMetricType;
use App\Shared\Domain\DomainEvent;
use DateTimeImmutable;

final class FinancialBenchmarkReset implements DomainEvent
{
    private DateTimeImmutable $occurredAt;

    public function __construct(
        private readonly string $companyId,
        private readonly ?BenchmarkMetricType $metricType = null,
        private readonly ?string $resetBy = null,
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
        return $this->companyId;
    }

    public function companyId(): string
    {
        return $this->companyId;
    }

    public function metricType(): ?BenchmarkMetricType
    {
        return $this->metricType;
    }

    public function resetBy(): ?string
    {
        return $this->resetBy;
    }

    public function toPayload(): array
    {
        return [
            'company_id' => $this->companyId,
            'metric_type' => $this->metricType?->value,
            'reset_by' => $this->resetBy,
            'occurred_at' => $this->occurredAt->format(DateTimeImmutable::ATOM),
        ];
    }
}
