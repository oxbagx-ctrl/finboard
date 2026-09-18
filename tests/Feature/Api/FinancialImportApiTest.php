<?php

declare(strict_types=1);

namespace Tests\Feature\Api;

use App\Contexts\Finance\Application\Jobs\ProcessFinancialCsvJob;
use App\Models\Company;
use App\Models\CsvImport;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

final class FinancialImportApiTest extends TestCase
{
    use DatabaseTransactions;

    private User $clientUser;
    private Company $acmeCompany;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');

        $this->acmeCompany = Company::firstOrCreate(
            ['code' => 'ACME'],
            ['name' => 'Acme Manufacturing S.A.', 'tax_id' => 'PL7010101010']
        );

        $this->clientUser = User::firstOrCreate(
            ['email' => 'klient@acme.com'],
            [
                'name' => 'Jan Kowalski (CFO Acme)',
                'password' => bcrypt('password123'),
                'role' => 'client',
                'company_id' => $this->acmeCompany->id,
                'is_active' => true,
            ]
        );
    }

    public function test_csv_preview_returns_validation_result_and_samples(): void
    {
        Sanctum::actingAs($this->clientUser);

        $csvContent = <<<CSV
category,amount,date,description
cat-revenue,150000.00,2026-08-01,Sprzedaż produktów A
cat-cogs,75000.00,2026-08-05,Surowce produkcyjne
CSV;

        $file = UploadedFile::fake()->createWithContent('import.csv', $csvContent);

        $response = $this->postJson('/api/v1/finance/import/preview', [
            'file' => $file,
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('valid', true)
            ->assertJsonPath('total_rows', 2)
            ->assertJsonPath('valid_count', 2)
            ->assertJsonPath('error_count', 0);
    }

    public function test_csv_upload_queues_job_and_returns_accepted(): void
    {
        Queue::fake([ProcessFinancialCsvJob::class]);
        Sanctum::actingAs($this->clientUser);

        $csvContent = <<<CSV
category,amount,date,description
cat-revenue,89000.00,2026-08-10,Sprzedaż eksportowa
CSV;

        $file = UploadedFile::fake()->createWithContent('financial_data.csv', $csvContent);

        $response = $this->postJson('/api/v1/finance/import/csv', [
            'file' => $file,
        ]);

        $response->assertStatus(202)
            ->assertJsonPath('data.company_id', $this->acmeCompany->id)
            ->assertJsonPath('data.status', 'pending')
            ->assertJsonPath('data.file_name', 'financial_data.csv');

        $importId = $response->json('data.id');

        Queue::assertPushed(ProcessFinancialCsvJob::class, function ($job) use ($importId) {
            return $job->importId === $importId && $job->companyId === $this->acmeCompany->id;
        });
    }

    public function test_get_import_status_and_history(): void
    {
        Sanctum::actingAs($this->clientUser);

        $import = CsvImport::create([
            'id' => \Ramsey\Uuid\Uuid::uuid4()->toString(),
            'company_id' => $this->acmeCompany->id,
            'user_id' => $this->clientUser->id,
            'file_name' => 'historical.csv',
            'file_path' => 'imports/historical.csv',
            'status' => 'completed',
            'total_rows' => 15,
            'imported_rows' => 15,
            'error_count' => 0,
            'completed_at' => now(),
        ]);

        $response = $this->getJson('/api/v1/finance/import/csv/' . $import->id);

        $response->assertStatus(200)
            ->assertJsonPath('data.id', $import->id)
            ->assertJsonPath('data.status', 'completed')
            ->assertJsonPath('data.imported_rows', 15);

        $historyResponse = $this->getJson('/api/v1/finance/import/history');
        $historyResponse->assertStatus(200);
        $this->assertNotEmpty($historyResponse->json('data'));
    }
}
