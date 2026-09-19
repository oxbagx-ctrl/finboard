<?php

declare(strict_types=1);

namespace App\Presentation\Api\Controllers;

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
     * Get category breakdown distribution for pie / donut charts.
     */
    public function breakdown(
        FinancialAnalyticsQueryRequest $request,
        GetCategoryBreakdownHandler $handler
    ): JsonResponse {
        $companyId = $this->resolveCompanyId($request);

        $query = new GetCategoryBreakdownQuery(
            companyId: $companyId,
            startDate: $request->query('start_date'),
            endDate: $request->query('end_date'),
            recordType: (string) $request->query('record_type', 'EXPENSE'),
            currency: (string) $request->query('currency', 'PLN')
        );

        $breakdown = $handler->handle($query);

        return new JsonResponse([
            'status' => 'success',
            'company_id' => $companyId,
            'record_type' => strtoupper((string) $request->query('record_type', 'EXPENSE')),
            'data' => $breakdown,
        ], Response::HTTP_OK);
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
