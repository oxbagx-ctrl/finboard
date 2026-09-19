<?php

declare(strict_types=1);

namespace App\Contexts\Finance\Domain\Repositories;

use App\Contexts\Finance\Domain\Model\FinancialBenchmark;
use App\Contexts\Finance\Domain\ValueObjects\BenchmarkMetricType;
use App\Contexts\Finance\Domain\ValueObjects\FinancialBenchmarkId;

interface FinancialBenchmarkRepositoryInterface
{
    public function findById(FinancialBenchmarkId $id): ?FinancialBenchmark;

    public function findByCompanyAndMetric(string $companyId, BenchmarkMetricType $metricType): ?FinancialBenchmark;

    /**
     * @return array<FinancialBenchmark>
     */
    public function findAllByCompanyId(string $companyId): array;

    public function save(FinancialBenchmark $benchmark): void;

    /**
     * @param array<FinancialBenchmark> $benchmarks
     */
    public function saveMany(array $benchmarks): void;

    public function delete(FinancialBenchmarkId $id): void;

    public function deleteByCompanyId(string $companyId): int;
}
