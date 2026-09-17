<?php

declare(strict_types=1);

namespace App\Contexts\Finance\Application\Queries\GetLiquidityTrends;

use App\Contexts\Finance\Domain\Model\FinancialRecord;
use App\Contexts\Finance\Domain\Repositories\FinancialRecordRepositoryInterface;
use App\Contexts\Finance\Domain\Services\FinancialCalculator;
use App\Contexts\Finance\Domain\ValueObjects\Currency;
use App\Contexts\Finance\Domain\ValueObjects\DateRange;

final class GetLiquidityTrendsHandler
{
    private const MONTH_LABELS = [
        '01' => 'Sty', '02' => 'Lut', '03' => 'Mar', '04' => 'Kwi',
        '05' => 'Maj', '06' => 'Cze', '07' => 'Lip', '08' => 'Sie',
        '09' => 'Wrz', '10' => 'Paź', '11' => 'Lis', '12' => 'Gru',
    ];

    public function __construct(
        private readonly FinancialRecordRepositoryInterface $recordRepository,
        private readonly FinancialCalculator $calculator
    ) {
    }

    /**
     * @return array<int, array{
     *     month: string,
     *     label: string,
     *     current_ratio: ?float,
     *     quick_ratio: ?float,
     *     current_assets: float,
     *     inventory: float,
     *     quick_assets: float,
     *     current_liabilities: float
     * }>
     */
    public function handle(GetLiquidityTrendsQuery $query): array
    {
        $currency = Currency::from($query->currency);

        $period = null;
        if ($query->startDate !== null && $query->endDate !== null) {
            $period = DateRange::fromStrings($query->startDate, $query->endDate);
        }

        $records = $this->recordRepository->findByCompanyId($query->companyId, $period);

        /** @var array<string, array<FinancialRecord>> $groupedByMonth */
        $groupedByMonth = [];
        foreach ($records as $record) {
            $monthKey = $record->recordDate()->format('Y-m');
            $groupedByMonth[$monthKey][] = $record;
        }

        ksort($groupedByMonth);

        $trends = [];
        foreach ($groupedByMonth as $monthKey => $monthRecords) {
            $metrics = $this->calculator->calculateMetrics($monthRecords, $currency);

            [$year, $monthNum] = explode('-', $monthKey);
            $monthName = self::MONTH_LABELS[$monthNum] ?? $monthNum;
            $label = sprintf('%s %s', $monthName, $year);

            $trends[] = [
                'month' => $monthKey,
                'label' => $label,
                'current_ratio' => $metrics->currentRatio(),
                'quick_ratio' => $metrics->quickRatio(),
                'current_assets' => (float) $metrics->currentAssets()->amount(),
                'inventory' => (float) $metrics->inventory()->amount(),
                'quick_assets' => (float) $metrics->quickAssets()->amount(),
                'current_liabilities' => (float) $metrics->currentLiabilities()->amount(),
            ];
        }

        return $trends;
    }
}
