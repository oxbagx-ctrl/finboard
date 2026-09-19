<?php

declare(strict_types=1);

namespace App\Presentation\Api\Controllers;

use App\Contexts\Finance\Application\Services\KpiCalculationService;
use App\Contexts\Finance\Domain\Repositories\FinancialRecordRepositoryInterface;
use App\Contexts\Finance\Domain\Services\FinancialCalculator;
use App\Contexts\Finance\Domain\ValueObjects\Currency;
use App\Contexts\Finance\Domain\ValueObjects\DateRange;
use App\Presentation\Api\Requests\FinancialAnalyticsQueryRequest;
use App\Presentation\Api\Traits\ResolvesCompanyContext;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\Response;

final class KpiController
{
    use ResolvesCompanyContext;

    public function __construct(
        private readonly FinancialRecordRepositoryInterface $recordRepository,
        private readonly FinancialCalculator $calculator,
        private readonly KpiCalculationService $kpiService
    ) {
    }

    /**
     * Get dynamically calculated KPI metrics and YoY/MoM dynamics.
     */
    public function metrics(FinancialAnalyticsQueryRequest $request): JsonResponse
    {
        $companyId = $this->resolveCompanyId($request);
        $currency = Currency::from((string) $request->query('currency', 'PLN'));

        $startDate = $request->query('start_date');
        $endDate = $request->query('end_date');

        $period = null;
        if ($startDate !== null && $endDate !== null) {
            $period = DateRange::fromStrings($startDate, $endDate);
        }

        $records = $this->recordRepository->findByCompanyId($companyId, $period);
        $metrics = $this->calculator->calculateMetrics($records, $currency, $period);

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

        $dynamics = $dynamicsPeriod !== null
            ? $this->kpiService->calculateKpiDynamics($companyId, $dynamicsPeriod, $currency)
            : [
                'previous_year_metrics' => null,
                'previous_month_metrics' => null,
                'yoy' => [
                    'revenue_growth_pct' => null,
                    'gross_profit_growth_pct' => null,
                    'ebitda_growth_pct' => null,
                    'ebit_growth_pct' => null,
                    'net_profit_growth_pct' => null,
                    'opex_growth_pct' => null,
                    'current_ratio_diff' => null,
                    'quick_ratio_diff' => null,
                    'debt_to_assets_diff' => null,
                    'gross_margin_diff_pct' => null,
                    'operating_margin_diff_pct' => null,
                    'ebitda_margin_diff_pct' => null,
                    'net_margin_diff_pct' => null,
                ],
                'mom' => [
                    'revenue_growth_pct' => null,
                    'gross_profit_growth_pct' => null,
                    'ebitda_growth_pct' => null,
                    'ebit_growth_pct' => null,
                    'net_profit_growth_pct' => null,
                    'opex_growth_pct' => null,
                    'current_ratio_diff' => null,
                    'quick_ratio_diff' => null,
                    'debt_to_assets_diff' => null,
                    'gross_margin_diff_pct' => null,
                    'operating_margin_diff_pct' => null,
                    'ebitda_margin_diff_pct' => null,
                    'net_margin_diff_pct' => null,
                ],
            ];

        $data = $metrics->toArray();
        $data['dynamics'] = [
            'yoy' => $dynamics['yoy'],
            'mom' => $dynamics['mom'],
        ];
        $data['previous_year'] = $dynamics['previous_year_metrics'];
        $data['previous_month'] = $dynamics['previous_month_metrics'];

        return new JsonResponse([
            'status' => 'success',
            'company_id' => $companyId,
            'data' => $data,
        ], Response::HTTP_OK);
    }
}
