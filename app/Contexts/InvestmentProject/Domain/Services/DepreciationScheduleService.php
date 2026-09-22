<?php

declare(strict_types=1);

namespace App\Contexts\InvestmentProject\Domain\Services;

use App\Contexts\Finance\Domain\ValueObjects\Currency;
use App\Contexts\Finance\Domain\ValueObjects\Money;
use App\Contexts\InvestmentProject\Domain\Entities\CapexStage;
use App\Contexts\InvestmentProject\Domain\Model\InvestmentProject;
use App\Contexts\InvestmentProject\Domain\ValueObjects\AnnualDepreciationSummary;
use App\Contexts\InvestmentProject\Domain\ValueObjects\DepreciationSchedule;
use App\Contexts\InvestmentProject\Domain\ValueObjects\FixedAssetPeriod;
use DateTimeImmutable;
use InvalidArgumentException;

final class DepreciationScheduleService
{
    /**
     * Generates a 15-year (or custom horizon) depreciation and PP&E roll-forward schedule
     * from an InvestmentProject aggregate.
     */
    public function generateSchedule(
        InvestmentProject $project,
        int $horizonYears = 15,
        bool $depreciateFromNextMonth = true
    ): DepreciationSchedule {
        $currency = $project->financingStructure()->investor1Equity()->currency();

        return $this->generateFromStages(
            stages: $project->capexStages(),
            projectStartDate: $project->startDate(),
            horizonYears: $horizonYears,
            depreciateFromNextMonth: $depreciateFromNextMonth,
            currency: $currency
        );
    }

    /**
     * Generates depreciation schedule for an explicit array of CapexStages.
     *
     * @param array<CapexStage> $stages
     */
    public function generateFromStages(
        array $stages,
        DateTimeImmutable $projectStartDate,
        int $horizonYears = 15,
        bool $depreciateFromNextMonth = true,
        ?Currency $currency = null
    ): DepreciationSchedule {
        if ($horizonYears < 1 || $horizonYears > 30) {
            throw new InvalidArgumentException(
                sprintf('Horizon years must be between 1 and 30, %d given.', $horizonYears)
            );
        }

        $resolvedCurrency = $currency
            ?? (!empty($stages) ? $stages[0]->netAmount()->currency() : Currency::PLN);

        $totalMonths = $horizonYears * 12;
        $baseDate = new DateTimeImmutable($projectStartDate->format('Y-m-01'));

        if (empty($stages)) {
            return $this->buildEmptySchedule($resolvedCurrency, $horizonYears, $totalMonths, $baseDate);
        }

        // 1. Pre-calculate monthly timeline for each stage
        $stageMonthlyData = [];
        foreach ($stages as $stage) {
            $stageMonthlyData[$stage->id()] = $this->calculateStageMonthlyData(
                $stage,
                $baseDate,
                $totalMonths,
                $depreciateFromNextMonth,
                $resolvedCurrency
            );
        }

        // 2. Aggregate monthly periods (1..totalMonths)
        $periods = [];
        $cipClosing = Money::zero($resolvedCurrency);
        $gbvClosing = Money::zero($resolvedCurrency);
        $accumDepClosing = Money::zero($resolvedCurrency);

        for ($m = 1; $m <= $totalMonths; $m++) {
            $year = (int) ceil($m / 12);
            $monthInYear = (($m - 1) % 12) + 1;
            $periodDate = $baseDate->modify(sprintf('+%d months', $m - 1));

            $cipOpening = $cipClosing;
            $gbvOpening = $gbvClosing;
            $accumDepOpening = $accumDepClosing;

            $monthCapex = Money::zero($resolvedCurrency);
            $monthCapitalized = Money::zero($resolvedCurrency);
            $monthDepreciation = Money::zero($resolvedCurrency);

            foreach ($stageMonthlyData as $data) {
                if (isset($data['capex'][$m])) {
                    $monthCapex = $monthCapex->add($data['capex'][$m]);
                }
                if (isset($data['capitalized'][$m])) {
                    $monthCapitalized = $monthCapitalized->add($data['capitalized'][$m]);
                }
                if (isset($data['depreciation'][$m])) {
                    $monthDepreciation = $monthDepreciation->add($data['depreciation'][$m]);
                }
            }

            $cipClosing = $cipOpening->add($monthCapex)->subtract($monthCapitalized);
            $gbvClosing = $gbvOpening->add($monthCapitalized);
            $accumDepClosing = $accumDepOpening->add($monthDepreciation);
            $nbvClosing = $gbvClosing->subtract($accumDepClosing);

            $periods[] = new FixedAssetPeriod(
                periodNumber: $m,
                year: $year,
                monthInYear: $monthInYear,
                date: $periodDate,
                constructionInProgressOpening: $cipOpening,
                capexIncurred: $monthCapex,
                capitalizedAmount: $monthCapitalized,
                constructionInProgressClosing: $cipClosing,
                grossBookValueOpening: $gbvOpening,
                grossBookValueAdditions: $monthCapitalized,
                grossBookValueClosing: $gbvClosing,
                accumulatedDepreciationOpening: $accumDepOpening,
                depreciationCharge: $monthDepreciation,
                accumulatedDepreciationClosing: $accumDepClosing,
                netBookValueClosing: $nbvClosing
            );
        }

        // 3. Aggregate annual summaries (1..horizonYears)
        $annualSummaries = $this->aggregateAnnualSummaries($periods, $horizonYears, $resolvedCurrency);

        // 4. Aggregate by KST and by Stage summaries
        $byKstSummaries = $this->buildByKstSummaries($stages, $stageMonthlyData, $horizonYears, $resolvedCurrency);
        $byStageSummaries = $this->buildByStageSummaries($stages, $stageMonthlyData, $horizonYears, $resolvedCurrency);

        return new DepreciationSchedule(
            currency: $resolvedCurrency,
            horizonYears: $horizonYears,
            monthlyPeriods: $periods,
            annualSummaries: $annualSummaries,
            byKstSummaries: $byKstSummaries,
            byStageSummaries: $byStageSummaries
        );
    }

    /**
     * Pre-calculates monthly Capex, Capitalization, and Depreciation for a single stage over the horizon.
     *
     * @return array{capex: array<int, Money>, capitalized: array<int, Money>, depreciation: array<int, Money>}
     */
    private function calculateStageMonthlyData(
        CapexStage $stage,
        DateTimeImmutable $baseStartDate,
        int $totalMonths,
        bool $depreciateFromNextMonth,
        Currency $currency
    ): array {
        $stageStartDate = new DateTimeImmutable($stage->startDate()->format('Y-m-01'));
        $diff = $baseStartDate->diff($stageStartDate);
        $monthOffset = ($diff->y * 12) + $diff->m;
        if ($stageStartDate < $baseStartDate) {
            $monthOffset = 0;
        }

        $duration = $stage->durationMonths();
        $netAmount = $stage->netAmount();

        $capex = [];
        $capitalized = [];
        $depreciation = [];

        // Distribute CAPEX across duration
        $allocatedNet = Money::zero($currency);
        for ($i = 0; $i < $duration; $i++) {
            $m = 1 + $monthOffset + $i;
            if ($m <= $totalMonths) {
                if ($i === $duration - 1) {
                    $monthCapex = $netAmount->subtract($allocatedNet);
                } else {
                    $monthCapex = $stage->monthlyCapex();
                    $allocatedNet = $allocatedNet->add($monthCapex);
                }
                $capex[$m] = $monthCapex;
            }
        }

        // Capitalization occurs in the final month of stage execution
        $capMonth = 1 + $monthOffset + $duration - 1;
        if ($capMonth <= $totalMonths) {
            $capitalized[$capMonth] = $netAmount;
        }

        // Depreciation calculations
        if ($stage->kst()->isDepreciable() && !$netAmount->isZero()) {
            $depStartMonth = $depreciateFromNextMonth ? $capMonth + 1 : $capMonth;
            $annualRate = $stage->kst()->annualDepreciationRate();
            $annualDep = $stage->annualDepreciation();
            $standardMonthlyDep = $stage->monthlyDepreciation();
            $usefulLifeMonths = (int) round((100.0 / $annualRate) * 12);

            $accumulatedDep = Money::zero($currency);
            for ($m = $depStartMonth; $m <= $totalMonths; $m++) {
                if ($accumulatedDep->greaterThanOrEqual($netAmount)) {
                    $depreciation[$m] = Money::zero($currency);
                    continue;
                }

                $monthIndex = $m - $depStartMonth + 1;
                $monthInCalendarYear = (($m - 1) % 12) + 1;

                if ($monthIndex === $usefulLifeMonths) {
                    // Final month of asset's useful life: absorb entire remaining book value
                    $actualDep = $netAmount->subtract($accumulatedDep);
                } elseif ($monthInCalendarYear === 12 && ($m - 11) >= $depStartMonth) {
                    // Full calendar year: reconcile 12-month annual depreciation
                    $prior11Allocated = $standardMonthlyDep->multiply(11);
                    $actualDep = $annualDep->subtract($prior11Allocated);
                } else {
                    $actualDep = $standardMonthlyDep;
                }

                $remainingToDepreciate = $netAmount->subtract($accumulatedDep);
                if ($actualDep->greaterThan($remainingToDepreciate)) {
                    $actualDep = $remainingToDepreciate;
                }

                $depreciation[$m] = $actualDep;
                $accumulatedDep = $accumulatedDep->add($actualDep);
            }
        }

        return [
            'capex' => $capex,
            'capitalized' => $capitalized,
            'depreciation' => $depreciation,
        ];
    }

    /**
     * @param array<FixedAssetPeriod> $periods
     * @return array<int, AnnualDepreciationSummary>
     */
    private function aggregateAnnualSummaries(array $periods, int $horizonYears, Currency $currency): array
    {
        $annualSummaries = [];
        $openingNetBookValue = Money::zero($currency);

        for ($year = 1; $year <= $horizonYears; $year++) {
            $yearStartPeriodIndex = ($year - 1) * 12;
            $yearEndPeriodIndex = min(count($periods) - 1, ($year * 12) - 1);

            $yearCapex = Money::zero($currency);
            $yearCapitalized = Money::zero($currency);
            $yearDepreciation = Money::zero($currency);

            for ($idx = $yearStartPeriodIndex; $idx <= $yearEndPeriodIndex; $idx++) {
                $p = $periods[$idx];
                $yearCapex = $yearCapex->add($p->capexIncurred());
                $yearCapitalized = $yearCapitalized->add($p->capitalizedAmount());
                $yearDepreciation = $yearDepreciation->add($p->depreciationCharge());
            }

            $endPeriod = $periods[$yearEndPeriodIndex];

            $annualSummaries[$year] = new AnnualDepreciationSummary(
                year: $year,
                openingNetBookValue: $openingNetBookValue,
                capexIncurred: $yearCapex,
                capitalizedAmount: $yearCapitalized,
                depreciationExpense: $yearDepreciation,
                grossBookValueClosing: $endPeriod->grossBookValueClosing(),
                accumulatedDepreciationClosing: $endPeriod->accumulatedDepreciationClosing(),
                closingNetBookValue: $endPeriod->netBookValueClosing(),
                closingConstructionInProgress: $endPeriod->constructionInProgressClosing()
            );

            $openingNetBookValue = $endPeriod->netBookValueClosing();
        }

        return $annualSummaries;
    }

    /**
     * @param array<CapexStage> $stages
     * @param array<string, array{capex: array<int, Money>, capitalized: array<int, Money>, depreciation: array<int, Money>}> $stageMonthlyData
     * @return array<string, array<int, AnnualDepreciationSummary>>
     */
    private function buildByStageSummaries(array $stages, array $stageMonthlyData, int $horizonYears, Currency $currency): array
    {
        $summaries = [];
        foreach ($stages as $stage) {
            $data = $stageMonthlyData[$stage->id()];
            $openingNetBookValue = Money::zero($currency);
            $stageSummaries = [];
            $accumDep = Money::zero($currency);
            $gbv = Money::zero($currency);
            $cip = Money::zero($currency);

            for ($year = 1; $year <= $horizonYears; $year++) {
                $startM = (($year - 1) * 12) + 1;
                $endM = $year * 12;

                $yearCapex = Money::zero($currency);
                $yearCapitalized = Money::zero($currency);
                $yearDep = Money::zero($currency);

                for ($m = $startM; $m <= $endM; $m++) {
                    if (isset($data['capex'][$m])) {
                        $yearCapex = $yearCapex->add($data['capex'][$m]);
                    }
                    if (isset($data['capitalized'][$m])) {
                        $yearCapitalized = $yearCapitalized->add($data['capitalized'][$m]);
                    }
                    if (isset($data['depreciation'][$m])) {
                        $yearDep = $yearDep->add($data['depreciation'][$m]);
                    }
                }

                $cip = $cip->add($yearCapex)->subtract($yearCapitalized);
                $gbv = $gbv->add($yearCapitalized);
                $accumDep = $accumDep->add($yearDep);
                $nbv = $gbv->subtract($accumDep);

                $stageSummaries[$year] = new AnnualDepreciationSummary(
                    year: $year,
                    openingNetBookValue: $openingNetBookValue,
                    capexIncurred: $yearCapex,
                    capitalizedAmount: $yearCapitalized,
                    depreciationExpense: $yearDep,
                    grossBookValueClosing: $gbv,
                    accumulatedDepreciationClosing: $accumDep,
                    closingNetBookValue: $nbv,
                    closingConstructionInProgress: $cip
                );

                $openingNetBookValue = $nbv;
            }

            $summaries[$stage->id()] = $stageSummaries;
        }

        return $summaries;
    }

    /**
     * @param array<CapexStage> $stages
     * @param array<string, array{capex: array<int, Money>, capitalized: array<int, Money>, depreciation: array<int, Money>}> $stageMonthlyData
     * @return array<string, array<int, AnnualDepreciationSummary>>
     */
    private function buildByKstSummaries(array $stages, array $stageMonthlyData, int $horizonYears, Currency $currency): array
    {
        $summaries = [];
        $stagesByKst = [];
        foreach ($stages as $stage) {
            $kst = $stage->kst()->code();
            $stagesByKst[$kst][] = $stage;
        }

        foreach ($stagesByKst as $kstCode => $kstStages) {
            $openingNetBookValue = Money::zero($currency);
            $kstSummaries = [];
            $accumDep = Money::zero($currency);
            $gbv = Money::zero($currency);
            $cip = Money::zero($currency);

            for ($year = 1; $year <= $horizonYears; $year++) {
                $startM = (($year - 1) * 12) + 1;
                $endM = $year * 12;

                $yearCapex = Money::zero($currency);
                $yearCapitalized = Money::zero($currency);
                $yearDep = Money::zero($currency);

                foreach ($kstStages as $st) {
                    $data = $stageMonthlyData[$st->id()];
                    for ($m = $startM; $m <= $endM; $m++) {
                        if (isset($data['capex'][$m])) {
                            $yearCapex = $yearCapex->add($data['capex'][$m]);
                        }
                        if (isset($data['capitalized'][$m])) {
                            $yearCapitalized = $yearCapitalized->add($data['capitalized'][$m]);
                        }
                        if (isset($data['depreciation'][$m])) {
                            $yearDep = $yearDep->add($data['depreciation'][$m]);
                        }
                    }
                }

                $cip = $cip->add($yearCapex)->subtract($yearCapitalized);
                $gbv = $gbv->add($yearCapitalized);
                $accumDep = $accumDep->add($yearDep);
                $nbv = $gbv->subtract($accumDep);

                $kstSummaries[$year] = new AnnualDepreciationSummary(
                    year: $year,
                    openingNetBookValue: $openingNetBookValue,
                    capexIncurred: $yearCapex,
                    capitalizedAmount: $yearCapitalized,
                    depreciationExpense: $yearDep,
                    grossBookValueClosing: $gbv,
                    accumulatedDepreciationClosing: $accumDep,
                    closingNetBookValue: $nbv,
                    closingConstructionInProgress: $cip
                );

                $openingNetBookValue = $nbv;
            }

            $summaries[$kstCode] = $kstSummaries;
        }

        return $summaries;
    }

    private function buildEmptySchedule(
        Currency $currency,
        int $horizonYears,
        int $totalMonths,
        DateTimeImmutable $baseDate
    ): DepreciationSchedule {
        $periods = [];
        $zero = Money::zero($currency);

        for ($m = 1; $m <= $totalMonths; $m++) {
            $year = (int) ceil($m / 12);
            $monthInYear = (($m - 1) % 12) + 1;
            $periodDate = $baseDate->modify(sprintf('+%d months', $m - 1));

            $periods[] = new FixedAssetPeriod(
                periodNumber: $m,
                year: $year,
                monthInYear: $monthInYear,
                date: $periodDate,
                constructionInProgressOpening: $zero,
                capexIncurred: $zero,
                capitalizedAmount: $zero,
                constructionInProgressClosing: $zero,
                grossBookValueOpening: $zero,
                grossBookValueAdditions: $zero,
                grossBookValueClosing: $zero,
                accumulatedDepreciationOpening: $zero,
                depreciationCharge: $zero,
                accumulatedDepreciationClosing: $zero,
                netBookValueClosing: $zero
            );
        }

        $annual = [];
        for ($year = 1; $year <= $horizonYears; $year++) {
            $annual[$year] = new AnnualDepreciationSummary(
                year: $year,
                openingNetBookValue: $zero,
                capexIncurred: $zero,
                capitalizedAmount: $zero,
                depreciationExpense: $zero,
                grossBookValueClosing: $zero,
                accumulatedDepreciationClosing: $zero,
                closingNetBookValue: $zero,
                closingConstructionInProgress: $zero
            );
        }

        return new DepreciationSchedule($currency, $horizonYears, $periods, $annual);
    }
}
