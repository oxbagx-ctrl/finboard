<?php

declare(strict_types=1);

namespace App\Contexts\Finance\Application\Queries\GetCategoryBreakdown;

use App\Contexts\Finance\Application\Services\KpiCalculationService;
use App\Contexts\Finance\Domain\Repositories\FinancialRecordRepositoryInterface;
use App\Contexts\Finance\Domain\Services\FinancialCalculator;
use App\Contexts\Finance\Domain\ValueObjects\CategoryType;
use App\Contexts\Finance\Domain\ValueObjects\Currency;
use App\Contexts\Finance\Domain\ValueObjects\DateRange;
use App\Contexts\Finance\Domain\ValueObjects\Money;
use App\Contexts\Finance\Domain\ValueObjects\RecordType;

final class GetCategoryBreakdownHandler
{
    private readonly KpiCalculationService $kpiService;

    public function __construct(
        private readonly FinancialRecordRepositoryInterface $recordRepository,
        ?KpiCalculationService $kpiService = null
    ) {
        $this->kpiService = $kpiService ?? new KpiCalculationService($this->recordRepository, new FinancialCalculator());
    }

    /**
     * @return array<int, array{
     *     category_id: string,
     *     category_name: string,
     *     category_code: string,
     *     category_type: string,
     *     amount: float,
     *     formatted_amount: string,
     *     percentage: float,
     *     previous_amount: ?float,
     *     formatted_previous_amount: ?string,
     *     amount_change: ?float,
     *     formatted_amount_change: ?string,
     *     yoy_growth_pct: ?float,
     *     previous_percentage: ?float,
     *     percentage_point_diff: ?float
     * }>
     */
    public function handle(GetCategoryBreakdownQuery $query): array
    {
        $currency = Currency::from($query->currency);
        $filterType = RecordType::tryFrom(strtolower(trim((string) $query->recordType)));

        $allowedCategoryTypes = [];
        if ($query->categoryType !== null && trim($query->categoryType) !== '') {
            $types = array_map('trim', explode(',', strtolower($query->categoryType)));
            foreach ($types as $t) {
                $enumVal = CategoryType::tryFrom($t);
                if ($enumVal !== null) {
                    $allowedCategoryTypes[] = $enumVal;
                }
            }
        }

        $period = null;
        if ($query->startDate !== null && $query->endDate !== null) {
            $period = DateRange::fromStrings($query->startDate, $query->endDate);
        }

        $records = $this->recordRepository->findByCompanyId(
            $query->companyId,
            $period,
            $filterType,
            $allowedCategoryTypes
        );

        // Filter and aggregate per category for current period
        $totalsPerCategory = [];
        $categoryDetails = [];
        $grandTotal = Money::zero($currency);

        $minDate = null;
        $maxDate = null;

        foreach ($records as $record) {
            $category = $record->category();

            // Guard against domain mismatch
            if ($filterType !== null && $category->recordType() !== $filterType) {
                continue;
            }

            // Match requested category types if provided
            if (!empty($allowedCategoryTypes) && !in_array($category->type(), $allowedCategoryTypes, true)) {
                continue;
            }

            $catId = $category->id();
            if (!isset($totalsPerCategory[$catId])) {
                $totalsPerCategory[$catId] = Money::zero($currency);
                $categoryDetails[$catId] = [
                    'name' => $category->name(),
                    'code' => $category->code(),
                    'type' => $category->type()->value,
                ];
            }

            $totalsPerCategory[$catId] = $totalsPerCategory[$catId]->add($record->amount());
            $grandTotal = $grandTotal->add($record->amount());

            $rDate = $record->recordDate();
            if ($minDate === null || $rDate < $minDate) {
                $minDate = $rDate;
            }
            if ($maxDate === null || $rDate > $maxDate) {
                $maxDate = $rDate;
            }
        }

        // Optimization: If no records match for current period, short-circuit immediately
        if (empty($totalsPerCategory)) {
            return [];
        }

        // Determine effective period for YoY dynamics
        $effectivePeriod = $period;
        if ($effectivePeriod === null && $minDate !== null && $maxDate !== null) {
            $effectivePeriod = DateRange::fromDates($minDate, $maxDate);
        }

        // Determine comparative period for YoY dynamics
        $comparativePeriod = null;
        if ($query->includeYoY) {
            if ($query->comparisonStartDate !== null && $query->comparisonEndDate !== null) {
                $comparativePeriod = DateRange::fromStrings($query->comparisonStartDate, $query->comparisonEndDate);
            } elseif ($effectivePeriod !== null) {
                $comparativePeriod = $effectivePeriod->previousYear();
            }
        }

        // Aggregate comparative period records if comparative period is active
        $prevTotalsPerCategory = [];
        $prevTotalsByCode = [];
        $prevGrandTotal = Money::zero($currency);
        $hasComparativeRecords = false;

        if ($comparativePeriod !== null) {
            $prevRecords = $this->recordRepository->findByCompanyId(
                $query->companyId,
                $comparativePeriod,
                $filterType,
                $allowedCategoryTypes
            );
            if (!empty($prevRecords)) {
                $hasComparativeRecords = true;
                foreach ($prevRecords as $prevRecord) {
                    $prevCategory = $prevRecord->category();

                    if ($filterType !== null && $prevCategory->recordType() !== $filterType) {
                        continue;
                    }

                    if (!empty($allowedCategoryTypes) && !in_array($prevCategory->type(), $allowedCategoryTypes, true)) {
                        continue;
                    }

                    $pCatId = $prevCategory->id();
                    $pCode = strtoupper(trim($prevCategory->code()));

                    if (!isset($prevTotalsPerCategory[$pCatId])) {
                        $prevTotalsPerCategory[$pCatId] = Money::zero($currency);
                    }
                    $prevTotalsPerCategory[$pCatId] = $prevTotalsPerCategory[$pCatId]->add($prevRecord->amount());

                    if ($pCode !== '') {
                        if (!isset($prevTotalsByCode[$pCode])) {
                            $prevTotalsByCode[$pCode] = Money::zero($currency);
                        }
                        $prevTotalsByCode[$pCode] = $prevTotalsByCode[$pCode]->add($prevRecord->amount());
                    }

                    $prevGrandTotal = $prevGrandTotal->add($prevRecord->amount());
                }
            }
        }

        $items = [];
        foreach ($totalsPerCategory as $catId => $categoryMoney) {
            $amountFloat = (float) $categoryMoney->amount();
            $percentage = 0.0;

            if (!$grandTotal->isZero()) {
                $pctBc = bcmul(bcdiv($categoryMoney->amount(), $grandTotal->amount(), 6), '100', 2);
                $percentage = (float) $pctBc;
            }

            // Calculate comparative values and YoY dynamics
            $previousAmountFloat = null;
            $formattedPreviousAmount = null;
            $amountChangeFloat = null;
            $formattedAmountChange = null;
            $yoyGrowthPct = null;
            $previousPercentage = null;
            $percentagePointDiff = null;

            if ($hasComparativeRecords) {
                $currentCode = strtoupper(trim($categoryDetails[$catId]['code']));
                // Match by primary category ID or by standardized category code for cross-year continuity
                $prevMoney = $prevTotalsPerCategory[$catId] ?? ($prevTotalsByCode[$currentCode] ?? null);

                if ($prevMoney !== null) {
                    $previousAmountFloat = (float) $prevMoney->amount();
                    $formattedPreviousAmount = $prevMoney->format();
                    $yoyGrowthPct = $this->kpiService->calculateGrowthPercentage($categoryMoney, $prevMoney);

                    if (!$prevGrandTotal->isZero()) {
                        $prevPctBc = bcmul(bcdiv($prevMoney->amount(), $prevGrandTotal->amount(), 6), '100', 2);
                        $previousPercentage = (float) $prevPctBc;
                    } else {
                        $previousPercentage = 0.0;
                    }
                } else {
                    // Category did not exist in comparative period
                    $previousAmountFloat = 0.0;
                    $formattedPreviousAmount = Money::zero($currency)->format();
                    $yoyGrowthPct = null;
                    $previousPercentage = 0.0;
                }

                $amountChangeFloat = round($amountFloat - $previousAmountFloat, 2);
                $changeMoney = Money::fromDecimal((string) $amountChangeFloat, $currency);
                $formattedAmountChange = $changeMoney->format();

                if ($previousPercentage !== null) {
                    $percentagePointDiff = round($percentage - $previousPercentage, 2);
                }
            }

            $items[] = [
                'category_id' => $catId,
                'category_name' => $categoryDetails[$catId]['name'],
                'category_code' => $categoryDetails[$catId]['code'],
                'category_type' => $categoryDetails[$catId]['type'],
                'amount' => $amountFloat,
                'formatted_amount' => $categoryMoney->format(),
                'percentage' => $percentage,
                'previous_amount' => $previousAmountFloat,
                'formatted_previous_amount' => $formattedPreviousAmount,
                'amount_change' => $amountChangeFloat,
                'formatted_amount_change' => $formattedAmountChange,
                'yoy_growth_pct' => $yoyGrowthPct,
                'previous_percentage' => $previousPercentage,
                'percentage_point_diff' => $percentagePointDiff,
            ];
        }

        // Sort descending by amount
        usort($items, fn (array $a, array $b) => $b['amount'] <=> $a['amount']);

        return $items;
    }
}
