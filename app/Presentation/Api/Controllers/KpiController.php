<?php

declare(strict_types=1);

namespace App\Presentation\Api\Controllers;

use App\Contexts\Finance\Application\Queries\CalculateFinancialDynamics\CalculateFinancialDynamicsHandler;
use App\Contexts\Finance\Application\Queries\CalculateFinancialDynamics\CalculateFinancialDynamicsQuery;
use App\Contexts\Finance\Application\Services\KpiEvaluationService;
use App\Contexts\Finance\Domain\ValueObjects\Currency;
use App\Presentation\Api\Requests\FinancialAnalyticsQueryRequest;
use App\Presentation\Api\Traits\ResolvesCompanyContext;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\Response;

final class KpiController
{
    use ResolvesCompanyContext;

    public function __construct(
        private readonly CalculateFinancialDynamicsHandler $dynamicsHandler,
        private readonly KpiEvaluationService $evaluationService
    ) {
    }

    /**
     * Get dynamically calculated KPI metrics, YoY/MoM dynamics, and benchmark evaluations.
     */
    public function metrics(FinancialAnalyticsQueryRequest $request): JsonResponse
    {
        $companyId = $this->resolveCompanyId($request);
        $currency = Currency::tryFrom(strtoupper((string) $request->query('currency', 'PLN'))) ?? Currency::PLN;

        $startDate = $request->query('start_date');
        $endDate = $request->query('end_date');

        $dynamicsQuery = new CalculateFinancialDynamicsQuery(
            companyId: $companyId,
            startDate: $startDate,
            endDate: $endDate,
            currency: $currency->value
        );

        $dynamicsResult = $this->dynamicsHandler->handle($dynamicsQuery);
        $metrics = $dynamicsResult->currentMetrics();
        $dynamics = $dynamicsResult->toArray();

        $yoyRevenueGrowth = isset($dynamics['yoy']['revenue_growth_pct']) && $dynamics['yoy']['revenue_growth_pct'] !== null
            ? (float) $dynamics['yoy']['revenue_growth_pct']
            : null;

        $evaluation = $this->evaluationService->evaluateMetrics($companyId, $metrics, $yoyRevenueGrowth);

        $data = $metrics->toArray();
        $data['dynamics'] = [
            'yoy' => $dynamics['yoy'],
            'mom' => $dynamics['mom'],
        ];
        $data['previous_year'] = $dynamics['previous_year_metrics'];
        $data['previous_month'] = $dynamics['previous_month_metrics'];
        $data['benchmarks'] = $evaluation['evaluations'];
        $data['benchmark_summary'] = $evaluation['summary'];

        return new JsonResponse([
            'status' => 'success',
            'company_id' => $companyId,
            'data' => $data,
        ], Response::HTTP_OK);
    }
}
