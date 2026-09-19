<?php

declare(strict_types=1);

namespace Tests\Unit\Finance;

use App\Contexts\Finance\Application\Services\KpiEvaluationService;
use App\Contexts\Finance\Domain\Model\FinancialBenchmark;
use App\Contexts\Finance\Domain\Repositories\FinancialBenchmarkRepositoryInterface;
use App\Contexts\Finance\Domain\ValueObjects\BenchmarkMetricType;
use App\Contexts\Finance\Domain\ValueObjects\BenchmarkStatus;
use App\Contexts\Finance\Domain\ValueObjects\Currency;
use App\Contexts\Finance\Domain\ValueObjects\FinancialBenchmarkId;
use App\Contexts\Finance\Domain\ValueObjects\FinancialMetrics;
use App\Contexts\Finance\Domain\ValueObjects\Money;
use PHPUnit\Framework\TestCase;

final class KpiEvaluationServiceTest extends TestCase
{
    private const COMPANY_ID = '11111111-1111-1111-1111-111111111111';

    private FinancialBenchmarkRepositoryInterface $repositoryMock;
    private KpiEvaluationService $service;

    protected function setUp(): void
    {
        parent::setUp();

        $this->repositoryMock = $this->createMock(FinancialBenchmarkRepositoryInterface::class);
        $this->service = new KpiEvaluationService($this->repositoryMock);
    }

    public function test_evaluate_metric_uses_defaults_when_no_benchmark_in_repository(): void
    {
        $this->repositoryMock
            ->expects($this->once())
            ->method('findByCompanyAndMetric')
            ->with(self::COMPANY_ID, BenchmarkMetricType::CURRENT_RATIO)
            ->willReturn(null);

        // Default Current Ratio: target 1.5, warning 1.2
        $result = $this->service->evaluateMetric(self::COMPANY_ID, BenchmarkMetricType::CURRENT_RATIO, 1.8);

        $this->assertSame(BenchmarkMetricType::CURRENT_RATIO->value, $result['metric_type']);
        $this->assertSame(1.8, $result['actual_value']);
        $this->assertSame(1.5, $result['target_value']);
        $this->assertSame(1.2, $result['warning_threshold']);
        $this->assertSame(BenchmarkStatus::OPTIMAL->value, $result['status']);
        $this->assertSame('Optymalny', $result['status_label']);
        $this->assertSame('emerald', $result['status_color']);
        $this->assertTrue($result['is_optimal']);
        $this->assertFalse($result['is_warning']);
        $this->assertFalse($result['is_critical']);
        $this->assertFalse($result['is_unknown']);
        $this->assertSame('x', $result['unit']);
    }

    public function test_evaluate_metric_uses_custom_configured_benchmark(): void
    {
        $customBenchmark = FinancialBenchmark::create(
            id: FinancialBenchmarkId::generate(),
            companyId: self::COMPANY_ID,
            metricType: BenchmarkMetricType::CURRENT_RATIO,
            targetValue: 2.0,
            warningThreshold: 1.5,
            criticalThreshold: 1.0,
            higherIsBetter: true,
            description: 'Bardzo rygorystyczny cel płynności'
        );

        $this->repositoryMock
            ->expects($this->once())
            ->method('findByCompanyAndMetric')
            ->with(self::COMPANY_ID, BenchmarkMetricType::CURRENT_RATIO)
            ->willReturn($customBenchmark);

        // 1.8 is under 2.0 target, but >= 1.5 warning => WARNING
        $result = $this->service->evaluateMetric(self::COMPANY_ID, BenchmarkMetricType::CURRENT_RATIO, 1.8);

        $this->assertSame(BenchmarkStatus::WARNING->value, $result['status']);
        $this->assertSame('Ostrzeżenie', $result['status_label']);
        $this->assertSame('amber', $result['status_color']);
        $this->assertTrue($result['is_warning']);
        $this->assertSame('Bardzo rygorystyczny cel płynności', $result['description']);
    }

    public function test_evaluate_metric_for_lower_is_better_debt_ratio(): void
    {
        // Debt to Assets: default target 0.50, warning 0.65, critical 0.80
        $this->repositoryMock
            ->method('findByCompanyAndMetric')
            ->willReturn(null);

        // Optimal <= 0.50
        $opt = $this->service->evaluateMetric(self::COMPANY_ID, BenchmarkMetricType::DEBT_TO_ASSETS, 0.42);
        $this->assertSame(BenchmarkStatus::OPTIMAL->value, $opt['status']);

        // Warning <= 0.65
        $warn = $this->service->evaluateMetric(self::COMPANY_ID, BenchmarkMetricType::DEBT_TO_ASSETS, 0.58);
        $this->assertSame(BenchmarkStatus::WARNING->value, $warn['status']);

        // Critical > 0.65
        $crit = $this->service->evaluateMetric(self::COMPANY_ID, BenchmarkMetricType::DEBT_TO_ASSETS, 0.72);
        $this->assertSame(BenchmarkStatus::CRITICAL->value, $crit['status']);

        // Null value => Unknown
        $unknown = $this->service->evaluateMetric(self::COMPANY_ID, BenchmarkMetricType::DEBT_TO_ASSETS, null);
        $this->assertSame(BenchmarkStatus::UNKNOWN->value, $unknown['status']);
        $this->assertTrue($unknown['is_unknown']);
    }

    public function test_evaluate_metrics_from_financial_metrics_object(): void
    {
        $this->repositoryMock
            ->method('findByCompanyAndMetric')
            ->willReturn(null);

        $c = Currency::PLN;
        $metrics = new FinancialMetrics(
            revenue: Money::fromDecimal('1000000', $c),
            cogs: Money::fromDecimal('600000', $c),
            grossProfit: Money::fromDecimal('400000', $c),
            grossMargin: 0.40, // Target 0.35 => OPT
            opex: Money::fromDecimal('150000', $c),
            depreciation: Money::fromDecimal('50000', $c),
            ebit: Money::fromDecimal('200000', $c),
            operatingMargin: 0.20, // Target 0.12 => OPT
            ebitda: Money::fromDecimal('250000', $c),
            ebitdaMargin: 0.25, // Target 0.18 => OPT
            financialCosts: Money::fromDecimal('20000', $c),
            tax: Money::fromDecimal('36000', $c),
            netProfit: Money::fromDecimal('144000', $c),
            netMargin: 0.144, // Target 0.08 => OPT
            currentAssets: Money::fromDecimal('300000', $c),
            inventory: Money::fromDecimal('100000', $c),
            quickAssets: Money::fromDecimal('200000', $c),
            currentLiabilities: Money::fromDecimal('150000', $c),
            currentRatio: 2.0, // Target 1.5 => OPT
            quickRatio: 1.33, // Target 1.0 => OPT
            period: null,
            totalAssets: Money::fromDecimal('1000000', $c),
            totalDebt: Money::fromDecimal('400000', $c),
            debtToAssets: 0.40 // Target 0.50 => OPT
        );

        $result = $this->service->evaluateMetrics(self::COMPANY_ID, $metrics, 15.5);

        $this->assertArrayHasKey('evaluations', $result);
        $this->assertArrayHasKey('summary', $result);

        $evaluations = $result['evaluations'];
        $this->assertCount(8, $evaluations);

        // All 8 metrics are OPT
        $this->assertSame(BenchmarkStatus::OPTIMAL->value, $evaluations[BenchmarkMetricType::CURRENT_RATIO->value]['status']);
        $this->assertSame(BenchmarkStatus::OPTIMAL->value, $evaluations[BenchmarkMetricType::QUICK_RATIO->value]['status']);
        $this->assertSame(BenchmarkStatus::OPTIMAL->value, $evaluations[BenchmarkMetricType::DEBT_TO_ASSETS->value]['status']);
        $this->assertSame(BenchmarkStatus::OPTIMAL->value, $evaluations[BenchmarkMetricType::GROSS_MARGIN->value]['status']);
        $this->assertSame(BenchmarkStatus::OPTIMAL->value, $evaluations[BenchmarkMetricType::EBITDA_MARGIN->value]['status']);
        $this->assertSame(BenchmarkStatus::OPTIMAL->value, $evaluations[BenchmarkMetricType::OPERATING_MARGIN->value]['status']);
        $this->assertSame(BenchmarkStatus::OPTIMAL->value, $evaluations[BenchmarkMetricType::NET_MARGIN->value]['status']);
        $this->assertSame(BenchmarkStatus::OPTIMAL->value, $evaluations[BenchmarkMetricType::REVENUE_GROWTH->value]['status']);

        $summary = $result['summary'];
        $this->assertSame(8, $summary['total_metrics']);
        $this->assertSame(8, $summary['evaluated_count']);
        $this->assertSame(8, $summary['optimal_count']);
        $this->assertSame(0, $summary['warning_count']);
        $this->assertSame(0, $summary['critical_count']);
        $this->assertSame(BenchmarkStatus::OPTIMAL->value, $summary['overall_status']);
        $this->assertSame(100.0, $summary['health_score']);
    }

    public function test_evaluate_kpi_payload_from_dynamics_array(): void
    {
        $this->repositoryMock
            ->method('findByCompanyAndMetric')
            ->willReturn(null);

        $kpiPayload = [
            'metrics' => [
                'current_ratio' => 1.3, // Warning (1.2 - 1.5)
                'quick_ratio' => 0.5, // Critical (< 0.6)
                'debt_to_assets' => 0.45, // Optimal (<= 0.5)
                'gross_margin' => 0.30, // Warning (0.25 - 0.35)
                'ebitda_margin' => 0.20, // Optimal (>= 0.18)
                'operating_margin' => 0.15, // Optimal (>= 0.12)
                'net_margin' => 0.09, // Optimal (>= 0.08)
            ],
            'dynamics' => [
                'yoy' => [
                    'revenue_growth_pct' => 12.5, // Optimal (>= 10.0)
                ],
            ],
        ];

        $result = $this->service->evaluateKpiPayload(self::COMPANY_ID, $kpiPayload);

        $evaluations = $result['evaluations'];
        $this->assertSame(BenchmarkStatus::WARNING->value, $evaluations[BenchmarkMetricType::CURRENT_RATIO->value]['status']);
        $this->assertSame(BenchmarkStatus::CRITICAL->value, $evaluations[BenchmarkMetricType::QUICK_RATIO->value]['status']);
        $this->assertSame(BenchmarkStatus::OPTIMAL->value, $evaluations[BenchmarkMetricType::DEBT_TO_ASSETS->value]['status']);
        $this->assertSame(BenchmarkStatus::WARNING->value, $evaluations[BenchmarkMetricType::GROSS_MARGIN->value]['status']);
        $this->assertSame(BenchmarkStatus::OPTIMAL->value, $evaluations[BenchmarkMetricType::EBITDA_MARGIN->value]['status']);
        $this->assertSame(BenchmarkStatus::OPTIMAL->value, $evaluations[BenchmarkMetricType::REVENUE_GROWTH->value]['status']);

        $summary = $result['summary'];
        $this->assertSame(5, $summary['optimal_count']);
        $this->assertSame(2, $summary['warning_count']);
        $this->assertSame(1, $summary['critical_count']);
        $this->assertSame(BenchmarkStatus::CRITICAL->value, $summary['overall_status']);
        $this->assertSame('Krytyczny', $summary['overall_status_label']);
        $this->assertSame('rose', $summary['overall_status_color']);
        // (5*100 + 2*50) / 800 * 100 = 600 / 8 = 75.0
        $this->assertSame(75.0, $summary['health_score']);
    }

    public function test_compute_summary_when_all_metrics_unknown(): void
    {
        $evaluations = [
            'M1' => ['status' => BenchmarkStatus::UNKNOWN->value],
            'M2' => ['status' => BenchmarkStatus::UNKNOWN->value],
        ];

        $summary = $this->service->computeSummary($evaluations);

        $this->assertSame(2, $summary['total_metrics']);
        $this->assertSame(0, $summary['evaluated_count']);
        $this->assertSame(2, $summary['unknown_count']);
        $this->assertSame(BenchmarkStatus::UNKNOWN->value, $summary['overall_status']);
        $this->assertNull($summary['health_score']);
    }

    public function test_compute_summary_warning_status(): void
    {
        $evaluations = [
            'M1' => ['status' => BenchmarkStatus::OPTIMAL->value],
            'M2' => ['status' => BenchmarkStatus::WARNING->value],
        ];

        $summary = $this->service->computeSummary($evaluations);

        $this->assertSame(1, $summary['optimal_count']);
        $this->assertSame(1, $summary['warning_count']);
        $this->assertSame(0, $summary['critical_count']);
        $this->assertSame(BenchmarkStatus::WARNING->value, $summary['overall_status']);
        $this->assertSame('amber', $summary['overall_status_color']);
        // (1*100 + 1*50) / 200 * 100 = 75.0
        $this->assertSame(75.0, $summary['health_score']);
    }
}
