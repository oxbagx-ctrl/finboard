<?php

declare(strict_types=1);

namespace App\Presentation\Api\Controllers;

use App\Contexts\Finance\Application\Commands\BatchDeleteFinancialRecords\BatchDeleteFinancialRecordsCommand;
use App\Contexts\Finance\Application\Commands\BatchDeleteFinancialRecords\BatchDeleteFinancialRecordsHandler;
use App\Contexts\Finance\Application\Commands\CreateFinancialRecord\CreateFinancialRecordCommand;
use App\Contexts\Finance\Application\Commands\CreateFinancialRecord\CreateFinancialRecordHandler;
use App\Contexts\Finance\Application\Commands\DeleteFinancialRecord\DeleteFinancialRecordCommand;
use App\Contexts\Finance\Application\Commands\DeleteFinancialRecord\DeleteFinancialRecordHandler;
use App\Contexts\Finance\Application\Commands\UpdateFinancialRecord\UpdateFinancialRecordCommand;
use App\Contexts\Finance\Application\Commands\UpdateFinancialRecord\UpdateFinancialRecordHandler;
use App\Contexts\Finance\Domain\ValueObjects\RecordType;
use App\Models\FinancialRecord;
use App\Models\User;
use App\Presentation\Api\Requests\BatchDeleteFinancialRecordsRequest;
use App\Presentation\Api\Requests\CreateFinancialRecordRequest;
use App\Presentation\Api\Requests\UpdateFinancialRecordRequest;

use App\Presentation\Api\Resources\FinancialRecordResource;
use App\Presentation\Api\Traits\ResolvesCompanyContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

final class FinancialRecordController
{
    use ResolvesCompanyContext;

    /**
     * List financial records for authorized company with filtering and pagination.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $companyId = $this->resolveCompanyId($request);

        $query = FinancialRecord::query()
            ->with('category')
            ->where('company_id', $companyId);

        if ($request->filled('start_date')) {
            $query->where('record_date', '>=', $request->query('start_date'));
        }

        if ($request->filled('end_date')) {
            $query->where('record_date', '<=', $request->query('end_date'));
        }

        if ($request->filled('category_id')) {
            $query->where('category_id', $request->query('category_id'));
        }

        if ($request->filled('record_type')) {
            $rawType = strtolower(trim((string) $request->query('record_type')));
            if ($rawType === 'income') {
                $rawType = RecordType::REVENUE->value;
            }

            $validType = RecordType::tryFrom($rawType);
            if ($validType !== null) {
                $query->where(function ($q) use ($validType) {
                    $q->where('record_type', $validType->value)
                        ->orWhere('record_type', strtoupper($validType->value));
                    if ($validType === RecordType::REVENUE) {
                        $q->orWhere('record_type', 'INCOME');
                    }
                });
            }
        }

        if ($request->filled('search')) {
            $searchTerm = '%' . strtolower((string) $request->query('search')) . '%';
            $query->whereRaw('LOWER(description) LIKE ?', [$searchTerm]);
        }

        $records = $query
            ->orderBy('record_date', 'desc')
            ->orderBy('created_at', 'desc')
            ->paginate($request->integer('per_page', 25));

        return FinancialRecordResource::collection($records);
    }

    /**
     * Create a single financial record.
     */
    public function store(
        CreateFinancialRecordRequest $request,
        CreateFinancialRecordHandler $handler
    ): JsonResponse {
        $companyId = $this->resolveCompanyId($request);

        $command = new CreateFinancialRecordCommand(
            companyId: $companyId,
            categoryId: (string) $request->input('category_id'),
            amount: (string) $request->input('amount'),
            currency: (string) $request->input('currency', 'PLN'),
            recordDate: (string) $request->input('record_date'),
            description: (string) $request->input('description'),
            source: (string) $request->input('source', 'manual')
        );

        $recordId = $handler->handle($command);

        $record = FinancialRecord::with('category')->findOrFail($recordId);

        return (new FinancialRecordResource($record))
            ->response()
            ->setStatusCode(Response::HTTP_CREATED);
    }

    /**
     * Show a single financial record.
     */
    public function show(string $id, Request $request): FinancialRecordResource
    {
        $record = FinancialRecord::with('category')->find($id);

        if ($record === null) {
            throw new NotFoundHttpException('Rekord finansowy nie został odnaleziony.');
        }

        $this->ensureCanAccessRecord($request->user(), $record);

        return new FinancialRecordResource($record);
    }

    /**
     * Update a financial record.
     */
    public function update(
        string $id,
        UpdateFinancialRecordRequest $request,
        UpdateFinancialRecordHandler $handler
    ): FinancialRecordResource {
        $record = FinancialRecord::find($id);

        if ($record === null) {
            throw new NotFoundHttpException('Rekord finansowy nie został odnaleziony.');
        }

        $this->ensureCanAccessRecord($request->user(), $record);

        $command = new UpdateFinancialRecordCommand(
            recordId: $id,
            amount: (string) $request->input('amount'),
            currency: (string) $request->input('currency', $record->currency),
            recordDate: (string) $request->input('record_date'),
            description: (string) $request->input('description'),
            categoryId: (string) $request->input('category_id')
        );

        $handler->handle($command);

        $record->refresh()->load('category');

        return new FinancialRecordResource($record);
    }

    /**
     * Delete a financial record.
     */
    public function destroy(
        string $id,
        Request $request,
        DeleteFinancialRecordHandler $handler
    ): JsonResponse {
        $record = FinancialRecord::find($id);

        if ($record === null) {
            throw new NotFoundHttpException('Rekord finansowy nie został odnaleziony.');
        }

        $this->ensureCanAccessRecord($request->user(), $record);

        $handler->handle(new DeleteFinancialRecordCommand($id));

        return new JsonResponse([
            'status' => 'deleted',
            'message' => 'Rekord finansowy został pomyślnie usunięty.',
        ], Response::HTTP_OK);
    }

    /**
     * Batch delete multiple financial records for the authorized company.
     */
    public function batchDestroy(
        BatchDeleteFinancialRecordsRequest $request,
        BatchDeleteFinancialRecordsHandler $handler
    ): JsonResponse {
        $companyId = $this->resolveCompanyId($request);
        $user = $request->user();

        $command = new BatchDeleteFinancialRecordsCommand(
            companyId: $companyId,
            recordIds: (array) $request->input('record_ids', []),
            userId: $user ? (string) $user->id : null,
            ipAddress: $request->ip()
        );

        $result = $handler->handle($command);

        return new JsonResponse([
            'status' => 'deleted',
            'count' => $result->deletedCount,
            'total_amount' => $result->totalAmount,
            'message' => sprintf('Pomyślnie usunięto %d operacji finansowych.', $result->deletedCount),
        ], Response::HTTP_OK);
    }


    private function ensureCanAccessRecord(User $user, FinancialRecord $record): void
    {
        if ($user->role !== 'admin' && (string) $record->company_id !== (string) $user->company_id) {
            throw new AccessDeniedHttpException('Brak uprawnień do edycji lub podglądu wskazanego rekordu.');
        }
    }
}
