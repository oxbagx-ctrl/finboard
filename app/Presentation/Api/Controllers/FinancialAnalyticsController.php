<?php

declare(strict_types=1);

namespace App\Presentation\Api\Controllers;

use App\Contexts\Finance\Application\Queries\CalculateFinancialDynamics\CalculateFinancialDynamicsHandler;
use App\Contexts\Finance\Application\Queries\CalculateFinancialDynamics\CalculateFinancialDynamicsQuery;
use App\Contexts\Finance\Application\Queries\GetAvailableFiscalYears\GetAvailableFiscalYearsHandler;
use App\Contexts\Finance\Application\Queries\GetAvailableFiscalYears\GetAvailableFiscalYearsQuery;
use App\Contexts\Finance\Application\Queries\GetCategoryBreakdown\GetCategoryBreakdownHandler;
use App\Contexts\Finance\Application\Queries\GetCategoryBreakdown\GetCategoryBreakdownQuery;
use App\Contexts\Finance\Application\Queries\GetLiquidityTrends\GetLiquidityTrendsHandler;
use App\Contexts\Finance\Application\Queries\GetLiquidityTrends\GetLiquidityTrendsQuery;
use App\Contexts\Finance\Application\Queries\GetMonthlyTrends\GetMonthlyTrendsHandler;
use App\Contexts\Finance\Application\Queries\GetMonthlyTrends\GetMonthlyTrendsQuery;
use App\Presentation\Api\Requests\FinancialAnalyticsQueryRequest;
use App\Presentation\Api\Traits\ResolvesCompanyContext;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\Response;

final class FinancialAnalyticsController
{
    use ResolvesCompanyContext;

    /**
     * Get aggregate KPI financial metrics (P&L, Liquidity, and YoY/MoM dynamics).
     * Delegated to KpiController for unified KPI handling.
     */
    public function metrics(
        FinancialAnalyticsQueryRequest $request,
        KpiController $kpiController
    ): JsonResponse {
        return $kpiController->metrics($request);
    }

    /**
     * Get standalone dynamic YoY and MoM financial dynamics.
     */
    public function dynamics(
        FinancialAnalyticsQueryRequest $request,
        CalculateFinancialDynamicsHandler $handler
    ): JsonResponse {
        $companyId = $this->resolveCompanyId($request);

        $query = new CalculateFinancialDynamicsQuery(
            companyId: $companyId,
            startDate: $request->query('start_date'),
            endDate: $request->query('end_date'),
            currency: (string) $request->query('currency', 'PLN')
        );

        $result = $handler->handle($query);

        return new JsonResponse([
            'status' => 'success',
            'company_id' => $companyId,
            'data' => $result->toArray(),
        ], Response::HTTP_OK);
    }

    /**
     * Get available fiscal years with recorded financial data for company.
     */
    public function years(
        FinancialAnalyticsQueryRequest $request,
        GetAvailableFiscalYearsHandler $handler
    ): JsonResponse {
        $companyId = $this->resolveCompanyId($request);

        $query = new GetAvailableFiscalYearsQuery(companyId: $companyId);
        $years = $handler->handle($query);

        return new JsonResponse([
            'status' => 'success',
            'company_id' => $companyId,
            'count' => count($years),
            'data' => $years,
        ], Response::HTTP_OK);
    }

    /**
     * Get monthly historical trends for P&L chart visualization.
     */
    public function trends(
        FinancialAnalyticsQueryRequest $request,
        GetMonthlyTrendsHandler $handler
    ): JsonResponse {
        $companyId = $this->resolveCompanyId($request);

        $query = new GetMonthlyTrendsQuery(
            companyId: $companyId,
            startDate: $request->query('start_date'),
            endDate: $request->query('end_date'),
            currency: (string) $request->query('currency', 'PLN')
        );

        $trends = $handler->handle($query);

        return new JsonResponse([
            'status' => 'success',
            'company_id' => $companyId,
            'count' => count($trends),
            'data' => $trends,
        ], Response::HTTP_OK);
    }

    /**
     * Get category breakdown distribution for pie / donut charts and P&L tables.
     */
    public function breakdown(
        FinancialAnalyticsQueryRequest $request,
        GetCategoryBreakdownHandler $handler
    ): JsonResponse {
        $companyId = $this->resolveCompanyId($request);

        $categoryTypeParam = $request->query('category_type');
        $includeYoY = $request->has('include_yoy') ? $request->boolean('include_yoy') : true;

        $query = new GetCategoryBreakdownQuery(
            companyId: $companyId,
            startDate: $request->query('start_date'),
            endDate: $request->query('end_date'),
            recordType: (string) $request->query('record_type', 'EXPENSE'),
            currency: (string) $request->query('currency', 'PLN'),
            categoryType: $categoryTypeParam !== null ? (string) $categoryTypeParam : null,
            includeYoY: $includeYoY,
            comparisonStartDate: $request->query('comparison_start_date'),
            comparisonEndDate: $request->query('comparison_end_date')
        );

        $breakdown = $handler->handle($query);

        $responsePayload = [
            'status' => 'success',
            'company_id' => $companyId,
            'record_type' => strtoupper((string) $request->query('record_type', 'EXPENSE')),
            'include_yoy' => $includeYoY,
            'data' => $breakdown,
        ];

        if ($categoryTypeParam !== null) {
            $responsePayload['category_type'] = strtoupper((string) $categoryTypeParam);
        }

        return new JsonResponse($responsePayload, Response::HTTP_OK);
    }

    /**
     * Get liquidity trends (Current Ratio, Quick Ratio, Balances) over time.
     */
    public function liquidity(
        FinancialAnalyticsQueryRequest $request,
        GetLiquidityTrendsHandler $handler
    ): JsonResponse {
        $companyId = $this->resolveCompanyId($request);

        $query = new GetLiquidityTrendsQuery(
            companyId: $companyId,
            startDate: $request->query('start_date'),
            endDate: $request->query('end_date'),
            currency: (string) $request->query('currency', 'PLN')
        );

        $trends = $handler->handle($query);

        return new JsonResponse([
            'status' => 'success',
            'company_id' => $companyId,
            'count' => count($trends),
            'data' => $trends,
        ], Response::HTTP_OK);
    }
}
