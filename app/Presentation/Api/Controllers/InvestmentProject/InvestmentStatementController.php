<?php

declare(strict_types=1);

namespace App\Presentation\Api\Controllers\InvestmentProject;

use App\Contexts\Finance\Domain\ValueObjects\Currency;
use App\Contexts\InvestmentProject\Domain\Model\InvestmentProject;
use App\Contexts\InvestmentProject\Domain\Repositories\InvestmentProjectRepositoryInterface;
use App\Contexts\InvestmentProject\Domain\Services\BalanceSheetService;
use App\Contexts\InvestmentProject\Domain\Services\CashFlowService;
use App\Contexts\InvestmentProject\Domain\Services\DepreciationScheduleService;
use App\Contexts\InvestmentProject\Domain\Services\IncomeStatementService;
use App\Contexts\InvestmentProject\Domain\ValueObjects\InvestmentProjectId;
use App\Contexts\InvestmentProject\Domain\ValueObjects\OperatingAssumptions;
use App\Presentation\Api\Requests\InvestmentProject\InvestmentStatementQueryRequest;
use App\Presentation\Api\Traits\ResolvesCompanyContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

final class InvestmentStatementController
{
    use ResolvesCompanyContext;

    public function __construct(
        private readonly InvestmentProjectRepositoryInterface $repository,
        private readonly IncomeStatementService $incomeService,
        private readonly BalanceSheetService $balanceSheetService,
        private readonly CashFlowService $cashFlowService,
        private readonly DepreciationScheduleService $depreciationService
    ) {
    }

    /**
     * Get complete 15-year 3-statement financial model (Income Statement, Balance Sheet, Cash Flow, Depreciation).
     */
    public function threeStatement(InvestmentStatementQueryRequest $request, string $id): JsonResponse
    {
        $companyId = $this->resolveCompanyId($request);
        $project = $this->getProject($id, $companyId);

        $validated = $request->validated();
        $horizonYears = (int) ($validated['horizon_years'] ?? $project->planningHorizonYears());
        $assumptions = $this->resolveAssumptions($project, $validated);

        $depSchedule = $this->depreciationService->generateSchedule($project, $horizonYears);
        $incomeStatement = $this->incomeService->generateStatement($project, $assumptions, $horizonYears, $depSchedule);
        $cashFlow = $this->cashFlowService->generateStatement($project, $assumptions, $horizonYears, $incomeStatement, $depSchedule);
        $balanceSheet = $this->balanceSheetService->generateStatement($project, $assumptions, $horizonYears, $cashFlow, $incomeStatement, $depSchedule);

        return new JsonResponse([
            'status' => 'success',
            'project_id' => $id,
            'horizon_years' => $horizonYears,
            'data' => [
                'income_statement' => $incomeStatement->toArray(),
                'balance_sheet' => $balanceSheet->toArray(),
                'cash_flow_statement' => $cashFlow->toArray(),
                'depreciation_schedule' => $depSchedule->toArray(),
            ],
        ], Response::HTTP_OK);
    }

    /**
     * Get 15-year monthly and annual Income Statement (P&L).
     */
    public function incomeStatement(InvestmentStatementQueryRequest $request, string $id): JsonResponse
    {
        $companyId = $this->resolveCompanyId($request);
        $project = $this->getProject($id, $companyId);

        $validated = $request->validated();
        $horizonYears = (int) ($validated['horizon_years'] ?? $project->planningHorizonYears());
        $assumptions = $this->resolveAssumptions($project, $validated);

        $depSchedule = $this->depreciationService->generateSchedule($project, $horizonYears);
        $incomeStatement = $this->incomeService->generateStatement($project, $assumptions, $horizonYears, $depSchedule);

        return new JsonResponse([
            'status' => 'success',
            'project_id' => $id,
            'horizon_years' => $horizonYears,
            'data' => $incomeStatement->toArray(),
        ], Response::HTTP_OK);
    }

    /**
     * Get 15-year monthly and annual Balance Sheet with zero-variance validation.
     */
    public function balanceSheet(InvestmentStatementQueryRequest $request, string $id): JsonResponse
    {
        $companyId = $this->resolveCompanyId($request);
        $project = $this->getProject($id, $companyId);

        $validated = $request->validated();
        $horizonYears = (int) ($validated['horizon_years'] ?? $project->planningHorizonYears());
        $assumptions = $this->resolveAssumptions($project, $validated);

        $depSchedule = $this->depreciationService->generateSchedule($project, $horizonYears);
        $incomeStatement = $this->incomeService->generateStatement($project, $assumptions, $horizonYears, $depSchedule);
        $cashFlow = $this->cashFlowService->generateStatement($project, $assumptions, $horizonYears, $incomeStatement, $depSchedule);
        $balanceSheet = $this->balanceSheetService->generateStatement($project, $assumptions, $horizonYears, $cashFlow, $incomeStatement, $depSchedule);

        return new JsonResponse([
            'status' => 'success',
            'project_id' => $id,
            'horizon_years' => $horizonYears,
            'data' => $balanceSheet->toArray(),
        ], Response::HTTP_OK);
    }

    /**
     * Get 15-year monthly and annual Cash Flow Statement (indirect method).
     */
    public function cashFlow(InvestmentStatementQueryRequest $request, string $id): JsonResponse
    {
        $companyId = $this->resolveCompanyId($request);
        $project = $this->getProject($id, $companyId);

        $validated = $request->validated();
        $horizonYears = (int) ($validated['horizon_years'] ?? $project->planningHorizonYears());
        $assumptions = $this->resolveAssumptions($project, $validated);

        $depSchedule = $this->depreciationService->generateSchedule($project, $horizonYears);
        $incomeStatement = $this->incomeService->generateStatement($project, $assumptions, $horizonYears, $depSchedule);
        $cashFlow = $this->cashFlowService->generateStatement($project, $assumptions, $horizonYears, $incomeStatement, $depSchedule);

        return new JsonResponse([
            'status' => 'success',
            'project_id' => $id,
            'horizon_years' => $horizonYears,
            'data' => $cashFlow->toArray(),
        ], Response::HTTP_OK);
    }

    /**
     * Get asset depreciation schedule based on KŚT classification codes.
     */
    public function depreciation(Request $request, string $id): JsonResponse
    {
        $companyId = $this->resolveCompanyId($request);
        $project = $this->getProject($id, $companyId);

        $horizonYears = (int) ($request->query('horizon_years') ?? $project->planningHorizonYears());
        $depSchedule = $this->depreciationService->generateSchedule($project, $horizonYears);

        return new JsonResponse([
            'status' => 'success',
            'project_id' => $id,
            'horizon_years' => $horizonYears,
            'data' => $depSchedule->toArray(),
        ], Response::HTTP_OK);
    }

    private function getProject(string $id, string $companyId): InvestmentProject
    {
        $project = $this->repository->findById(InvestmentProjectId::fromString($id), $companyId);
        if ($project === null) {
            throw new NotFoundHttpException('Projekt inwestycyjny nie został odnaleziony.');
        }

        return $project;
    }

    /**
     * @param array<string, mixed> $data
     */
    private function resolveAssumptions(InvestmentProject $project, array $data): OperatingAssumptions
    {
        $currency = $project->financingStructure()->totalEquity()->currency();

        if (empty($data['annual_revenue_base']) || (float) $data['annual_revenue_base'] <= 0) {
            $capexTotal = (float) $project->budget()->netCapex()->amount();
            $data['annual_revenue_base'] = $capexTotal > 0 ? (string) ($capexTotal * 0.5) : '1000000.0000';
        }

        return OperatingAssumptions::fromArray($data, $currency);
    }
}
