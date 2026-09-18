<?php

declare(strict_types=1);

namespace App\Presentation\Api\Controllers;

use App\Contexts\Finance\Application\Jobs\ProcessFinancialCsvJob;
use App\Contexts\Finance\Application\Services\CsvFinancialDataParser;
use App\Models\CsvImport;
use App\Models\User;
use App\Presentation\Api\Requests\UploadFinancialCsvRequest;
use App\Presentation\Api\Resources\CsvImportResource;
use App\Presentation\Api\Traits\ResolvesCompanyContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

final class FinancialImportController
{
    use ResolvesCompanyContext;

    /**
     * Upload financial CSV file and queue background processing.
     */
    public function store(UploadFinancialCsvRequest $request): JsonResponse
    {
        $companyId = $this->resolveCompanyId($request);
        $file = $request->file('file');

        $importId = Str::uuid()->toString();
        $originalName = $file->getClientOriginalName();
        $extension = $file->getClientOriginalExtension() ?: 'csv';
        $storagePath = sprintf('imports/%s/%s.%s', $companyId, $importId, $extension);

        Storage::disk('local')->put($storagePath, file_get_contents($file->getRealPath()));

        $import = CsvImport::create([
            'id' => $importId,
            'company_id' => $companyId,
            'user_id' => $request->user()?->id,
            'file_name' => $originalName,
            'file_path' => $storagePath,
            'status' => 'pending',
            'total_rows' => 0,
            'imported_rows' => 0,
            'error_count' => 0,
        ]);

        ProcessFinancialCsvJob::dispatch(
            importId: $importId,
            companyId: $companyId,
            filePath: $storagePath
        );

        return (new CsvImportResource($import))
            ->response()
            ->setStatusCode(Response::HTTP_ACCEPTED);
    }

    /**
     * Get details and processing status of a CSV import.
     */
    public function show(string $id, Request $request): CsvImportResource
    {
        $import = CsvImport::find($id);

        if ($import === null) {
            throw new NotFoundHttpException('Zadanie importu nie zostało odnalezione.');
        }

        $this->ensureCanAccessImport($request->user(), $import);

        return new CsvImportResource($import);
    }

    /**
     * Get history of imports for company.
     */
    public function history(Request $request): AnonymousResourceCollection
    {
        $companyId = $this->resolveCompanyId($request);

        $imports = CsvImport::query()
            ->where('company_id', $companyId)
            ->orderBy('created_at', 'desc')
            ->paginate($request->integer('per_page', 15));

        return CsvImportResource::collection($imports);
    }

    /**
     * Validate/preview CSV file without persisting records.
     */
    public function preview(
        UploadFinancialCsvRequest $request,
        CsvFinancialDataParser $parser
    ): JsonResponse {
        $file = $request->file('file');
        $csvContent = (string) file_get_contents($file->getRealPath());

        $result = $parser->parse($csvContent);

        return new JsonResponse([
            'valid' => $result->isValid(),
            'total_rows' => $result->totalRows,
            'valid_count' => $result->successCount(),
            'error_count' => $result->errorCount(),
            'errors' => $result->errors,
            'sample_records' => array_slice($result->validRecords, 0, 10),
        ], Response::HTTP_OK);
    }

    private function ensureCanAccessImport(User $user, CsvImport $import): void
    {
        if ($user->role !== 'admin' && (string) $import->company_id !== (string) $user->company_id) {
            throw new AccessDeniedHttpException('Brak uprawnień do podglądu tego zadania importu.');
        }
    }
}
