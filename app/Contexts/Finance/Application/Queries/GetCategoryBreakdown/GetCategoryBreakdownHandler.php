<?php

declare(strict_types=1);

namespace App\Contexts\Finance\Application\Queries\GetCategoryBreakdown;

use App\Contexts\Finance\Domain\Repositories\FinancialRecordRepositoryInterface;
use App\Contexts\Finance\Domain\ValueObjects\CategoryType;
use App\Contexts\Finance\Domain\ValueObjects\Currency;
use App\Contexts\Finance\Domain\ValueObjects\DateRange;
use App\Contexts\Finance\Domain\ValueObjects\Money;
use App\Contexts\Finance\Domain\ValueObjects\RecordType;

final class GetCategoryBreakdownHandler
{
    public function __construct(
        private readonly FinancialRecordRepositoryInterface $recordRepository
    ) {
    }

    /**
     * @return array<int, array{
     *     category_id: string,
     *     category_name: string,
     *     category_code: string,
     *     category_type: string,
     *     amount: float,
     *     formatted_amount: string,
     *     percentage: float
     * }>
     */
    public function handle(GetCategoryBreakdownQuery $query): array
    {
        $currency = Currency::from($query->currency);
        $filterType = RecordType::tryFrom(strtoupper($query->recordType));

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

        $records = $this->recordRepository->findByCompanyId($query->companyId, $period);

        // Filter and aggregate per category
        $totalsPerCategory = [];
        $categoryDetails = [];
        $grandTotal = Money::zero($currency);

        foreach ($records as $record) {
            $category = $record->category();

            // Match requested record type if provided
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
        }

        $items = [];
        foreach ($totalsPerCategory as $catId => $categoryMoney) {
            $amountFloat = (float) $categoryMoney->amount();
            $percentage = 0.0;

            if (!$grandTotal->isZero()) {
                $pctBc = bcmul(bcdiv($categoryMoney->amount(), $grandTotal->amount(), 6), '100', 2);
                $percentage = (float) $pctBc;
            }

            $items[] = [
                'category_id' => $catId,
                'category_name' => $categoryDetails[$catId]['name'],
                'category_code' => $categoryDetails[$catId]['code'],
                'category_type' => $categoryDetails[$catId]['type'],
                'amount' => $amountFloat,
                'formatted_amount' => $categoryMoney->format(),
                'percentage' => $percentage,
            ];
        }

        // Sort descending by amount
        usort($items, fn (array $a, array $b) => $b['amount'] <=> $a['amount']);

        return $items;
    }
}
