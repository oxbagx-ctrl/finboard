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

        // Update or create financing structure
        $hasFsFields = isset($validated['equity_contribution'])
            || isset($validated['bank_loan_principal'])
            || isset($validated['grant_amount'])
            || isset($validated['vat_bridge_loan']);

        if ($hasFsFields) {
            $fs = $projectModel->financingStructure;
            $fsData = [];
            if (isset($validated['equity_contribution'])) {
                $fsData['equity_contribution'] = (string) $validated['equity_contribution'];
            }
            if (isset($validated['bank_loan_principal'])) {
                $fsData['bank_loan_amount'] = (string) $validated['bank_loan_principal'];
            }
            if (isset($validated['grant_amount'])) {
                $fsData['grant_amount'] = (string) $validated['grant_amount'];
            }
            if (isset($validated['vat_bridge_loan'])) {
                $fsData['vat_bridge_loan'] = (string) $validated['vat_bridge_loan'];
            }

            if ($fs) {
                $fs->update($fsData);
            } else {
                $projectModel->financingStructure()->create(array_merge([
                    'company_id' => $companyId,
                    'currency' => $projectModel->currency ?? 'PLN',
                    'equity_contribution' => '0.0000',
                    'bank_loan_amount' => '0.0000',
                    'grant_amount' => '0.0000',
                    'vat_bridge_loan' => '0.0000',
                ], $fsData));
            }
        }

        // Update or create debt facility
        $hasDfFields = isset($validated['bank_loan_principal'])
            || isset($validated['bank_base_rate'])
            || isset($validated['bank_margin'])
            || isset($validated['bank_tenor_months'])
            || isset($validated['bank_grace_period_months'])
            || isset($validated['amortization_type'])
            || isset($validated['upfront_fee_rate'])
            || isset($validated['facility_name'])
            || isset($validated['base_rate_type']);

        if ($hasDfFields) {
            $df = $projectModel->debtFacilities()->first();
            $dfData = [];
            if (isset($validated['bank_loan_principal'])) {
                $dfData['principal_amount'] = (string) $validated['bank_loan_principal'];
            }
            if (isset($validated['bank_base_rate'])) {
                $dfData['base_rate_percent'] = (string) $validated['bank_base_rate'];
            }
            if (isset($validated['bank_margin'])) {
                $dfData['margin_percent'] = (string) $validated['bank_margin'];
            }
            if (isset($validated['bank_tenor_months'])) {
                $dfData['tenor_months'] = (int) $validated['bank_tenor_months'];
            }
            if (isset($validated['bank_grace_period_months'])) {
                $dfData['grace_period_months'] = (int) $validated['bank_grace_period_months'];
            }
            if (isset($validated['amortization_type'])) {
                $dfData['amortization_type'] = strtoupper((string) $validated['amortization_type']);
            }
            if (isset($validated['upfront_fee_rate'])) {
                $dfData['upfront_fee_percent'] = (string) $validated['upfront_fee_rate'];
            }
            if (isset($validated['facility_name'])) {
                $dfData['facility_name'] = (string) $validated['facility_name'];
            }
            if (isset($validated['base_rate_type'])) {
                $dfData['base_rate_type'] = (string) $validated['base_rate_type'];
            }

            if ($df) {
                $df->update($dfData);
            } else if (!empty($dfData)) {
                $projectModel->debtFacilities()->create(array_merge([
                    'company_id' => $companyId,
                    'facility_name' => 'Kredyt Bankowy Senior Debt',
                    'facility_type' => 'term_loan',
                    'principal_amount' => '0.0000',
                    'currency' => $projectModel->currency ?? 'PLN',
                    'base_rate_type' => 'WIBOR_3M',
                    'base_rate_percent' => '5.8500',
                    'margin_percent' => '2.0000',
                    'tenor_months' => 120,
                    'grace_period_months' => 0,
                    'amortization_type' => 'ANNUITY',
                    'upfront_fee_percent' => '0.00',
                    'commitment_fee_percent' => '0.00',
                ], $dfData));
            }
        }

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

        InvestmentProjectModel::query()
            ->where('company_id', $companyId)
            ->findOrFail($id);

        $this->repository->delete(InvestmentProjectId::fromString($id), $companyId);

        return new JsonResponse([
            'status' => 'success',
            'message' => 'Projekt inwestycyjny został pomyślnie usunięty.',
        ], Response::HTTP_OK);
    }
}
