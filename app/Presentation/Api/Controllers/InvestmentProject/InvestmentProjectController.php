<?php

declare(strict_types=1);

namespace App\Presentation\Api\Controllers\InvestmentProject;

use App\Contexts\InvestmentProject\Application\Commands\InitializeInvestmentProject\InitializeInvestmentProjectCommand;
use App\Contexts\InvestmentProject\Application\Commands\InitializeInvestmentProject\InitializeInvestmentProjectHandler;
use App\Contexts\InvestmentProject\Domain\Repositories\InvestmentProjectRepositoryInterface;
use App\Contexts\InvestmentProject\Domain\ValueObjects\InvestmentProjectId;
use App\Models\InvestmentProject as InvestmentProjectModel;
use App\Presentation\Api\Requests\InvestmentProject\StoreInvestmentProjectRequest;
use App\Presentation\Api\Requests\InvestmentProject\UpdateInvestmentProjectRequest;
use App\Presentation\Api\Resources\InvestmentProject\InvestmentProjectResource;
use App\Presentation\Api\Traits\ResolvesCompanyContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final class InvestmentProjectController
{
    use ResolvesCompanyContext;

    public function __construct(
        private readonly InvestmentProjectRepositoryInterface $repository
    ) {
    }

    /**
     * Get list of investment projects for the authenticated company context.
     */
    public function index(Request $request): JsonResponse
    {
        $companyId = $this->resolveCompanyId($request);

        $query = InvestmentProjectModel::query()
            ->forCompany($companyId)
            ->with(['capexStages', 'financingStructure', 'debtFacilities'])
            ->orderBy('created_at', 'desc');

        if ($request->has('status') && is_string($request->query('status'))) {
            $query->byStatus((string) $request->query('status'));
        }

        $projects = $query->get();

        return new JsonResponse([
            'status' => 'success',
            'company_id' => $companyId,
            'count' => $projects->count(),
            'data' => InvestmentProjectResource::collection($projects)->resolve(),
        ], Response::HTTP_OK);
    }

    /**
     * Initialize a new investment project via CQRS command handler.
     */
    public function store(
        StoreInvestmentProjectRequest $request,
        InitializeInvestmentProjectHandler $handler
    ): JsonResponse {
        $companyId = $this->resolveCompanyId($request);
        $validated = $request->validated();

        $command = new InitializeInvestmentProjectCommand(
            companyId: $companyId,
            name: (string) $validated['name'],
            description: (string) ($validated['description'] ?? ''),
            startDate: (string) $validated['start_date'],
            planningHorizonYears: (int) ($validated['planning_horizon_years'] ?? 15),
            currency: (string) ($validated['currency'] ?? 'PLN'),
            equityContribution: (string) ($validated['equity_contribution'] ?? '0.0000'),
            grantAmount: (string) ($validated['grant_amount'] ?? '0.0000'),
            grantIntensityPercent: (float) ($validated['grant_intensity_percent'] ?? 0.0),
            vatBridgeLoan: (string) ($validated['vat_bridge_loan'] ?? '0.0000'),
            bankLoanPrincipal: (string) ($validated['bank_loan_principal'] ?? '0.0000'),
            bankBaseRate: (float) ($validated['bank_base_rate'] ?? 5.85),
            bankMargin: (float) ($validated['bank_margin'] ?? 2.00),
            bankTenorMonths: (int) ($validated['bank_tenor_months'] ?? 120),
            bankGracePeriodMonths: (int) ($validated['bank_grace_period_months'] ?? 0),
            amortizationType: strtoupper((string) ($validated['amortization_type'] ?? 'ANNUITY')),
            upfrontFeeRate: (float) ($validated['upfront_fee_rate'] ?? 0.0),
            vatRatePercent: (float) ($validated['vat_rate_percent'] ?? 23.0),
            dso: (int) ($validated['dso'] ?? 30),
            dpo: (int) ($validated['dpo'] ?? 30),
            dio: (int) ($validated['dio'] ?? 0),
            capitalizationRatePercent: (float) ($validated['capitalization_rate_percent'] ?? 7.5),
            valuationMultiple: (float) ($validated['valuation_multiple'] ?? 8.0)
        );

        $projectId = $handler->handle($command);

        $projectModel = InvestmentProjectModel::query()
            ->with(['capexStages', 'financingStructure', 'debtFacilities'])
            ->where('company_id', $companyId)
            ->findOrFail($projectId);

        return new JsonResponse([
            'status' => 'success',
            'message' => 'Projekt inwestycyjny został pomyślnie zainicjalizowany.',
            'data' => (new InvestmentProjectResource($projectModel))->resolve(),
        ], Response::HTTP_CREATED);
    }

    /**
     * Get investment project details with full financial structure.
     */
    public function show(Request $request, string $id): JsonResponse
    {
        $companyId = $this->resolveCompanyId($request);

        $projectModel = InvestmentProjectModel::query()
            ->with(['capexStages', 'financingStructure', 'debtFacilities', 'grantAllocations'])
            ->where('company_id', $companyId)
            ->findOrFail($id);

        return new JsonResponse([
            'status' => 'success',
            'data' => (new InvestmentProjectResource($projectModel))->resolve(),
        ], Response::HTTP_OK);
    }

    /**
     * Update investment project baseline parameters.
     */
    public function update(UpdateInvestmentProjectRequest $request, string $id): JsonResponse
    {
        $companyId = $this->resolveCompanyId($request);
        $validated = $request->validated();

        $projectModel = InvestmentProjectModel::query()
            ->where('company_id', $companyId)
            ->findOrFail($id);

        $projectModel->update(array_filter([
            'name' => $validated['name'] ?? null,
            'description' => $validated['description'] ?? null,
            'status' => $validated['status'] ?? null,
            'commercial_operation_date' => $validated['commercial_operation_date'] ?? null,
        ], fn ($val) => $val !== null));

        $projectModel->load(['capexStages', 'financingStructure', 'debtFacilities']);

        return new JsonResponse([
            'status' => 'success',
            'message' => 'Projekt inwestycyjny został zaktualizowany.',
            'data' => (new InvestmentProjectResource($projectModel))->resolve(),
        ], Response::HTTP_OK);
    }

    /**
     * Delete investment project and its cascade dependencies.
     */
    public function destroy(Request $request, string $id): JsonResponse
    {
        $companyId = $this->resolveCompanyId($request);

        $this->repository->delete(InvestmentProjectId::fromString($id), $companyId);

        return new JsonResponse([
            'status' => 'success',
            'message' => 'Projekt inwestycyjny został pomyślnie usunięty.',
        ], Response::HTTP_OK);
    }
}
