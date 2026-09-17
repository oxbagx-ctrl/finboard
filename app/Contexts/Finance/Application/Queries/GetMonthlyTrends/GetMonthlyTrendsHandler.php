<?php

declare(strict_types=1);

namespace App\Contexts\Finance\Application\Queries\GetMonthlyTrends;

use App\Contexts\Finance\Domain\Model\FinancialRecord;
use App\Contexts\Finance\Domain\Repositories\FinancialRecordRepositoryInterface;
use App\Contexts\Finance\Domain\Services\FinancialCalculator;
use App\Contexts\Finance\Domain\ValueObjects\Currency;
use App\Contexts\Finance\Domain\ValueObjects\DateRange;

final class GetMonthlyTrendsHandler
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
     *     revenue: float,
     *     cogs: float,
     *     gross_profit: float,
     *     opex: float,
     *     ebitda: float,
     *     ebit: float,
     *     net_profit: float,
     *     gross_margin_percent: float,
     *     ebitda_margin_percent: float,
     *     net_margin_percent: float
     * }>
     */
    public function handle(GetMonthlyTrendsQuery $query): array
    {
        $currency = Currency::from($query->currency);

        $period = null;
        if ($query->startDate !== null && $query->endDate !== null) {
            $period = DateRange::fromStrings($query->startDate, $query->endDate);
        }

        $records = $this->recordRepository->findByCompanyId($query->companyId, $period);

        // Group records by YYYY-MM
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
                'revenue' => (float) $metrics->revenue()->amount(),
                'cogs' => (float) $metrics->cogs()->amount(),
                'gross_profit' => (float) $metrics->grossProfit()->amount(),
                'opex' => (float) $metrics->opex()->amount(),
                'ebitda' => (float) $metrics->ebitda()->amount(),
                'ebit' => (float) $metrics->ebit()->amount(),
                'net_profit' => (float) $metrics->netProfit()->amount(),
                'gross_margin_percent' => round($metrics->grossMargin() * 100, 2),
                'ebitda_margin_percent' => round($metrics->ebitdaMargin() * 100, 2),
                'net_margin_percent' => round($metrics->netMargin() * 100, 2),
            ];
        }

        return $trends;
    }
}
