<?php

declare(strict_types=1);

namespace App\Contexts\Finance\Application\Services;

use App\Contexts\Finance\Domain\Model\FinancialBenchmark;
use App\Contexts\Finance\Domain\Repositories\FinancialBenchmarkRepositoryInterface;
use App\Contexts\Finance\Domain\ValueObjects\BenchmarkMetricType;
use App\Contexts\Finance\Domain\ValueObjects\BenchmarkStatus;
use App\Contexts\Finance\Domain\ValueObjects\FinancialBenchmarkId;
use App\Contexts\Finance\Domain\ValueObjects\FinancialMetrics;

final class KpiEvaluationService
{
    public function __construct(
        private readonly FinancialBenchmarkRepositoryInterface $benchmarkRepository
    ) {
    }

    /**
     * Evaluate a single metric for a company against its configured or default benchmark.
     *
     * @return array{
     *     metric_type: string,
     *     label: string,
     *     actual_value: ?float,
     *     target_value: float,
     *     warning_threshold: float,
     *     critical_threshold: ?float,
     *     higher_is_better: bool,
     *     status: string,
     *     status_label: string,
     *     status_color: string,
     *     unit: string,
     *     is_optimal: bool,
     *     is_warning: bool,
     *     is_critical: bool,
     *     is_unknown: bool,
     *     has_data: bool,
     *     description: ?string
     * }
     */
    public function evaluateMetric(
        string $companyId,
        BenchmarkMetricType $metricType,
        ?float $actualValue
    ): array {
        $benchmark = $this->benchmarkRepository->findByCompanyAndMetric($companyId, $metricType);

        if ($benchmark === null) {
            $benchmark = FinancialBenchmark::createDefaultForMetric(
                id: FinancialBenchmarkId::generate(),
                companyId: $companyId,
                metricType: $metricType
            );
        }

        // Treat 0.0 for liquidity ratios as missing data to avoid false alerts when balance sheet is empty
        $isLiquidityRatio = ($metricType === BenchmarkMetricType::CURRENT_RATIO || $metricType === BenchmarkMetricType::QUICK_RATIO);
        $effectiveValue = ($actualValue === 0.0 && $isLiquidityRatio) ? null : $actualValue;

        $status = $benchmark->evaluateStatus($effectiveValue);

        return [
            'metric_type' => $metricType->value,
            'label' => $metricType->label(),
            'actual_value' => $effectiveValue !== null ? round($effectiveValue, 4) : null,
            'target_value' => $benchmark->targetValue(),
            'warning_threshold' => $benchmark->warningThreshold(),
            'critical_threshold' => $benchmark->criticalThreshold(),
            'higher_is_better' => $benchmark->higherIsBetter(),
            'status' => $status->value,
            'status_label' => $status->label(),
            'status_color' => $status->color(),
            'unit' => $metricType->unit(),
            'is_optimal' => $status->isOptimal(),
            'is_warning' => $status->isWarning(),
            'is_critical' => $status->isCritical(),
            'is_unknown' => $status->isUnknown(),
            'has_data' => $effectiveValue !== null,
            'description' => $benchmark->description(),
        ];
    }

    /**
     * Evaluate all core metrics from FinancialMetrics and YoY revenue growth.
     *
     * @return array{
     *     evaluations: array<string, array<string, mixed>>,
     *     summary: array<string, mixed>
     * }
     */
    public function evaluateMetrics(
        string $companyId,
        FinancialMetrics $metrics,
        ?float $yoyRevenueGrowth = null
    ): array {
        $hasBalanceSheetData = !$metrics->currentAssets()->isZero()
            || !$metrics->currentLiabilities()->isZero()
            || ($metrics->totalAssets() !== null && !$metrics->totalAssets()->isZero())
            || ($metrics->totalDebt() !== null && !$metrics->totalDebt()->isZero());

        $hasRevenueData = !$metrics->revenue()->isZero();

        $actualValues = [
            BenchmarkMetricType::CURRENT_RATIO->value => $hasBalanceSheetData ? $metrics->currentRatio() : null,
            BenchmarkMetricType::QUICK_RATIO->value => $hasBalanceSheetData ? $metrics->quickRatio() : null,
            BenchmarkMetricType::DEBT_TO_ASSETS->value => $hasBalanceSheetData ? $metrics->debtToAssets() : null,
            BenchmarkMetricType::GROSS_MARGIN->value => $hasRevenueData ? $metrics->grossMargin() : null,
            BenchmarkMetricType::EBITDA_MARGIN->value => $hasRevenueData ? $metrics->ebitdaMargin() : null,
            BenchmarkMetricType::OPERATING_MARGIN->value => $hasRevenueData ? $metrics->operatingMargin() : null,
            BenchmarkMetricType::NET_MARGIN->value => $hasRevenueData ? $metrics->netMargin() : null,
            BenchmarkMetricType::REVENUE_GROWTH->value => $yoyRevenueGrowth,
        ];

        return $this->evaluateRawValues($companyId, $actualValues);
    }

    /**
     * Evaluate a dictionary of raw metric values.
     *
     * @param array<string, ?float> $rawValues
     * @return array{
     *     evaluations: array<string, array<string, mixed>>,
     *     summary: array<string, mixed>
     * }
     */
    public function evaluateRawValues(string $companyId, array $rawValues): array
    {
        $evaluations = [];

        foreach (BenchmarkMetricType::cases() as $metricType) {
            $key = $metricType->value;
            // Also support lower_case keys (e.g. current_ratio)
            $snakeKey = strtolower($key);

            $actualValue = $rawValues[$key] ?? ($rawValues[$snakeKey] ?? null);

            $evaluations[$key] = $this->evaluateMetric($companyId, $metricType, $actualValue);
        }

        return [
            "evaluations" => $evaluations,
            "summary" => $this->computeSummary($evaluations),
        ];
    }

    /**
     * Evaluate KPI payload produced by KpiCalculationService or KpiController.
     *
     * @param array<string, mixed> $kpiData
     * @return array{
     *     evaluations: array<string, array<string, mixed>>,
     *     summary: array<string, mixed>
     * }
     */
    public function evaluateKpiPayload(string $companyId, array $kpiData): array
    {
        $metrics = $kpiData["metrics"] ?? [];
        $dynamics = $kpiData["dynamics"] ?? ($kpiData["yoy"] ?? []);
        $yoy = isset($kpiData["dynamics"]["yoy"]) ? $kpiData["dynamics"]["yoy"] : $dynamics;

        $ratios = $metrics["ratios"] ?? [];
        $liquidity = $metrics["liquidity"] ?? [];
        $solvency = $metrics["solvency"] ?? [];
        $balanceSheet = $metrics["balance_sheet"] ?? [];
        $pnl = $metrics["pnl"] ?? [];

        // Check if balance sheet data actually exists
        $hasBalanceSheet = false;
        if (!empty($balanceSheet)) {
            $curAssets = (float) ($balanceSheet["current_assets"]["amount"] ?? 0);
            $curLiab = (float) ($balanceSheet["current_liabilities"]["amount"] ?? 0);
            $totAssets = (float) ($balanceSheet["total_assets"]["amount"] ?? 0);
            $totDebt = (float) ($balanceSheet["total_debt"]["amount"] ?? 0);
            if ($curAssets > 0 || $curLiab > 0 || $totAssets > 0 || $totDebt > 0) {
                $hasBalanceSheet = true;
            }
        } elseif (!empty($liquidity)) {
            $curAssets = (float) ($liquidity["current_assets"]["amount"] ?? 0);
            $curLiab = (float) ($liquidity["current_liabilities"]["amount"] ?? 0);
            if ($curAssets > 0 || $curLiab > 0) {
                $hasBalanceSheet = true;
            }
        }

        $curRatio = $metrics["current_ratio"]
            ?? ($ratios["current_ratio"]
            ?? ($liquidity["current_ratio"] ?? null));

        $qRatio = $metrics["quick_ratio"]
            ?? ($ratios["quick_ratio"]
            ?? ($liquidity["quick_ratio"] ?? null));

        $dta = $metrics["debt_to_assets"]
            ?? ($ratios["debt_to_assets"]
            ?? ($solvency["debt_to_assets"] ?? null));

        if (!$hasBalanceSheet && !isset($metrics["current_ratio"])) {
            $curRatio = null;
            $qRatio = null;
            $dta = null;
        }

        $grossMargin = $metrics["gross_margin"]
            ?? ($ratios["gross_margin"]
            ?? (isset($pnl["gross_margin_pct"]) ? ((float) $pnl["gross_margin_pct"]) / 100 : null));

        $ebitdaMargin = $metrics["ebitda_margin"]
            ?? ($ratios["ebitda_margin"]
            ?? (isset($pnl["ebitda_margin_pct"]) ? ((float) $pnl["ebitda_margin_pct"]) / 100 : null));

        $operatingMargin = $metrics["operating_margin"]
            ?? ($ratios["operating_margin"]
            ?? (isset($pnl["operating_margin_pct"]) ? ((float) $pnl["operating_margin_pct"]) / 100 : null));

        $netMargin = $metrics["net_margin"]
            ?? ($ratios["net_margin"]
            ?? (isset($pnl["net_margin_pct"]) ? ((float) $pnl["net_margin_pct"]) / 100 : null));

        $rawValues = [
            BenchmarkMetricType::CURRENT_RATIO->value => $curRatio !== null ? (float) $curRatio : null,
            BenchmarkMetricType::QUICK_RATIO->value => $qRatio !== null ? (float) $qRatio : null,
            BenchmarkMetricType::DEBT_TO_ASSETS->value => $dta !== null ? (float) $dta : null,
            BenchmarkMetricType::GROSS_MARGIN->value => $grossMargin !== null ? (float) $grossMargin : null,
            BenchmarkMetricType::EBITDA_MARGIN->value => $ebitdaMargin !== null ? (float) $ebitdaMargin : null,
            BenchmarkMetricType::OPERATING_MARGIN->value => $operatingMargin !== null ? (float) $operatingMargin : null,
            BenchmarkMetricType::NET_MARGIN->value => $netMargin !== null ? (float) $netMargin : null,
            BenchmarkMetricType::REVENUE_GROWTH->value => isset($yoy["revenue_growth_pct"]) && $yoy["revenue_growth_pct"] !== null ? (float) $yoy["revenue_growth_pct"] : null,
        ];

        return $this->evaluateRawValues($companyId, $rawValues);
    }

    /**
     * Compute summary statistics and overall health rating from a set of metric evaluations.
     *
     * @param array<string, array<string, mixed>> $evaluations
     * @return array{
     *     total_metrics: int,
     *     evaluated_count: int,
     *     optimal_count: int,
     *     warning_count: int,
     *     critical_count: int,
     *     unknown_count: int,
     *     overall_status: string,
     *     overall_status_label: string,
     *     overall_status_color: string,
     *     health_score: ?float
     * }
     */
    public function computeSummary(array $evaluations): array
    {
        $total = count($evaluations);
        $optimal = 0;
        $warning = 0;
        $critical = 0;
        $unknown = 0;

        foreach ($evaluations as $evaluation) {
            $status = $evaluation["status"] ?? BenchmarkStatus::UNKNOWN->value;

            match ($status) {
                BenchmarkStatus::OPTIMAL->value => $optimal++,
                BenchmarkStatus::WARNING->value => $warning++,
                BenchmarkStatus::CRITICAL->value => $critical++,
                default => $unknown++,
            };
        }

        $evaluatedCount = $total - $unknown;

        $overallStatus = BenchmarkStatus::UNKNOWN;
        if ($critical > 0) {
            $overallStatus = BenchmarkStatus::CRITICAL;
        } elseif ($warning > 0) {
            $overallStatus = BenchmarkStatus::WARNING;
        } elseif ($optimal > 0) {
            $overallStatus = BenchmarkStatus::OPTIMAL;
        }

        // Health score 0-100: (optimal*100 + warning*50) / (evaluatedCount*100) * 100
        $healthScore = null;
        if ($evaluatedCount > 0) {
            $healthScore = round((($optimal * 100.0) + ($warning * 50.0)) / ($evaluatedCount * 100.0) * 100.0, 1);
        }

        return [
            "total_metrics" => $total,
            "evaluated_count" => $evaluatedCount,
            "optimal_count" => $optimal,
            "warning_count" => $warning,
            "critical_count" => $critical,
            "unknown_count" => $unknown,
            "overall_status" => $overallStatus->value,
            "overall_status_label" => $overallStatus->label(),
            "overall_status_color" => $overallStatus->color(),
            "health_score" => $healthScore,
        ];
    }
}
