<?php

declare(strict_types=1);

namespace App\Presentation\Api\Controllers\InvestmentProject;

use App\Contexts\InvestmentProject\Application\Commands\AddCapexStage\AddCapexStageCommand;
use App\Contexts\InvestmentProject\Application\Commands\AddCapexStage\AddCapexStageHandler;
use App\Contexts\InvestmentProject\Application\Commands\RemoveCapexStage\RemoveCapexStageCommand;
use App\Contexts\InvestmentProject\Application\Commands\RemoveCapexStage\RemoveCapexStageHandler;
use App\Contexts\InvestmentProject\Application\Commands\UpdateCapexStage\UpdateCapexStageCommand;
use App\Contexts\InvestmentProject\Application\Commands\UpdateCapexStage\UpdateCapexStageHandler;
use App\Contexts\InvestmentProject\Application\Exceptions\CapexStageNotFoundException;
use App\Contexts\InvestmentProject\Application\Exceptions\InvestmentProjectNotFoundException;
use App\Models\InvestmentCapexStage;
use App\Models\InvestmentProject as InvestmentProjectModel;
use App\Presentation\Api\Requests\InvestmentProject\StoreCapexStageRequest;
use App\Presentation\Api\Requests\InvestmentProject\UpdateCapexStageRequest;
use App\Presentation\Api\Resources\InvestmentProject\CapexStageResource;
use App\Presentation\Api\Traits\ResolvesCompanyContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

final class InvestmentCapexStageController
{
    use ResolvesCompanyContext;

    /**
     * Add a new CAPEX stage to the investment project.
     */
    public function store(
        StoreCapexStageRequest $request,
        string $projectId,
        AddCapexStageHandler $handler
    ): JsonResponse {
        $companyId = $this->resolveCompanyId($request);

        InvestmentProjectModel::query()
            ->where('company_id', $companyId)
            ->findOrFail($projectId);

        $validated = $request->validated();

        $command = new AddCapexStageCommand(
            projectId: $projectId,
            companyId: $companyId,
            stageName: (string) $validated['stage_name'],
            netAmount: (string) $validated['net_amount'],
            currency: (string) ($validated['currency'] ?? 'PLN'),
            startDate: isset($validated['start_date']) ? (string) $validated['start_date'] : null,
            durationMonths: (int) ($validated['duration_months'] ?? 1),
            kstCode: isset($validated['kst_code']) ? (string) $validated['kst_code'] : null,
            isGrantEligible: (bool) ($validated['is_grant_eligible'] ?? false),
            grantEligibleAmount: isset($validated['grant_eligible_amount']) ? (string) $validated['grant_eligible_amount'] : null,
            stageOrder: (int) ($validated['stage_order'] ?? 1)
        );

        try {
            $stageId = $handler->handle($command);
        } catch (InvestmentProjectNotFoundException | CapexStageNotFoundException $e) {
            throw new NotFoundHttpException($e->getMessage(), $e);
        }

        $stageModel = InvestmentCapexStage::query()
            ->where('project_id', $projectId)
            ->where('company_id', $companyId)
            ->findOrFail($stageId);

        return new JsonResponse([
            'status' => 'success',
            'message' => 'Etap CAPEX został pomyślnie dodany do projektu.',
            'data' => (new CapexStageResource($stageModel))->resolve(),
        ], Response::HTTP_CREATED);
    }

    /**
     * Update existing CAPEX stage parameters.
     */
    public function update(
        UpdateCapexStageRequest $request,
        string $projectId,
        string $stageId,
        UpdateCapexStageHandler $handler
    ): JsonResponse {
        $companyId = $this->resolveCompanyId($request);

        InvestmentProjectModel::query()
            ->where('company_id', $companyId)
            ->findOrFail($projectId);

        $validated = $request->validated();

        $command = new UpdateCapexStageCommand(
            projectId: $projectId,
            companyId: $companyId,
            stageId: $stageId,
            stageName: (string) $validated['stage_name'],
            netAmount: (string) $validated['net_amount'],
            currency: (string) ($validated['currency'] ?? 'PLN'),
            startDate: isset($validated['start_date']) ? (string) $validated['start_date'] : null,
            durationMonths: (int) ($validated['duration_months'] ?? 1),
            kstCode: isset($validated['kst_code']) ? (string) $validated['kst_code'] : null,
            isGrantEligible: (bool) ($validated['is_grant_eligible'] ?? false),
            grantEligibleAmount: isset($validated['grant_eligible_amount']) ? (string) $validated['grant_eligible_amount'] : null,
            stageOrder: (int) ($validated['stage_order'] ?? 1)
        );

        try {
            $handler->handle($command);
        } catch (InvestmentProjectNotFoundException | CapexStageNotFoundException $e) {
            throw new NotFoundHttpException($e->getMessage(), $e);
        }

        $stageModel = InvestmentCapexStage::query()
            ->where('project_id', $projectId)
            ->where('company_id', $companyId)
            ->findOrFail($stageId);

        return new JsonResponse([
            'status' => 'success',
            'message' => 'Etap CAPEX został pomyślnie zaktualizowany.',
            'data' => (new CapexStageResource($stageModel))->resolve(),
        ], Response::HTTP_OK);
    }

    /**
     * Remove CAPEX stage from the investment project.
     */
    public function destroy(
        Request $request,
        string $projectId,
        string $stageId,
        RemoveCapexStageHandler $handler
    ): JsonResponse {
        $companyId = $this->resolveCompanyId($request);

        InvestmentProjectModel::query()
            ->where('company_id', $companyId)
            ->findOrFail($projectId);

        $command = new RemoveCapexStageCommand(
            projectId: $projectId,
            companyId: $companyId,
            stageId: $stageId
        );

        try {
            $handler->handle($command);
        } catch (InvestmentProjectNotFoundException | CapexStageNotFoundException $e) {
            throw new NotFoundHttpException($e->getMessage(), $e);
        }

        return new JsonResponse([
            'status' => 'success',
            'message' => 'Etap CAPEX został pomyślnie usunięty.',
        ], Response::HTTP_OK);
    }
}
