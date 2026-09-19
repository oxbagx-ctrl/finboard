<?php

declare(strict_types=1);

namespace App\Contexts\Finance\Domain\Model;

use App\Contexts\Finance\Domain\Events\FinancialBenchmarkConfigured;
use App\Contexts\Finance\Domain\ValueObjects\BenchmarkMetricType;
use App\Contexts\Finance\Domain\ValueObjects\BenchmarkStatus;
use App\Contexts\Finance\Domain\ValueObjects\FinancialBenchmarkId;
use App\Shared\Domain\AggregateRoot;
use DateTimeImmutable;
use InvalidArgumentException;

final class FinancialBenchmark extends AggregateRoot
{
    public function __construct(
        private readonly FinancialBenchmarkId $id,
        private readonly string $companyId,
        private BenchmarkMetricType $metricType,
        private float $targetValue,
        private float $warningThreshold,
        private ?float $criticalThreshold = null,
        private bool $higherIsBetter = true,
        private ?string $description = null,
        private ?string $updatedBy = null,
        private readonly DateTimeImmutable $createdAt = new DateTimeImmutable(),
        private ?DateTimeImmutable $updatedAt = null
    ) {
        if (trim($this->companyId) === '') {
            throw new InvalidArgumentException('FinancialBenchmark must be associated with a valid companyId.');
        }

        $this->validateThresholdOrdering(
            $this->targetValue,
            $this->warningThreshold,
            $this->criticalThreshold,
            $this->higherIsBetter
        );
    }

    public static function create(
        FinancialBenchmarkId $id,
        string $companyId,
        BenchmarkMetricType $metricType,
        float $targetValue,
        float $warningThreshold,
        ?float $criticalThreshold = null,
        ?bool $higherIsBetter = null,
        ?string $description = null,
        ?string $configuredBy = null
    ): self {
        $higherBetter = $higherIsBetter ?? $metricType->higherIsBetter();

        $benchmark = new self(
            id: $id,
            companyId: $companyId,
            metricType: $metricType,
            targetValue: $targetValue,
            warningThreshold: $warningThreshold,
            criticalThreshold: $criticalThreshold,
            higherIsBetter: $higherBetter,
            description: $description,
            updatedBy: $configuredBy,
            createdAt: new DateTimeImmutable(),
            updatedAt: new DateTimeImmutable()
        );

        $benchmark->recordThat(new FinancialBenchmarkConfigured(
            benchmarkId: $id,
            companyId: $companyId,
            metricType: $metricType,
            targetValue: $targetValue,
            warningThreshold: $warningThreshold,
            criticalThreshold: $criticalThreshold,
            higherIsBetter: $higherBetter,
            configuredBy: $configuredBy
        ));

        return $benchmark;
    }

    public static function createDefaultForMetric(
        FinancialBenchmarkId $id,
        string $companyId,
        BenchmarkMetricType $metricType,
        ?string $configuredBy = null
    ): self {
        return self::create(
            id: $id,
            companyId: $companyId,
            metricType: $metricType,
            targetValue: $metricType->defaultTarget(),
            warningThreshold: $metricType->defaultWarning(),
            criticalThreshold: $metricType->defaultCritical(),
            higherIsBetter: $metricType->higherIsBetter(),
            description: "Domyślny benchmark branżowy: {$metricType->label()}",
            configuredBy: $configuredBy
        );
    }

    /**
     * Evaluate actual metric value against benchmark thresholds.
     */
    public function evaluateStatus(?float $actualValue): BenchmarkStatus
    {
        if ($actualValue === null) {
            return BenchmarkStatus::UNKNOWN;
        }

        if ($this->higherIsBetter) {
            if ($actualValue >= $this->targetValue) {
                return BenchmarkStatus::OPTIMAL;
            }
            if ($actualValue >= $this->warningThreshold) {
                return BenchmarkStatus::WARNING;
            }
            return BenchmarkStatus::CRITICAL;
        }

        // Lower is better (e.g. debt-to-assets ratio)
        if ($actualValue <= $this->targetValue) {
            return BenchmarkStatus::OPTIMAL;
        }
        if ($actualValue <= $this->warningThreshold) {
            return BenchmarkStatus::WARNING;
        }
        return BenchmarkStatus::CRITICAL;
    }

    /**
     * Update benchmark thresholds and record domain event.
     */
    public function updateThresholds(
        float $targetValue,
        float $warningThreshold,
        ?float $criticalThreshold = null,
        ?string $description = null,
        ?string $updatedBy = null
    ): void {
        $this->validateThresholdOrdering(
            $targetValue,
            $warningThreshold,
            $criticalThreshold,
            $this->higherIsBetter
        );

        $this->targetValue = $targetValue;
        $this->warningThreshold = $warningThreshold;
        $this->criticalThreshold = $criticalThreshold;
        if ($description !== null) {
            $this->description = $description;
        }
        $this->updatedBy = $updatedBy;
        $this->updatedAt = new DateTimeImmutable();

        $this->recordThat(new FinancialBenchmarkConfigured(
            benchmarkId: $this->id,
            companyId: $this->companyId,
            metricType: $this->metricType,
            targetValue: $this->targetValue,
            warningThreshold: $this->warningThreshold,
            criticalThreshold: $this->criticalThreshold,
            higherIsBetter: $this->higherIsBetter,
            configuredBy: $updatedBy
        ));
    }

    private function validateThresholdOrdering(
        float $target,
        float $warning,
        ?float $critical,
        bool $higherIsBetter
    ): void {
        if ($higherIsBetter) {
            if ($target < $warning) {
                throw new InvalidArgumentException(
                    "Target value ({$target}) cannot be lower than warning threshold ({$warning}) when higher is better."
                );
            }
            if ($critical !== null && $warning < $critical) {
                throw new InvalidArgumentException(
                    "Warning threshold ({$warning}) cannot be lower than critical threshold ({$critical}) when higher is better."
                );
            }
        } else {
            if ($target > $warning) {
                throw new InvalidArgumentException(
                    "Target value ({$target}) cannot be higher than warning threshold ({$warning}) when lower is better."
                );
            }
            if ($critical !== null && $warning > $critical) {
                throw new InvalidArgumentException(
                    "Warning threshold ({$warning}) cannot be higher than critical threshold ({$critical}) when lower is better."
                );
            }
        }
    }

    public function id(): string
    {
        return $this->id->value();
    }

    public function benchmarkId(): FinancialBenchmarkId
    {
        return $this->id;
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

    public function description(): ?string
    {
        return $this->description;
    }

    public function updatedBy(): ?string
    {
        return $this->updatedBy;
    }

    public function createdAt(): DateTimeImmutable
    {
        return $this->createdAt;
    }

    public function updatedAt(): ?DateTimeImmutable
    {
        return $this->updatedAt;
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'id' => $this->id->value(),
            'company_id' => $this->companyId,
            'metric_type' => $this->metricType->value,
            'label' => $this->metricType->label(),
            'unit' => $this->metricType->unit(),
            'target_value' => $this->targetValue,
            'warning_threshold' => $this->warningThreshold,
            'critical_threshold' => $this->criticalThreshold,
            'higher_is_better' => $this->higherIsBetter,
            'description' => $this->description,
            'updated_by' => $this->updatedBy,
            'created_at' => $this->createdAt->format(DATE_ATOM),
            'updated_at' => $this->updatedAt?->format(DATE_ATOM),
        ];
    }
}
