<?php

declare(strict_types=1);

namespace App\Contexts\Finance\Infrastructure\Repositories;

use App\Contexts\Finance\Domain\Model\FinancialBenchmark;
use App\Contexts\Finance\Domain\Repositories\FinancialBenchmarkRepositoryInterface;
use App\Contexts\Finance\Domain\ValueObjects\BenchmarkMetricType;
use App\Contexts\Finance\Domain\ValueObjects\FinancialBenchmarkId;
use App\Models\FinancialBenchmark as EloquentFinancialBenchmark;
use DateTimeImmutable;
use Illuminate\Contracts\Events\Dispatcher;
use Illuminate\Support\Facades\DB;

final class EloquentFinancialBenchmarkRepository implements FinancialBenchmarkRepositoryInterface
{
    public function __construct(
        private readonly Dispatcher $dispatcher
    ) {
    }

    public function findById(FinancialBenchmarkId $id): ?FinancialBenchmark
    {
        /** @var EloquentFinancialBenchmark|null $eloquent */
        $eloquent = EloquentFinancialBenchmark::find($id->value());

        if ($eloquent === null) {
            return null;
        }

        return $this->toDomain($eloquent);
    }

    public function findByCompanyAndMetric(string $companyId, BenchmarkMetricType $metricType): ?FinancialBenchmark
    {
        /** @var EloquentFinancialBenchmark|null $eloquent */
        $eloquent = EloquentFinancialBenchmark::where('company_id', $companyId)
            ->where('metric_type', $metricType->value)
            ->first();

        if ($eloquent === null) {
            return null;
        }

        return $this->toDomain($eloquent);
    }

    /**
     * @return array<FinancialBenchmark>
     */
    public function findAllByCompanyId(string $companyId): array
    {
        return EloquentFinancialBenchmark::where('company_id', $companyId)
            ->orderBy('metric_type', 'asc')
            ->get()
            ->map(fn (EloquentFinancialBenchmark $model) => $this->toDomain($model))
            ->all();
    }

    public function save(FinancialBenchmark $benchmark): void
    {
        EloquentFinancialBenchmark::query()->updateOrCreate(
            [
                'company_id' => $benchmark->companyId(),
                'metric_type' => $benchmark->metricType()->value,
            ],
            [
                'id' => $benchmark->id(),
                'target_value' => $benchmark->targetValue(),
                'warning_threshold' => $benchmark->warningThreshold(),
                'critical_threshold' => $benchmark->criticalThreshold(),
                'higher_is_better' => $benchmark->higherIsBetter(),
                'description' => $benchmark->description(),
                'updated_by' => $benchmark->updatedBy(),
            ]
        );

        $this->dispatchDomainEvents($benchmark);
    }

    /**
     * @param array<FinancialBenchmark> $benchmarks
     */
    public function saveMany(array $benchmarks): void
    {
        if (empty($benchmarks)) {
            return;
        }

        DB::transaction(function () use ($benchmarks) {
            foreach ($benchmarks as $benchmark) {
                $this->save($benchmark);
            }
        });
    }

    public function delete(FinancialBenchmarkId $id): void
    {
        EloquentFinancialBenchmark::destroy($id->value());
    }

    public function deleteByCompanyId(string $companyId): int
    {
        return EloquentFinancialBenchmark::where('company_id', $companyId)->delete();
    }

    private function toDomain(EloquentFinancialBenchmark $eloquent): FinancialBenchmark
    {
        $metricType = BenchmarkMetricType::from($eloquent->metric_type);
        $createdAt = new DateTimeImmutable($eloquent->created_at?->format(DateTimeImmutable::ATOM) ?? 'now');
        $updatedAt = $eloquent->updated_at ? new DateTimeImmutable($eloquent->updated_at->format(DateTimeImmutable::ATOM)) : null;

        return new FinancialBenchmark(
            id: FinancialBenchmarkId::fromString($eloquent->id),
            companyId: $eloquent->company_id,
            metricType: $metricType,
            targetValue: (float) $eloquent->target_value,
            warningThreshold: (float) $eloquent->warning_threshold,
            criticalThreshold: $eloquent->critical_threshold !== null ? (float) $eloquent->critical_threshold : null,
            higherIsBetter: (bool) $eloquent->higher_is_better,
            description: $eloquent->description,
            updatedBy: $eloquent->updated_by,
            createdAt: $createdAt,
            updatedAt: $updatedAt
        );
    }

    private function dispatchDomainEvents(FinancialBenchmark $benchmark): void
    {
        foreach ($benchmark->releaseEvents() as $event) {
            $this->dispatcher->dispatch($event);
        }
    }
}
