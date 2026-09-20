<?php

declare(strict_types=1);

namespace App\Contexts\Finance\Application\Queries\CalculateFinancialDynamics;

use App\Contexts\Finance\Domain\ValueObjects\DateRange;
use App\Contexts\Finance\Domain\ValueObjects\FinancialMetrics;

final readonly class CalculateFinancialDynamicsResult
{
    /**
     * @param array<string, ?float> $yoy
     * @param array<string, ?float> $mom
     */
    public function __construct(
        public string $companyId,
        public FinancialMetrics $currentMetrics,
        public ?DateRange $period,
        public ?DateRange $previousYearPeriod,
        public ?FinancialMetrics $previousYearMetrics,
        public ?DateRange $previousMonthPeriod,
        public ?FinancialMetrics $previousMonthMetrics,
        public array $yoy,
        public array $mom
    ) {
    }

    public function currentMetrics(): FinancialMetrics
    {
        return $this->currentMetrics;
    }

    public function previousYearMetrics(): ?FinancialMetrics
    {
        return $this->previousYearMetrics;
    }

    public function previousMonthMetrics(): ?FinancialMetrics
    {
        return $this->previousMonthMetrics;
    }

    public function hasPreviousYearData(): bool
    {
        return $this->previousYearMetrics !== null;
    }

    public function hasPreviousMonthData(): bool
    {
        return $this->previousMonthMetrics !== null;
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'company_id' => $this->companyId,
            'period' => $this->period ? [
                'start' => $this->period->startDate()->format('Y-m-d'),
                'end' => $this->period->endDate()->format('Y-m-d'),
                'label' => $this->period->toPeriodString(),
            ] : null,
            'previous_year_period' => $this->previousYearPeriod ? [
                'start' => $this->previousYearPeriod->startDate()->format('Y-m-d'),
                'end' => $this->previousYearPeriod->endDate()->format('Y-m-d'),
                'label' => $this->previousYearPeriod->toPeriodString(),
            ] : null,
            'previous_month_period' => $this->previousMonthPeriod ? [
                'start' => $this->previousMonthPeriod->startDate()->format('Y-m-d'),
                'end' => $this->previousMonthPeriod->endDate()->format('Y-m-d'),
                'label' => $this->previousMonthPeriod->toPeriodString(),
            ] : null,
            'metrics' => $this->currentMetrics->toArray(),
            'previous_year_metrics' => $this->previousYearMetrics?->toArray(),
            'previous_month_metrics' => $this->previousMonthMetrics?->toArray(),
            'yoy' => $this->yoy,
            'mom' => $this->mom,
            'has_previous_year_data' => $this->hasPreviousYearData(),
            'has_previous_month_data' => $this->hasPreviousMonthData(),
        ];
    }
}
