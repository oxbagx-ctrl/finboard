<?php

declare(strict_types=1);

namespace Tests\Unit\Finance;

use App\Contexts\Finance\Domain\Events\FinancialBenchmarkConfigured;
use App\Contexts\Finance\Domain\Model\FinancialBenchmark;
use App\Contexts\Finance\Domain\ValueObjects\BenchmarkMetricType;
use App\Contexts\Finance\Domain\ValueObjects\BenchmarkStatus;
use App\Contexts\Finance\Domain\ValueObjects\FinancialBenchmarkId;
use InvalidArgumentException;
use PHPUnit\Framework\TestCase;

final class FinancialBenchmarkTest extends TestCase
{
    private string $companyId = 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';

    public function test_create_default_for_metric_initializes_with_industry_standards(): void
    {
        $benchmarkId = FinancialBenchmarkId::generate();
        $benchmark = FinancialBenchmark::createDefaultForMetric(
            id: $benchmarkId,
            companyId: $this->companyId,
            metricType: BenchmarkMetricType::CURRENT_RATIO,
            configuredBy: 'advisor-123'
        );

        $this->assertSame($benchmarkId->value(), $benchmark->id());
        $this->assertSame($this->companyId, $benchmark->companyId());
        $this->assertSame(BenchmarkMetricType::CURRENT_RATIO, $benchmark->metricType());
        $this->assertSame(1.5, $benchmark->targetValue());
        $this->assertSame(1.2, $benchmark->warningThreshold());
        $this->assertSame(1.0, $benchmark->criticalThreshold());
        $this->assertTrue($benchmark->higherIsBetter());
        $this->assertSame('advisor-123', $benchmark->updatedBy());

        $events = $benchmark->releaseEvents();
        $this->assertCount(1, $events);
        $this->assertInstanceOf(FinancialBenchmarkConfigured::class, $events[0]);
    }

    public function test_evaluate_status_for_higher_is_better_metric(): void
    {
        $benchmark = FinancialBenchmark::create(
            id: FinancialBenchmarkId::generate(),
            companyId: $this->companyId,
            metricType: BenchmarkMetricType::CURRENT_RATIO,
            targetValue: 1.50,
            warningThreshold: 1.20,
            criticalThreshold: 1.00,
            higherIsBetter: true
        );

        $this->assertSame(BenchmarkStatus::OPTIMAL, $benchmark->evaluateStatus(1.65));
        $this->assertSame(BenchmarkStatus::OPTIMAL, $benchmark->evaluateStatus(1.50));
        $this->assertSame(BenchmarkStatus::WARNING, $benchmark->evaluateStatus(1.35));
        $this->assertSame(BenchmarkStatus::WARNING, $benchmark->evaluateStatus(1.20));
        $this->assertSame(BenchmarkStatus::CRITICAL, $benchmark->evaluateStatus(1.19));
        $this->assertSame(BenchmarkStatus::CRITICAL, $benchmark->evaluateStatus(0.85));
        $this->assertSame(BenchmarkStatus::UNKNOWN, $benchmark->evaluateStatus(null));
    }

    public function test_evaluate_status_for_lower_is_better_metric(): void
    {
        $benchmark = FinancialBenchmark::create(
            id: FinancialBenchmarkId::generate(),
            companyId: $this->companyId,
            metricType: BenchmarkMetricType::DEBT_TO_ASSETS,
            targetValue: 0.50,
            warningThreshold: 0.65,
            criticalThreshold: 0.80,
            higherIsBetter: false
        );

        $this->assertFalse($benchmark->higherIsBetter());
        $this->assertSame(BenchmarkStatus::OPTIMAL, $benchmark->evaluateStatus(0.40));
        $this->assertSame(BenchmarkStatus::OPTIMAL, $benchmark->evaluateStatus(0.50));
        $this->assertSame(BenchmarkStatus::WARNING, $benchmark->evaluateStatus(0.58));
        $this->assertSame(BenchmarkStatus::WARNING, $benchmark->evaluateStatus(0.65));
        $this->assertSame(BenchmarkStatus::CRITICAL, $benchmark->evaluateStatus(0.66));
        $this->assertSame(BenchmarkStatus::CRITICAL, $benchmark->evaluateStatus(0.92));
        $this->assertSame(BenchmarkStatus::UNKNOWN, $benchmark->evaluateStatus(null));
    }

    public function test_invalid_threshold_ordering_higher_is_better_throws_exception(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('Target value (1.1) cannot be lower than warning threshold (1.3) when higher is better.');

        FinancialBenchmark::create(
            id: FinancialBenchmarkId::generate(),
            companyId: $this->companyId,
            metricType: BenchmarkMetricType::CURRENT_RATIO,
            targetValue: 1.10,
            warningThreshold: 1.30,
            higherIsBetter: true
        );
    }

    public function test_invalid_threshold_ordering_lower_is_better_throws_exception(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('Target value (0.7) cannot be higher than warning threshold (0.5) when lower is better.');

        FinancialBenchmark::create(
            id: FinancialBenchmarkId::generate(),
            companyId: $this->companyId,
            metricType: BenchmarkMetricType::DEBT_TO_ASSETS,
            targetValue: 0.70,
            warningThreshold: 0.50,
            higherIsBetter: false
        );
    }

    public function test_update_thresholds_mutates_state_and_dispatches_event(): void
    {
        $benchmark = FinancialBenchmark::createDefaultForMetric(
            id: FinancialBenchmarkId::generate(),
            companyId: $this->companyId,
            metricType: BenchmarkMetricType::EBITDA_MARGIN
        );

        $benchmark->releaseEvents(); // Clear creation event

        $benchmark->updateThresholds(
            targetValue: 0.22,
            warningThreshold: 0.15,
            criticalThreshold: 0.08,
            description: 'Nowe cele funduszu PE dla marży EBITDA',
            updatedBy: 'advisor-999'
        );

        $this->assertSame(0.22, $benchmark->targetValue());
        $this->assertSame(0.15, $benchmark->warningThreshold());
        $this->assertSame(0.08, $benchmark->criticalThreshold());
        $this->assertSame('Nowe cele funduszu PE dla marży EBITDA', $benchmark->description());
        $this->assertSame('advisor-999', $benchmark->updatedBy());
        $this->assertNotNull($benchmark->updatedAt());

        $events = $benchmark->releaseEvents();
        $this->assertCount(1, $events);
        $this->assertInstanceOf(FinancialBenchmarkConfigured::class, $events[0]);
    }

    public function test_benchmark_serialization_to_array(): void
    {
        $benchmark = FinancialBenchmark::create(
            id: FinancialBenchmarkId::generate(),
            companyId: $this->companyId,
            metricType: BenchmarkMetricType::QUICK_RATIO,
            targetValue: 1.0,
            warningThreshold: 0.8,
            criticalThreshold: 0.6,
            higherIsBetter: true,
            description: 'Norma płynności szybkiej dla spółki handlowej'
        );

        $array = $benchmark->toArray();

        $this->assertSame($this->companyId, $array['company_id']);
        $this->assertSame('QUICK_RATIO', $array['metric_type']);
        $this->assertSame('x', $array['unit']);
        $this->assertSame(1.0, $array['target_value']);
        $this->assertSame(0.8, $array['warning_threshold']);
        $this->assertSame(0.6, $array['critical_threshold']);
        $this->assertTrue($array['higher_is_better']);
        $this->assertSame('Norma płynności szybkiej dla spółki handlowej', $array['description']);
    }

    public function test_benchmark_status_enum_helpers(): void
    {
        $this->assertTrue(BenchmarkStatus::OPTIMAL->isOptimal());
        $this->assertFalse(BenchmarkStatus::OPTIMAL->isWarning());
        $this->assertTrue(BenchmarkStatus::WARNING->isWarning());
        $this->assertTrue(BenchmarkStatus::CRITICAL->isCritical());
        $this->assertTrue(BenchmarkStatus::UNKNOWN->isUnknown());

        $this->assertSame('Optymalny', BenchmarkStatus::OPTIMAL->label());
        $this->assertSame('emerald', BenchmarkStatus::OPTIMAL->color());
        $this->assertSame('amber', BenchmarkStatus::WARNING->color());
        $this->assertSame('rose', BenchmarkStatus::CRITICAL->color());
    }
}
