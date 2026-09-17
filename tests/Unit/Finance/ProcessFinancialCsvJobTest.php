<?php

declare(strict_types=1);

namespace Tests\Unit\Finance;

use App\Contexts\Finance\Application\Commands\BatchIngestFinancialRecords\BatchIngestFinancialRecordsHandler;
use App\Contexts\Finance\Application\Jobs\ProcessFinancialCsvJob;
use App\Contexts\Finance\Application\Services\CsvFinancialDataParser;
use App\Contexts\Finance\Domain\Events\CsvImportCompleted;
use App\Contexts\Finance\Domain\Events\CsvImportFailed;
use App\Models\CsvImport;
use App\Models\FinancialRecord;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

final class ProcessFinancialCsvJobTest extends TestCase
{
    use DatabaseTransactions;

    private const COMPANY_ID = '22222222-2222-2222-2222-222222222222';

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
    }

    public function test_successful_csv_processing_completes_import_and_persists_records(): void
    {
        Event::fake([CsvImportCompleted::class]);

        $csvContent = <<<CSV
category,amount,date,description,currency
cat-revenue,85000.00,2026-07-15,Przychody lipiec linia A,PLN
cat-cogs,42000.00,2026-07-20,Materiały produkcyjne,PLN
CSV;

        $filePath = 'imports/test_valid.csv';
        Storage::disk('local')->put($filePath, $csvContent);

        $import = CsvImport::create([
            'id' => Str::uuid()->toString(),
            'company_id' => self::COMPANY_ID,
            'file_name' => 'test_valid.csv',
            'file_path' => $filePath,
            'status' => 'pending',
        ]);

        $job = new ProcessFinancialCsvJob(
            importId: $import->id,
            companyId: self::COMPANY_ID,
            filePath: $filePath
        );

        $job->handle(
            $this->app->make(CsvFinancialDataParser::class),
            $this->app->make(BatchIngestFinancialRecordsHandler::class),
            $this->app->make(\Illuminate\Contracts\Events\Dispatcher::class)
        );

        $import->refresh();
        $this->assertSame('completed', $import->status);
        $this->assertSame(2, $import->total_rows);
        $this->assertSame(2, $import->imported_rows);
        $this->assertSame(0, $import->error_count);
        $this->assertNotNull($import->completed_at);

        // Verify records inserted in DB
        $this->assertTrue(
            FinancialRecord::where('company_id', self::COMPANY_ID)
                ->where('description', 'Przychody lipiec linia A')
                ->exists()
        );

        Event::assertDispatched(CsvImportCompleted::class, function ($event) use ($import) {
            return $event->aggregateId() === $import->id && $event->importedRows() === 2;
        });
    }

    public function test_invalid_csv_marks_import_as_failed_with_errors(): void
    {
        Event::fake([CsvImportFailed::class]);

        $csvContent = <<<CSV
category,amount,date,description
cat-revenue,-5000.00,invalid-date,
CSV;

        $filePath = 'imports/test_invalid.csv';
        Storage::disk('local')->put($filePath, $csvContent);

        $import = CsvImport::create([
            'id' => Str::uuid()->toString(),
            'company_id' => self::COMPANY_ID,
            'file_name' => 'test_invalid.csv',
            'file_path' => $filePath,
            'status' => 'pending',
        ]);

        $job = new ProcessFinancialCsvJob(
            importId: $import->id,
            companyId: self::COMPANY_ID,
            filePath: $filePath
        );

        $job->handle(
            $this->app->make(CsvFinancialDataParser::class),
            $this->app->make(BatchIngestFinancialRecordsHandler::class),
            $this->app->make(\Illuminate\Contracts\Events\Dispatcher::class)
        );

        $import->refresh();
        $this->assertSame('failed', $import->status);
        $this->assertGreaterThan(0, $import->error_count);
        $this->assertNotEmpty($import->errors);

        Event::assertDispatched(CsvImportFailed::class);
    }
}
