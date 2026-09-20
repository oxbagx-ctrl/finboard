<?php

declare(strict_types=1);

namespace App\Contexts\Finance\Application\Queries\CalculateFinancialDynamics;

use App\Contexts\Finance\Application\Services\KpiCalculationService;
use App\Contexts\Finance\Domain\Repositories\FinancialRecordRepositoryInterface;
use App\Contexts\Finance\Domain\Services\FinancialCalculator;
use App\Contexts\Finance\Domain\ValueObjects\Currency;
use App\Contexts\Finance\Domain\ValueObjects\DateRange;

final class CalculateFinancialDynamicsHandler
{
    public function __construct(
        private readonly FinancialRecordRepositoryInterface $recordRepository,
        private readonly FinancialCalculator $calculator,
        private readonly KpiCalculationService $kpiService
    ) {
    }

    public function handle(CalculateFinancialDynamicsQuery $query): CalculateFinancialDynamicsResult
    {
        $currency = Currency::from($query->currency);

        $period = null;
        if ($query->startDate !== null && $query->endDate !== null) {
            $period = DateRange::fromStrings($query->startDate, $query->endDate);
        }

        $records = $this->recordRepository->findByCompanyId($query->companyId, $period);
        $currentMetrics = $this->calculator->calculateMetrics($records, $currency, $period);

        // Derive comparative period for dynamics if not explicitly given
        $dynamicsPeriod = $period;
        if ($dynamicsPeriod === null && count($records) > 0) {
            $minDate = null;
            $maxDate = null;
            foreach ($records as $record) {
                $rDate = $record->recordDate();
                if ($minDate === null || $rDate < $minDate) {
                    $minDate = $rDate;
                }
                if ($maxDate === null || $rDate > $maxDate) {
                    $maxDate = $rDate;
                }
            }
            if ($minDate !== null && $maxDate !== null) {
                $dynamicsPeriod = DateRange::fromDates($minDate, $maxDate);
            }
        }

        if ($dynamicsPeriod === null) {
            return new CalculateFinancialDynamicsResult(
                companyId: $query->companyId,
                currentMetrics: $currentMetrics,
                period: null,
                previousYearPeriod: null,
                previousYearMetrics: null,
                previousMonthPeriod: null,
                previousMonthMetrics: null,
                yoy: $this->kpiService->computeComparativeDynamics($currentMetrics, null),
                mom: $this->kpiService->computeComparativeDynamics($currentMetrics, null)
            );
        }

        // Fetch YoY comparative period records
        $prevYearPeriod = $dynamicsPeriod->previousYear();
        $prevYearRecords = $this->recordRepository->findByCompanyId($query->companyId, $prevYearPeriod);
        $hasPrevYearRecords = count($prevYearRecords) > 0;
        $prevYearMetrics = $hasPrevYearRecords
            ? $this->calculator->calculateMetrics($prevYearRecords, $currency, $prevYearPeriod)
            : null;

        // Fetch MoM comparative period records
        $prevMonthPeriod = $dynamicsPeriod->previousMonth();
        $prevMonthRecords = $this->recordRepository->findByCompanyId($query->companyId, $prevMonthPeriod);
        $hasPrevMonthRecords = count($prevMonthRecords) > 0;
        $prevMonthMetrics = $hasPrevMonthRecords
            ? $this->calculator->calculateMetrics($prevMonthRecords, $currency, $prevMonthPeriod)
            : null;

        return new CalculateFinancialDynamicsResult(
            companyId: $query->companyId,
            currentMetrics: $currentMetrics,
            period: $dynamicsPeriod,
            previousYearPeriod: $prevYearPeriod,
            previousYearMetrics: $prevYearMetrics,
            previousMonthPeriod: $prevMonthPeriod,
            previousMonthMetrics: $prevMonthMetrics,
            yoy: $this->kpiService->computeComparativeDynamics($currentMetrics, $prevYearMetrics),
            mom: $this->kpiService->computeComparativeDynamics($currentMetrics, $prevMonthMetrics)
        );
    }
}
