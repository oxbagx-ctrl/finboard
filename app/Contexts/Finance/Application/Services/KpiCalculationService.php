<?php

declare(strict_types=1);

namespace App\Contexts\Finance\Application\Services;

use App\Contexts\Finance\Domain\Model\FinancialRecord;
use App\Contexts\Finance\Domain\Repositories\FinancialRecordRepositoryInterface;
use App\Contexts\Finance\Domain\Services\FinancialCalculator;
use App\Contexts\Finance\Domain\ValueObjects\Currency;
use App\Contexts\Finance\Domain\ValueObjects\DateRange;
use App\Contexts\Finance\Domain\ValueObjects\FinancialMetrics;
use App\Contexts\Finance\Domain\ValueObjects\Money;

final class KpiCalculationService
{
    public function __construct(
        private readonly FinancialRecordRepositoryInterface $recordRepository,
        private readonly FinancialCalculator $calculator
    ) {
    }

    /**
     * Calculate growth percentage between two Money amounts: (current - previous) / |previous| * 100
     * Returns null if previous is null, zero, or missing (division by zero guard).
     */
    public function calculateGrowthPercentage(?Money $current, ?Money $previous): ?float
    {
        if ($current === null || $previous === null || $previous->isZero()) {
            return null;
        }

        $diff = $current->subtract($previous);
        $absPreviousAmount = ltrim($previous->amount(), '-');

        if ($absPreviousAmount === '0.0000' || $absPreviousAmount === '0' || $absPreviousAmount === '') {
            return null;
        }

        $ratio = bcdiv($diff->amount(), $absPreviousAmount, 6);
        $percentage = bcmul($ratio, '100', 4);

        return round((float) $percentage, 2);
    }

    /**
     * Calculate difference between two ratio floats (e.g. Current Ratio, Quick Ratio).
     * Returns null if either ratio is null.
     */
    public function calculateRatioDifference(?float $currentRatio, ?float $previousRatio): ?float
    {
        if ($currentRatio === null || $previousRatio === null) {
            return null;
        }

        return round($currentRatio - $previousRatio, 2);
    }

    /**
     * Calculate difference in margin percentage points between two margins.
     */
    public function calculateMarginDifference(?float $currentMargin, ?float $previousMargin): ?float
    {
        if ($currentMargin === null || $previousMargin === null) {
            return null;
        }

        return round(($currentMargin - $previousMargin) * 100, 2);
    }

    /**
     * Calculate YoY and MoM dynamics for given company and period.
     *
     * @return array{
     *     company_id: string,
     *     period: array{start: string, end: string, label: string},
     *     metrics: array<string, mixed>,
     *     previous_year_metrics: ?array<string, mixed>,
     *     previous_month_metrics: ?array<string, mixed>,
     *     yoy: array<string, ?float>,
     *     mom: array<string, ?float>
     * }
     */
    public function calculateKpiDynamics(
        string $companyId,
        DateRange $period,
        Currency $currency = Currency::PLN
    ): array {
        // Fetch current records
        $currentRecords = $this->recordRepository->findByCompanyId($companyId, $period);
        $currentMetrics = $this->calculator->calculateMetrics($currentRecords, $currency, $period);

        // Fetch YoY comparative period records
        $prevYearPeriod = $period->previousYear();
        $prevYearRecords = $this->recordRepository->findByCompanyId($companyId, $prevYearPeriod);
        $hasPrevYearRecords = count($prevYearRecords) > 0;
        $prevYearMetrics = $hasPrevYearRecords
            ? $this->calculator->calculateMetrics($prevYearRecords, $currency, $prevYearPeriod)
            : null;

        // Fetch MoM comparative period records
        $prevMonthPeriod = $period->previousMonth();
        $prevMonthRecords = $this->recordRepository->findByCompanyId($companyId, $prevMonthPeriod);
        $hasPrevMonthRecords = count($prevMonthRecords) > 0;
        $prevMonthMetrics = $hasPrevMonthRecords
            ? $this->calculator->calculateMetrics($prevMonthRecords, $currency, $prevMonthPeriod)
            : null;

        return [
            'company_id' => $companyId,
            'period' => [
                'start' => $period->startDate()->format('Y-m-d'),
                'end' => $period->endDate()->format('Y-m-d'),
                'label' => $period->toPeriodString(),
            ],
            'metrics' => $currentMetrics->toArray(),
            'previous_year_metrics' => $prevYearMetrics?->toArray(),
            'previous_month_metrics' => $prevMonthMetrics?->toArray(),
            'yoy' => $this->computeComparativeDynamics($currentMetrics, $prevYearMetrics),
            'mom' => $this->computeComparativeDynamics($currentMetrics, $prevMonthMetrics),
        ];
    }

    /**
     * Compute dynamics directly from sets of records without direct repository interaction.
     *
     * @param array<FinancialRecord> $currentRecords
     * @param array<FinancialRecord> $prevYearRecords
     * @param array<FinancialRecord> $prevMonthRecords
     * @return array{
     *     metrics: array<string, mixed>,
     *     previous_year_metrics: ?array<string, mixed>,
     *     previous_month_metrics: ?array<string, mixed>,
     *     yoy: array<string, ?float>,
     *     mom: array<string, ?float>
     * }
     */
    public function calculateDynamicsFromRecords(
        array $currentRecords,
        array $prevYearRecords = [],
        array $prevMonthRecords = [],
        Currency $currency = Currency::PLN,
        ?DateRange $currentPeriod = null
    ): array {
        $currentMetrics = $this->calculator->calculateMetrics($currentRecords, $currency, $currentPeriod);

        $prevYearMetrics = count($prevYearRecords) > 0
            ? $this->calculator->calculateMetrics($prevYearRecords, $currency, $currentPeriod?->previousYear())
            : null;

        $prevMonthMetrics = count($prevMonthRecords) > 0
            ? $this->calculator->calculateMetrics($prevMonthRecords, $currency, $currentPeriod?->previousMonth())
            : null;

        return [
            'metrics' => $currentMetrics->toArray(),
            'previous_year_metrics' => $prevYearMetrics?->toArray(),
            'previous_month_metrics' => $prevMonthMetrics?->toArray(),
            'yoy' => $this->computeComparativeDynamics($currentMetrics, $prevYearMetrics),
            'mom' => $this->computeComparativeDynamics($currentMetrics, $prevMonthMetrics),
        ];
    }

    /**
     * Compute comparative dynamics between current metrics and comparison metrics.
     *
     * @return array{
     *     revenue_growth_pct: ?float,
     *     gross_profit_growth_pct: ?float,
     *     ebitda_growth_pct: ?float,
     *     ebit_growth_pct: ?float,
     *     net_profit_growth_pct: ?float,
     *     opex_growth_pct: ?float,
     *     current_ratio_diff: ?float,
     *     quick_ratio_diff: ?float,
     *     gross_margin_diff_pct: ?float,
     *     ebitda_margin_diff_pct: ?float,
     *     net_margin_diff_pct: ?float
     * }
     */
    public function computeComparativeDynamics(
        FinancialMetrics $current,
        ?FinancialMetrics $previous
    ): array {
        if ($previous === null) {
            return [
                'revenue_growth_pct' => null,
                'gross_profit_growth_pct' => null,
                'ebitda_growth_pct' => null,
                'ebit_growth_pct' => null,
                'net_profit_growth_pct' => null,
                'opex_growth_pct' => null,
                'current_ratio_diff' => null,
                'quick_ratio_diff' => null,
                'gross_margin_diff_pct' => null,
                'ebitda_margin_diff_pct' => null,
                'net_margin_diff_pct' => null,
            ];
        }

        return [
            'revenue_growth_pct' => $this->calculateGrowthPercentage($current->revenue(), $previous->revenue()),
            'gross_profit_growth_pct' => $this->calculateGrowthPercentage($current->grossProfit(), $previous->grossProfit()),
            'ebitda_growth_pct' => $this->calculateGrowthPercentage($current->ebitda(), $previous->ebitda()),
            'ebit_growth_pct' => $this->calculateGrowthPercentage($current->ebit(), $previous->ebit()),
            'net_profit_growth_pct' => $this->calculateGrowthPercentage($current->netProfit(), $previous->netProfit()),
            'opex_growth_pct' => $this->calculateGrowthPercentage($current->opex(), $previous->opex()),
            'current_ratio_diff' => $this->calculateRatioDifference($current->currentRatio(), $previous->currentRatio()),
            'quick_ratio_diff' => $this->calculateRatioDifference($current->quickRatio(), $previous->quickRatio()),
            'gross_margin_diff_pct' => $this->calculateMarginDifference($current->grossMargin(), $previous->grossMargin()),
            'ebitda_margin_diff_pct' => $this->calculateMarginDifference($current->ebitdaMargin(), $previous->ebitdaMargin()),
            'net_margin_diff_pct' => $this->calculateMarginDifference($current->netMargin(), $previous->netMargin()),
        ];
    }
}
