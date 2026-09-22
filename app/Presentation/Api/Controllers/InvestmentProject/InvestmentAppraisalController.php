<?php

declare(strict_types=1);

namespace App\Presentation\Api\Controllers\InvestmentProject;

use App\Contexts\InvestmentProject\Domain\Model\InvestmentProject;
use App\Contexts\InvestmentProject\Domain\Repositories\InvestmentProjectRepositoryInterface;
use App\Contexts\InvestmentProject\Domain\Services\BalanceSheetService;
use App\Contexts\InvestmentProject\Domain\Services\CashFlowService;
use App\Contexts\InvestmentProject\Domain\Services\DepreciationScheduleService;
use App\Contexts\InvestmentProject\Domain\Services\EquityWaterfallSolverService;
use App\Contexts\InvestmentProject\Domain\Services\IncomeStatementService;
use App\Contexts\InvestmentProject\Domain\Services\InvestmentAppraisalService;
use App\Contexts\InvestmentProject\Domain\Services\WaccCalculatorService;
use App\Contexts\InvestmentProject\Domain\ValueObjects\InvestmentProjectId;
use App\Contexts\InvestmentProject\Domain\ValueObjects\OperatingAssumptions;
use App\Contexts\InvestmentProject\Domain\ValueObjects\TerminalValueMethod;
use App\Contexts\InvestmentProject\Domain\ValueObjects\WaccParameters;
use App\Contexts\InvestmentProject\Domain\ValueObjects\WaterfallStructure;
use App\Presentation\Api\Requests\InvestmentProject\InvestmentAppraisalQueryRequest;
use App\Presentation\Api\Requests\InvestmentProject\InvestmentWaterfallQueryRequest;
use App\Presentation\Api\Traits\ResolvesCompanyContext;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

final class InvestmentAppraisalController
{
    use ResolvesCompanyContext;

    public function __construct(
        private readonly InvestmentProjectRepositoryInterface $repository,
        private readonly InvestmentAppraisalService $appraisalService,
        private readonly EquityWaterfallSolverService $waterfallService,
        private readonly WaccCalculatorService $waccService,
        private readonly IncomeStatementService $incomeService,
        private readonly BalanceSheetService $balanceSheetService,
        private readonly CashFlowService $cashFlowService,
        private readonly DepreciationScheduleService $depreciationService
    ) {
    }

    /**
     * Calculate comprehensive DCF valuation, Enterprise/Equity KPI metrics (NPV, IRR, TV, Payback).
     */
    public function appraisal(InvestmentAppraisalQueryRequest $request, string $id): JsonResponse
    {
        $companyId = $this->resolveCompanyId($request);
        $project = $this->getProject($id, $companyId);

        $validated = $request->validated();
        $horizonYears = (int) ($validated['horizon_years'] ?? $project->planningHorizonYears());
        $assumptions = $this->resolveAssumptions($project, $validated);

        // Generate 3-statement foundation
        $depSchedule = $this->depreciationService->generateSchedule($project, $horizonYears);
        $incomeStatement = $this->incomeService->generateStatement($project, $assumptions, $horizonYears, $depSchedule);
        $cashFlow = $this->cashFlowService->generateStatement($project, $assumptions, $horizonYears, $incomeStatement, $depSchedule);
        $balanceSheet = $this->balanceSheetService->generateStatement($project, $assumptions, $horizonYears, $cashFlow, $incomeStatement, $depSchedule);

        // Terminal value method & parameter
        $tvMethod = isset($validated['tv_method'])
            ? (TerminalValueMethod::tryFrom(strtolower((string) $validated['tv_method']))
                ?? TerminalValueMethod::tryFrom(strtoupper((string) $validated['tv_method'])))
            : null;
        $tvParameter = isset($validated['tv_parameter']) ? (float) $validated['tv_parameter'] : null;

        // Custom WACC parameters override if specified
        $waccResult = null;
        if (isset($validated['risk_free_rate_percent']) || isset($validated['cost_of_equity_percent'])) {
            $waccParams = new WaccParameters(
                riskFreeRatePercent: (float) ($validated['risk_free_rate_percent'] ?? 5.50),
                equityRiskPremiumPercent: (float) ($validated['equity_risk_premium_percent'] ?? 6.00),
                beta: (float) ($validated['levered_beta'] ?? 1.10),
                costOfEquityOverridePercent: isset($validated['cost_of_equity_percent']) ? (float) $validated['cost_of_equity_percent'] : null
            );
            $waccResult = $this->waccService->calculateFromProject($project, $waccParams);
        }

        $appraisalResult = $this->appraisalService->appraise(
            project: $project,
            incomeStatement: $incomeStatement,
            cashFlowStatement: $cashFlow,
            balanceSheet: $balanceSheet,
            wacc: $waccResult,
            dynamicWacc: null,
            tvMethod: $tvMethod,
            tvParameter: $tvParameter
        );

        return new JsonResponse([
            'status' => 'success',
            'project_id' => $id,
            'horizon_years' => $horizonYears,
            'data' => $appraisalResult->toArray(),
        ], Response::HTTP_OK);
    }

    /**
     * Simulate multi-tier equity waterfall distribution with numerical target IRR solver.
     */
    public function waterfall(InvestmentWaterfallQueryRequest $request, string $id): JsonResponse
    {
        $companyId = $this->resolveCompanyId($request);
        $project = $this->getProject($id, $companyId);

        $validated = $request->validated();
        $horizonYears = (int) ($validated['horizon_years'] ?? $project->planningHorizonYears());
        $assumptions = $this->resolveAssumptions($project, $validated);

        // 3-statement & appraisal execution
        $depSchedule = $this->depreciationService->generateSchedule($project, $horizonYears);
        $incomeStatement = $this->incomeService->generateStatement($project, $assumptions, $horizonYears, $depSchedule);
        $cashFlow = $this->cashFlowService->generateStatement($project, $assumptions, $horizonYears, $incomeStatement, $depSchedule);
        $balanceSheet = $this->balanceSheetService->generateStatement($project, $assumptions, $horizonYears, $cashFlow, $incomeStatement, $depSchedule);

        $tvMethod = isset($validated['tv_method'])
            ? (TerminalValueMethod::tryFrom(strtolower((string) $validated['tv_method']))
                ?? TerminalValueMethod::tryFrom(strtoupper((string) $validated['tv_method'])))
            : null;
        $tvParameter = isset($validated['tv_parameter']) ? (float) $validated['tv_parameter'] : null;

        $appraisalResult = $this->appraisalService->appraise(
            project: $project,
            incomeStatement: $incomeStatement,
            cashFlowStatement: $cashFlow,
            balanceSheet: $balanceSheet,
            wacc: null,
            dynamicWacc: null,
            tvMethod: $tvMethod,
            tvParameter: $tvParameter
        );

        // Check if numerical target IRR solver is requested
        if (isset($validated['target_irr_percent'])) {
            $targetIrr = (float) $validated['target_irr_percent'];
            $hurdle1 = (float) ($validated['hurdle_1_irr_percent'] ?? 8.0);

            $waterfallResult = $this->waterfallService->solveForTargetIrr(
                project: $project,
                appraisal: $appraisalResult,
                targetIrrInvestor2: $targetIrr,
                hurdle1: $hurdle1
            );
        } else {
            // Build requested waterfall structure or fallback to Pari Passu
            $inv1Share = $project->financingStructure()->investor1Share();
            $inv2Share = $project->financingStructure()->investor2Share();

            $structType = strtoupper((string) ($validated['structure_type'] ?? 'PARI_PASSU'));
            $structure = match ($structType) {
                'TWO_TIER' => WaterfallStructure::standardTwoTier(
                    hurdleRatePercent: (float) ($validated['hurdle_1_irr_percent'] ?? 8.0),
                    sponsorPromotePercent: (float) ($validated['tier_2_investor1_share'] ?? 20.0),
                    investor1SharePercent: $inv1Share,
                    investor2SharePercent: $inv2Share
                ),
                'THREE_TIER' => WaterfallStructure::standardThreeTier(
                    hurdle1Percent: (float) ($validated['hurdle_1_irr_percent'] ?? 8.0),
                    promote1Percent: (float) ($validated['tier_2_investor1_share'] ?? 20.0),
                    hurdle2Percent: (float) ($validated['hurdle_2_irr_percent'] ?? 15.0),
                    promote2Percent: (float) ($validated['tier_3_investor1_share'] ?? 35.0),
                    investor1SharePercent: $inv1Share,
                    investor2SharePercent: $inv2Share
                ),
                default => WaterfallStructure::pariPassu($inv1Share, $inv2Share),
            };

            $waterfallResult = $this->waterfallService->solve(
                project: $project,
                appraisal: $appraisalResult,
                structure: $structure
            );
        }

        return new JsonResponse([
            'status' => 'success',
            'project_id' => $id,
            'horizon_years' => $horizonYears,
            'data' => $waterfallResult->toArray(),
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
