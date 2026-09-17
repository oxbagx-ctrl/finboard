<?php

declare(strict_types=1);

namespace App\Contexts\Finance\Application\Jobs;

use App\Contexts\Finance\Application\Commands\BatchIngestFinancialRecords\BatchIngestFinancialRecordsCommand;
use App\Contexts\Finance\Application\Commands\BatchIngestFinancialRecords\BatchIngestFinancialRecordsHandler;
use App\Contexts\Finance\Application\Services\CsvFinancialDataParser;
use App\Contexts\Finance\Domain\Events\CsvImportCompleted;
use App\Contexts\Finance\Domain\Events\CsvImportFailed;
use App\Models\CsvImport;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Events\Dispatcher;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Throwable;

final class ProcessFinancialCsvJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public int $timeout = 300;

    public function __construct(
        public readonly string $importId,
        public readonly string $companyId,
        public readonly string $filePath,
        public readonly string $defaultCurrency = 'PLN'
    ) {
        $this->onQueue('financial-imports');
    }

    public function handle(
        CsvFinancialDataParser $parser,
        BatchIngestFinancialRecordsHandler $ingestHandler,
        Dispatcher $dispatcher
    ): void {
        /** @var CsvImport|null $csvImport */
        $csvImport = CsvImport::find($this->importId);

        if ($csvImport !== null) {
            $csvImport->update(['status' => 'processing']);
        }

        try {
            $content = $this->readFileContent();
            if ($content === null) {
                $this->failImport($csvImport, 'Nie odnaleziono pliku źródłowego CSV w zasobach.', $dispatcher);
                return;
            }

            $result = $parser->parse($content, $this->defaultCurrency);

            if (!$result->isValid()) {
                if ($csvImport !== null) {
                    $csvImport->update([
                        'status' => 'failed',
                        'total_rows' => $result->totalRows,
                        'imported_rows' => 0,
                        'error_count' => $result->errorCount(),
                        'errors' => $result->errors,
                        'completed_at' => now(),
                    ]);
                }

                $dispatcher->dispatch(new CsvImportFailed(
                    importId: $this->importId,
                    companyId: $this->companyId,
                    errorCount: $result->errorCount(),
                    errors: $result->errors
                ));

                $this->cleanupFile();
                return;
            }

            // Ingest valid records via CQRS Command Handler
            $command = new BatchIngestFinancialRecordsCommand(
                companyId: $this->companyId,
                recordsData: $result->validRecords,
                defaultCurrency: $this->defaultCurrency,
                defaultSource: 'csv_import'
            );

            $createdIds = $ingestHandler->handle($command);

            if ($csvImport !== null) {
                $csvImport->update([
                    'status' => 'completed',
                    'total_rows' => $result->totalRows,
                    'imported_rows' => count($createdIds),
                    'error_count' => 0,
                    'errors' => null,
                    'completed_at' => now(),
                ]);
            }

            $dispatcher->dispatch(new CsvImportCompleted(
                importId: $this->importId,
                companyId: $this->companyId,
                importedRows: count($createdIds)
            ));

            $this->cleanupFile();
        } catch (Throwable $e) {
            Log::error('Błąd asynchronicznego importu CSV: ' . $e->getMessage(), [
                'import_id' => $this->importId,
                'company_id' => $this->companyId,
                'trace' => $e->getTraceAsString(),
            ]);

            $this->failImport($csvImport, 'Wystąpił błąd podczas przetwarzania: ' . $e->getMessage(), $dispatcher);
            throw $e;
        }
    }

    private function readFileContent(): ?string
    {
        if (Storage::disk('local')->exists($this->filePath)) {
            return Storage::disk('local')->get($this->filePath);
        }

        if (file_exists($this->filePath)) {
            return file_get_contents($this->filePath) ?: null;
        }

        return null;
    }

    private function cleanupFile(): void
    {
        if (Storage::disk('local')->exists($this->filePath)) {
            Storage::disk('local')->delete($this->filePath);
        } elseif (file_exists($this->filePath)) {
            @unlink($this->filePath);
        }
    }

    private function failImport(?CsvImport $csvImport, string $reason, Dispatcher $dispatcher): void
    {
        if ($csvImport !== null) {
            $csvImport->update([
                'status' => 'failed',
                'error_count' => 1,
                'errors' => [['message' => $reason]],
                'completed_at' => now(),
            ]);
        }

        $dispatcher->dispatch(new CsvImportFailed(
            importId: $this->importId,
            companyId: $this->companyId,
            errorCount: 1,
            errors: [['message' => $reason]]
        ));

        $this->cleanupFile();
    }
}
