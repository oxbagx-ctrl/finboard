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
     * Safely calculate dynamic growth percentage: ((current - previous) / |previous|) * 100
     *
     * Returns null if previous value is zero or null, preventing division by zero.
     * Accurately handles negative base (e.g. exiting from a loss to profit).
     */
    public function calculateGrowthPercentage(?Money $current, ?Money $previous): ?float
    {
        if ($current === null || $previous === null) {
            return null;
        }

        $prevAmount = $previous->amount();
        if ($prevAmount === '0' || $prevAmount === '0.0000') {
            return null;
        }

        $diff = bcsub($current->amount(), $prevAmount, 6);
        $absPrev = $previous->isNegative() ? bcmul($prevAmount, '-1', 6) : $prevAmount;

        $ratio = bcdiv($diff, $absPrev, 6);
        $percentage = bcmul($ratio, '100', 4);

        return round((float) $percentage, 2);
    }

    /**
     * Calculate absolute point difference for solvency ratios.
     */
    public function calculateRatioDifference(?float $currentRatio, ?float $previousRatio): ?float
    {
        if ($currentRatio === null || $previousRatio === null) {
            return null;
        }

        return round($currentRatio - $previousRatio, 4);
    }

    /**
     * Calculate percentage point difference for profit margins.
     */
    public function calculateMarginDifference(?float $currentMargin, ?float $previousMargin): ?float
    {
        if ($currentMargin === null || $previousMargin === null) {
            return null;
        }

        return round(($currentMargin - $previousMargin) * 100, 2);
    }

    /**
     * Calculate absolute monetary difference between two Money amounts in currency units.
     */
    public function calculateAmountDifference(?Money $current, ?Money $previous): ?float
    {
        if ($current === null || $previous === null) {
            return null;
        }

        return round((float) bcsub($current->amount(), $previous->amount(), 4), 2);
    }

    /**
     * Calculate complete KPI metrics along with YoY and MoM dynamics for a company.
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
     * @return array<string, ?float>
     */
    public function computeComparativeDynamics(
        FinancialMetrics $current,
        ?FinancialMetrics $previous
    ): array {
        if ($previous === null) {
            return [
                'revenue_growth_pct' => null,
                'cogs_growth_pct' => null,
                'gross_profit_growth_pct' => null,
                'gross_margin_diff_pct' => null,
                'ebitda_growth_pct' => null,
                'ebitda_margin_diff_pct' => null,
                'ebit_growth_pct' => null,
                'operating_margin_diff_pct' => null,
                'net_profit_growth_pct' => null,
                'net_margin_diff_pct' => null,
                'opex_growth_pct' => null,
                'depreciation_growth_pct' => null,
                'tax_growth_pct' => null,
                'current_ratio_diff' => null,
                'quick_ratio_diff' => null,
                'debt_to_assets_diff' => null,
                'revenue_diff_amount' => null,
                'cogs_diff_amount' => null,
                'gross_profit_diff_amount' => null,
                'opex_diff_amount' => null,
                'ebitda_diff_amount' => null,
                'ebit_diff_amount' => null,
                'net_profit_diff_amount' => null,
            ];
        }

        return [
            'revenue_growth_pct' => $this->calculateGrowthPercentage($current->revenue(), $previous->revenue()),
            'cogs_growth_pct' => $this->calculateGrowthPercentage($current->cogs(), $previous->cogs()),
            'gross_profit_growth_pct' => $this->calculateGrowthPercentage($current->grossProfit(), $previous->grossProfit()),
            'gross_margin_diff_pct' => $this->calculateMarginDifference($current->grossMargin(), $previous->grossMargin()),
            'ebitda_growth_pct' => $this->calculateGrowthPercentage($current->ebitda(), $previous->ebitda()),
            'ebitda_margin_diff_pct' => $this->calculateMarginDifference($current->ebitdaMargin(), $previous->ebitdaMargin()),
            'ebit_growth_pct' => $this->calculateGrowthPercentage($current->ebit(), $previous->ebit()),
            'operating_margin_diff_pct' => $this->calculateMarginDifference($current->operatingMargin(), $previous->operatingMargin()),
            'net_profit_growth_pct' => $this->calculateGrowthPercentage($current->netProfit(), $previous->netProfit()),
            'net_margin_diff_pct' => $this->calculateMarginDifference($current->netMargin(), $previous->netMargin()),
            'opex_growth_pct' => $this->calculateGrowthPercentage($current->opex(), $previous->opex()),
            'depreciation_growth_pct' => $this->calculateGrowthPercentage($current->depreciation(), $previous->depreciation()),
            'tax_growth_pct' => $this->calculateGrowthPercentage($current->tax(), $previous->tax()),
            'current_ratio_diff' => $this->calculateRatioDifference($current->currentRatio(), $previous->currentRatio()),
            'quick_ratio_diff' => $this->calculateRatioDifference($current->quickRatio(), $previous->quickRatio()),
            'debt_to_assets_diff' => $this->calculateRatioDifference($current->debtToAssets(), $previous->debtToAssets()),
            'revenue_diff_amount' => $this->calculateAmountDifference($current->revenue(), $previous->revenue()),
            'cogs_diff_amount' => $this->calculateAmountDifference($current->cogs(), $previous->cogs()),
            'gross_profit_diff_amount' => $this->calculateAmountDifference($current->grossProfit(), $previous->grossProfit()),
            'opex_diff_amount' => $this->calculateAmountDifference($current->opex(), $previous->opex()),
            'ebitda_diff_amount' => $this->calculateAmountDifference($current->ebitda(), $previous->ebitda()),
            'ebit_diff_amount' => $this->calculateAmountDifference($current->ebit(), $previous->ebit()),
            'net_profit_diff_amount' => $this->calculateAmountDifference($current->netProfit(), $previous->netProfit()),
        ];
    }
}
