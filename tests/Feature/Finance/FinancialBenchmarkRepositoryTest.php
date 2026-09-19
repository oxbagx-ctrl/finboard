<?php

declare(strict_types=1);

namespace Tests\Feature\Finance;

use App\Contexts\Finance\Domain\Model\FinancialBenchmark;
use App\Contexts\Finance\Domain\Repositories\FinancialBenchmarkRepositoryInterface;
use App\Contexts\Finance\Domain\ValueObjects\BenchmarkMetricType;
use App\Contexts\Finance\Domain\ValueObjects\FinancialBenchmarkId;
use App\Models\Company;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Str;
use Tests\TestCase;

final class FinancialBenchmarkRepositoryTest extends TestCase
{
    use DatabaseTransactions;

    private FinancialBenchmarkRepositoryInterface $repository;
    private Company $company;
    private User $user;

    protected function setUp(): void
    {
        parent::setUp();

        $this->repository = $this->app->make(FinancialBenchmarkRepositoryInterface::class);

        $this->company = Company::create([
            'id' => (string) Str::uuid(),
            'name' => 'Benchmark Isolated Test Sp. z o.o.',
            'code' => 'BM_TEST_' . Str::random(5),
            'tax_id' => 'PL' . rand(1000000000, 9999999999),
        ]);

        $this->user = User::create([
            'id' => (string) Str::uuid(),
            'name' => 'Doradca Testowy',
            'email' => 'advisor_' . Str::random(6) . '@helvest.com',
            'password' => bcrypt('password123'),
            'role' => 'advisor',
            'company_id' => $this->company->id,
            'is_active' => true,
        ]);
    }

    public function test_can_save_and_retrieve_benchmark_by_id(): void
    {
        $benchmarkId = FinancialBenchmarkId::generate();
        $benchmark = FinancialBenchmark::create(
            id: $benchmarkId,
            companyId: $this->company->id,
            metricType: BenchmarkMetricType::CURRENT_RATIO,
            targetValue: 1.6,
            warningThreshold: 1.2,
            criticalThreshold: 1.0,
            higherIsBetter: true,
            description: 'Płynność bieżąca dla Acme',
            configuredBy: $this->user->id
        );

        $this->repository->save($benchmark);

        $retrieved = $this->repository->findById($benchmarkId);

        $this->assertNotNull($retrieved);
        $this->assertSame($benchmarkId->value(), $retrieved->id());
        $this->assertSame($this->company->id, $retrieved->companyId());
        $this->assertSame(BenchmarkMetricType::CURRENT_RATIO, $retrieved->metricType());
        $this->assertSame(1.6, $retrieved->targetValue());
        $this->assertSame(1.2, $retrieved->warningThreshold());
        $this->assertSame(1.0, $retrieved->criticalThreshold());
        $this->assertTrue($retrieved->higherIsBetter());
        $this->assertSame($this->user->id, $retrieved->updatedBy());
        $this->assertSame('Płynność bieżąca dla Acme', $retrieved->description());
    }

    public function test_can_find_benchmark_by_company_and_metric(): void
    {
        $benchmark = FinancialBenchmark::create(
            id: FinancialBenchmarkId::generate(),
            companyId: $this->company->id,
            metricType: BenchmarkMetricType::EBITDA_MARGIN,
            targetValue: 0.20,
            warningThreshold: 0.12,
            criticalThreshold: 0.05,
            higherIsBetter: true,
            description: 'Marża EBITDA'
        );

        $this->repository->save($benchmark);

        $found = $this->repository->findByCompanyAndMetric($this->company->id, BenchmarkMetricType::EBITDA_MARGIN);

        $this->assertNotNull($found);
        $this->assertSame($benchmark->id(), $found->id());
        $this->assertSame(0.20, $found->targetValue());

        // Non-existent metric returns null
        $notFound = $this->repository->findByCompanyAndMetric($this->company->id, BenchmarkMetricType::DEBT_TO_ASSETS);
        $this->assertNull($notFound);
    }

    public function test_can_find_all_benchmarks_for_company(): void
    {
        $b1 = FinancialBenchmark::create(
            id: FinancialBenchmarkId::generate(),
            companyId: $this->company->id,
            metricType: BenchmarkMetricType::QUICK_RATIO,
            targetValue: 1.0,
            warningThreshold: 0.8,
            higherIsBetter: true
        );

        $b2 = FinancialBenchmark::create(
            id: FinancialBenchmarkId::generate(),
            companyId: $this->company->id,
            metricType: BenchmarkMetricType::GROSS_MARGIN,
            targetValue: 0.35,
            warningThreshold: 0.25,
            higherIsBetter: true
        );

        $this->repository->saveMany([$b1, $b2]);

        $all = $this->repository->findAllByCompanyId($this->company->id);

        $this->assertCount(2, $all);

        $metricTypes = array_map(fn (FinancialBenchmark $b) => $b->metricType(), $all);
        $this->assertContains(BenchmarkMetricType::QUICK_RATIO, $metricTypes);
        $this->assertContains(BenchmarkMetricType::GROSS_MARGIN, $metricTypes);
    }

    public function test_updating_benchmark_persists_changes(): void
    {
        $benchmarkId = FinancialBenchmarkId::generate();
        $benchmark = FinancialBenchmark::createDefaultForMetric(
            id: $benchmarkId,
            companyId: $this->company->id,
            metricType: BenchmarkMetricType::OPERATING_MARGIN
        );

        $this->repository->save($benchmark);

        // Mutate thresholds
        $benchmark->updateThresholds(
            targetValue: 0.15,
            warningThreshold: 0.08,
            criticalThreshold: 0.02,
            description: 'Zaktualizowany cel operacyjny',
            updatedBy: $this->user->id
        );

        $this->repository->save($benchmark);

        $updated = $this->repository->findById($benchmarkId);
        $this->assertNotNull($updated);
        $this->assertSame(0.15, $updated->targetValue());
        $this->assertSame(0.08, $updated->warningThreshold());
        $this->assertSame('Zaktualizowany cel operacyjny', $updated->description());
        $this->assertSame($this->user->id, $updated->updatedBy());
    }

    public function test_can_delete_benchmark_by_id(): void
    {
        $benchmarkId = FinancialBenchmarkId::generate();
        $benchmark = FinancialBenchmark::createDefaultForMetric(
            id: $benchmarkId,
            companyId: $this->company->id,
            metricType: BenchmarkMetricType::NET_MARGIN
        );

        $this->repository->save($benchmark);
        $this->assertNotNull($this->repository->findById($benchmarkId));

        $this->repository->delete($benchmarkId);

        $this->assertNull($this->repository->findById($benchmarkId));
    }
}
