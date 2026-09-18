<?php

declare(strict_types=1);

namespace App\Presentation\Api\Controllers;

use App\Contexts\Tenant\Application\Commands\AssignAdvisorToCompanyCommand;
use App\Contexts\Tenant\Application\Commands\RevokeAdvisorFromCompanyCommand;
use App\Contexts\Tenant\Application\Exceptions\AdvisorNotFoundException;
use App\Contexts\Tenant\Application\Exceptions\CompanyNotFoundException;
use App\Contexts\Tenant\Application\Exceptions\TargetUserNotAdvisorException;
use App\Contexts\Tenant\Application\Exceptions\UnauthorizedAssignmentException;
use App\Contexts\Tenant\Application\UseCases\AssignAdvisorToCompanyUseCase;
use App\Contexts\Tenant\Application\UseCases\RevokeAdvisorFromCompanyUseCase;
use App\Models\Company;
use App\Models\User;
use App\Presentation\Api\Requests\AssignCompanyRequest;
use App\Presentation\Api\Requests\SyncAdvisorCompaniesRequest;
use App\Presentation\Api\Resources\AdvisorResource;
use App\Presentation\Api\Resources\CompanyAssignmentResource;
use DomainException;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Routing\Controller;
use InvalidArgumentException;
use Symfony\Component\HttpFoundation\Response;

final class AdvisorManagementController extends Controller
{
    /**
     * List all advisors with assigned companies and filtering.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $query = User::query()
            ->with(['assignedCompanies'])
            ->withCount('sentInvitations');

        // Role filter (default to advisors, or all staff if specified)
        if ($request->filled('role')) {
            $role = (string) $request->query('role');
            if ($role === 'all') {
                $query->whereIn('role', ['advisor', 'admin', 'super_admin']);
            } else {
                $query->where('role', $role);
            }
        } else {
            $query->whereIn('role', ['advisor', 'admin', 'super_admin']);
        }

        // Status filter
        if ($request->has('is_active')) {
            $query->where('is_active', filter_var($request->query('is_active'), FILTER_VALIDATE_BOOLEAN));
        }

        // Search by name or email
        if ($request->filled('search')) {
            $search = '%' . strtolower(trim((string) $request->query('search'))) . '%';
            $query->where(function (Builder $q) use ($search) {
                $q->whereRaw('LOWER(name) LIKE ?', [$search])
                    ->orWhereRaw('LOWER(email) LIKE ?', [$search]);
            });
        }

        // Filter by assigned company
        if ($request->filled('company_id')) {
            $companyId = (string) $request->query('company_id');
            $query->whereHas('assignedCompanies', function (Builder $q) use ($companyId) {
                $q->where('companies.id', $companyId);
            });
        }

        $advisors = $query
            ->orderBy('name', 'asc')
            ->paginate($request->integer('per_page', 50));

        return AdvisorResource::collection($advisors);
    }

    /**
     * Retrieve single advisor details and assigned companies.
     */
    public function show(string $id): AdvisorResource|JsonResponse
    {
        $advisor = User::with(['assignedCompanies'])
            ->withCount('sentInvitations')
            ->find($id);

        if ($advisor === null || (!$advisor->isAdvisor() && !$advisor->isAdmin())) {
            return new JsonResponse([
                'message' => 'Doradca nie został odnaleziony.',
            ], Response::HTTP_NOT_FOUND);
        }

        return new AdvisorResource($advisor);
    }

    /**
     * Assign one or multiple companies to the advisor.
     */
    public function assignCompany(
        AssignCompanyRequest $request,
        string $id,
        AssignAdvisorToCompanyUseCase $useCase
    ): JsonResponse {
        /** @var User $currentUser */
        $currentUser = $request->user();

        $advisor = User::find($id);
        if ($advisor === null || (!$advisor->isAdvisor() && !$advisor->isAdmin())) {
            return new JsonResponse([
                'message' => 'Wskazany doradca nie istnieje.',
            ], Response::HTTP_NOT_FOUND);
        }

        $companyIds = $request->has('company_ids')
            ? (array) $request->input('company_ids')
            : [(string) $request->input('company_id')];

        try {
            foreach ($companyIds as $companyId) {
                $command = new AssignAdvisorToCompanyCommand(
                    companyId: (string) $companyId,
                    advisorId: (string) $advisor->id,
                    assignedById: (string) $currentUser->id
                );
                $useCase->execute($command);
            }
        } catch (AdvisorNotFoundException|CompanyNotFoundException $e) {
            return new JsonResponse(['message' => $e->getMessage()], Response::HTTP_NOT_FOUND);
        } catch (UnauthorizedAssignmentException $e) {
            return new JsonResponse(['message' => $e->getMessage()], Response::HTTP_FORBIDDEN);
        } catch (TargetUserNotAdvisorException|DomainException|InvalidArgumentException $e) {
            return new JsonResponse(['message' => $e->getMessage()], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $advisor->load('assignedCompanies');

        return (new AdvisorResource($advisor))
            ->additional(['message' => 'Spółka została pomyślnie przypisana do doradcy.'])
            ->response()
            ->setStatusCode(Response::HTTP_OK);
    }

    /**
     * Revoke a single company assignment from an advisor.
     */
    public function revokeCompany(
        Request $request,
        string $id,
        string $companyId,
        RevokeAdvisorFromCompanyUseCase $useCase
    ): JsonResponse {
        /** @var User $currentUser */
        $currentUser = $request->user();

        $advisor = User::find($id);
        if ($advisor === null || (!$advisor->isAdvisor() && !$advisor->isAdmin())) {
            return new JsonResponse([
                'message' => 'Wskazany doradca nie istnieje.',
            ], Response::HTTP_NOT_FOUND);
        }

        try {
            $command = new RevokeAdvisorFromCompanyCommand(
                companyId: $companyId,
                advisorId: (string) $advisor->id,
                revokedById: (string) $currentUser->id
            );
            $useCase->execute($command);
        } catch (UnauthorizedAssignmentException $e) {
            return new JsonResponse(['message' => $e->getMessage()], Response::HTTP_FORBIDDEN);
        } catch (DomainException|InvalidArgumentException $e) {
            return new JsonResponse(['message' => $e->getMessage()], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        return new JsonResponse([
            'message' => 'Doradca został pomyślnie odpięty od spółki.',
        ], Response::HTTP_OK);
    }

    /**
     * Synchronize entire company assignments list for an advisor.
     */
    public function syncCompanies(
        SyncAdvisorCompaniesRequest $request,
        string $id,
        AssignAdvisorToCompanyUseCase $assignUseCase,
        RevokeAdvisorFromCompanyUseCase $revokeUseCase
    ): JsonResponse {
        /** @var User $currentUser */
        $currentUser = $request->user();

        $advisor = User::find($id);
        if ($advisor === null || (!$advisor->isAdvisor() && !$advisor->isAdmin())) {
            return new JsonResponse([
                'message' => 'Wskazany doradca nie istnieje.',
            ], Response::HTTP_NOT_FOUND);
        }

        $targetCompanyIds = array_unique((array) $request->input('company_ids', []));
        $currentCompanyIds = $advisor->assignedCompanies()->pluck('companies.id')->all();

        $toRevoke = array_diff($currentCompanyIds, $targetCompanyIds);
        $toAssign = array_diff($targetCompanyIds, $currentCompanyIds);

        try {
            foreach ($toRevoke as $companyId) {
                $revokeUseCase->execute(new RevokeAdvisorFromCompanyCommand(
                    companyId: (string) $companyId,
                    advisorId: (string) $advisor->id,
                    revokedById: (string) $currentUser->id
                ));
            }

            foreach ($toAssign as $companyId) {
                $assignUseCase->execute(new AssignAdvisorToCompanyCommand(
                    companyId: (string) $companyId,
                    advisorId: (string) $advisor->id,
                    assignedById: (string) $currentUser->id
                ));
            }
        } catch (AdvisorNotFoundException|CompanyNotFoundException $e) {
            return new JsonResponse(['message' => $e->getMessage()], Response::HTTP_NOT_FOUND);
        } catch (UnauthorizedAssignmentException $e) {
            return new JsonResponse(['message' => $e->getMessage()], Response::HTTP_FORBIDDEN);
        } catch (TargetUserNotAdvisorException|DomainException|InvalidArgumentException $e) {
            return new JsonResponse(['message' => $e->getMessage()], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $advisor->load('assignedCompanies');

        return (new AdvisorResource($advisor))
            ->additional(['message' => 'Lista przypisanych spółek została pomyślnie zaktualizowana.'])
            ->response()
            ->setStatusCode(Response::HTTP_OK);
    }

    /**
     * Toggle advisor activation status.
     */
    public function toggleStatus(Request $request, string $id): JsonResponse
    {
        /** @var User $currentUser */
        $currentUser = $request->user();

        $advisor = User::with('assignedCompanies')->find($id);
        if ($advisor === null || (!$advisor->isAdvisor() && !$advisor->isAdmin())) {
            return new JsonResponse([
                'message' => 'Wskazany doradca nie istnieje.',
            ], Response::HTTP_NOT_FOUND);
        }

        if ((string) $advisor->id === (string) $currentUser->id) {
            return new JsonResponse([
                'message' => 'Nie można dezaktywować własnego konta administratora.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $advisor->is_active = !$advisor->is_active;
        $advisor->save();

        $statusLabel = $advisor->is_active ? 'aktywowane' : 'dezaktywowane';

        return (new AdvisorResource($advisor))
            ->additional(['message' => "Konto doradcy zostało pomyślnie {$statusLabel}."])
            ->response()
            ->setStatusCode(Response::HTTP_OK);
    }

    /**
     * List all companies with assigned advisor counts and client counts for administration view.
     */
    public function companies(Request $request): AnonymousResourceCollection
    {
        $companies = Company::query()
            ->with(['assignedAdvisors:id,name,email,is_active'])
            ->withCount(['assignedAdvisors', 'users as clients_count' => fn ($q) => $q->where('role', 'client')])
            ->orderBy('name', 'asc')
            ->get();

        return CompanyAssignmentResource::collection($companies);
    }
}
