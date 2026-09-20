<?php

declare(strict_types=1);

namespace App\Presentation\Api\Controllers;

use App\Contexts\Finance\Domain\ValueObjects\AuditAction;
use App\Models\FinancialAuditLog;
use App\Models\User;
use App\Presentation\Api\Resources\FinancialAuditLogResource;
use App\Presentation\Api\Traits\ResolvesCompanyContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

final class AuditLogController
{
    use ResolvesCompanyContext;

    /**
     * List audit logs for the company with filtering and pagination.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $companyId = $this->resolveCompanyId($request);

        $query = FinancialAuditLog::query()
            ->with('user:id,name,email,role')
            ->where('company_id', $companyId)
            ->orderBy('created_at', 'desc');

        if ($request->filled('action')) {
            $action = $request->input('action');
            if (is_array($action)) {
                $query->whereIn('action', $action);
            } elseif (str_contains((string) $action, ',')) {
                $actions = array_map('trim', explode(',', (string) $action));
                $query->whereIn('action', $actions);
            } else {
                $query->where('action', (string) $action);
            }
        }

        if ($request->filled('entity_type')) {
            $entityType = (string) $request->input('entity_type');
            $query->where('entity_type', $entityType);
        }

        if ($request->filled('user_id')) {
            $userId = (string) $request->input('user_id');
            $query->where('user_id', $userId);
        }

        if ($request->filled('from_date')) {
            $fromDate = (string) $request->input('from_date');
            $query->where('created_at', '>=', $fromDate);
        }

        if ($request->filled('to_date')) {
            $toDate = (string) $request->input('to_date');
            $query->where('created_at', '<=', $toDate . ' 23:59:59');
        }

        if ($request->filled('search')) {
            $term = '%' . strtolower(trim((string) $request->input('search'))) . '%';
            $query->where(function ($q) use ($term) {
                $q->whereRaw('LOWER(description) LIKE ?', [$term])
                    ->orWhereRaw('LOWER(entity_id) LIKE ?', [$term])
                    ->orWhereHas('user', function ($uq) use ($term) {
                        $uq->whereRaw('LOWER(name) LIKE ?', [$term])
                            ->orWhereRaw('LOWER(email) LIKE ?', [$term]);
                    });
            });
        }

        $perPage = min(max($request->integer('per_page', 25), 1), 100);
        $paginated = $query->paginate($perPage);

        return FinancialAuditLogResource::collection($paginated)->additional([
            'status' => 'success',
            'company_id' => $companyId,
        ]);
    }

    /**
     * Show a single audit log entry by ID.
     */
    public function show(Request $request, string $id): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $companyId = $this->resolveCompanyId($request);

        /** @var FinancialAuditLog|null $log */
        $log = FinancialAuditLog::with('user:id,name,email,role')->find($id);

        if ($log === null) {
            return new JsonResponse([
                'status' => 'error',
                'message' => 'Wpis dziennika audytowego nie został odnaleziony.',
            ], Response::HTTP_NOT_FOUND);
        }

        // Verify company ownership and multi-tenant isolation
        if ($log->company_id !== $companyId && !$user->isAdmin()) {
            throw new AccessDeniedHttpException('Brak dostępu do wskazanego wpisu dziennika audytowego.');
        }

        return (new FinancialAuditLogResource($log))
            ->additional(['status' => 'success'])
            ->response()
            ->setStatusCode(Response::HTTP_OK);
    }

    /**
     * Get aggregate statistics of audit logs for the company.
     */
    public function stats(Request $request): JsonResponse
    {
        $companyId = $this->resolveCompanyId($request);

        $total = FinancialAuditLog::where('company_id', $companyId)->count();

        $actionCounts = FinancialAuditLog::query()
            ->selectRaw('action, count(*) as count')
            ->where('company_id', $companyId)
            ->groupBy('action')
            ->pluck('count', 'action')
            ->all();

        $entityTypeCounts = FinancialAuditLog::query()
            ->selectRaw('entity_type, count(*) as count')
            ->where('company_id', $companyId)
            ->groupBy('entity_type')
            ->pluck('count', 'entity_type')
            ->all();

        $lastLog = FinancialAuditLog::where('company_id', $companyId)
            ->orderBy('created_at', 'desc')
            ->first();

        // Enriched action stats with labels and colors
        $enrichedActions = [];
        foreach (AuditAction::cases() as $case) {
            $count = (int) ($actionCounts[$case->value] ?? 0);
            $enrichedActions[$case->value] = [
                'action' => $case->value,
                'label' => $case->label(),
                'color' => $case->color(),
                'category' => $case->category(),
                'count' => $count,
            ];
        }

        return new JsonResponse([
            'status' => 'success',
            'company_id' => $companyId,
            'data' => [
                'total_events' => $total,
                'by_action' => $enrichedActions,
                'by_entity_type' => $entityTypeCounts,
                'last_event_at' => $lastLog?->created_at?->toIso8601String(),
            ],
        ], Response::HTTP_OK);
    }
}
