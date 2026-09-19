<?php

declare(strict_types=1);

namespace Tests\Feature\Finance;

use App\Contexts\Finance\Application\Commands\DeleteFinancialRecord\DeleteFinancialRecordCommand;
use App\Contexts\Finance\Application\Commands\DeleteFinancialRecord\DeleteFinancialRecordHandler;
use App\Contexts\Finance\Domain\Entities\Category;
use App\Contexts\Finance\Domain\Events\CsvImportCompleted;
use App\Contexts\Finance\Domain\Events\CsvImportFailed;
use App\Contexts\Finance\Domain\Events\FinancialBenchmarkReset;
use App\Contexts\Finance\Domain\Model\FinancialBenchmark;
use App\Contexts\Finance\Domain\Model\FinancialRecord;
use App\Contexts\Finance\Domain\Repositories\FinancialAuditLogRepositoryInterface;
use App\Contexts\Finance\Domain\Repositories\FinancialBenchmarkRepositoryInterface;
use App\Contexts\Finance\Domain\Repositories\FinancialRecordRepositoryInterface;
use App\Contexts\Finance\Domain\ValueObjects\AuditAction;
use App\Contexts\Finance\Domain\ValueObjects\BenchmarkMetricType;
use App\Contexts\Finance\Domain\ValueObjects\CategoryType;
use App\Contexts\Finance\Domain\ValueObjects\Currency;
use App\Contexts\Finance\Domain\ValueObjects\FinancialBenchmarkId;
use App\Contexts\Finance\Domain\ValueObjects\FinancialRecordId;
use App\Contexts\Finance\Domain\ValueObjects\Money;
use App\Models\Company;
use App\Models\FinancialCategory;
use App\Models\User;
use DateTimeImmutable;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Str;
use Tests\TestCase;

final class FinancialAuditLogEventListenerTest extends TestCase
{
    use DatabaseTransactions;

    private FinancialAuditLogRepositoryInterface $auditLogRepository;
    private FinancialRecordRepositoryInterface $recordRepository;
    private FinancialBenchmarkRepositoryInterface $benchmarkRepository;
    private DeleteFinancialRecordHandler $deleteRecordHandler;
    private Company $company;
    private User $user;
    private Category $category;

    protected function setUp(): void
    {
        parent::setUp();

        $this->auditLogRepository = $this->app->make(FinancialAuditLogRepositoryInterface::class);
        $this->recordRepository = $this->app->make(FinancialRecordRepositoryInterface::class);
        $this->benchmarkRepository = $this->app->make(FinancialBenchmarkRepositoryInterface::class);
        $this->deleteRecordHandler = $this->app->make(DeleteFinancialRecordHandler::class);

        $this->company = Company::create([
            'id' => (string) Str::uuid(),
            'name' => 'Audit Event Company',
            'code' => 'AUD_EV_' . Str::random(4),
            'tax_id' => 'PL' . random_int(1000000000, 9999999999),
        ]);

        $this->user = User::create([
            'id' => (string) Str::uuid(),
            'name' => 'Auditing Advisor',
            'email' => 'auditing_advisor_' . Str::random(5) . '@helvest.com',
            'password' => bcrypt('secret123'),
            'role' => 'advisor',
            'company_id' => $this->company->id,
            'is_active' => true,
        ]);

        $catModel = FinancialCategory::firstOrCreate(
            ['code' => 'REV_PROD_AUDIT'],
            [
                'id' => (string) Str::uuid(),
                'name' => 'Przychody ze sprzedaży produktów',
                'type' => 'revenue',
                'description' => 'Przychody ze sprzedaży',
            ]
        );

        $this->category = new Category(
            id: $catModel->id,
            name: $catModel->name,
            type: CategoryType::from($catModel->type),
            code: $catModel->code
        );
    }

    public function test_persists_audit_log_when_financial_record_is_created(): void
    {
        $this->actingAs($this->user);

        $recordId = FinancialRecordId::generate();
        $record = FinancialRecord::create(
            id: $recordId,
            companyId: $this->company->id,
            category: $this->category,
            amount: Money::fromDecimal('150000.00', Currency::PLN),
            recordDate: new DateTimeImmutable('2026-03-01'),
            description: 'Przychody ze sprzedaży linii A'
        );

        $this->recordRepository->save($record);

        $logs = $this->auditLogRepository->findByCompanyId($this->company->id, action: AuditAction::RECORD_CREATED);

        $this->assertNotEmpty($logs);
        $log = $logs[0];
        $this->assertSame(AuditAction::RECORD_CREATED, $log->action());
        $this->assertSame('financial_record', $log->entityType());
        $this->assertSame($recordId->value(), $log->entityId());
        $this->assertSame($this->user->id, $log->userId());
        $this->assertStringContainsString('150000.0000 PLN', $log->description());
        $this->assertNotNull($log->newValues());
        $this->assertSame('150000.0000', $log->newValues()['amount']);
    }

    public function test_persists_audit_log_when_financial_record_is_updated(): void
    {
        $this->actingAs($this->user);

        $recordId = FinancialRecordId::generate();
        $record = FinancialRecord::create(
            id: $recordId,
            companyId: $this->company->id,
            category: $this->category,
            amount: Money::fromDecimal('100000.00', Currency::PLN),
            recordDate: new DateTimeImmutable('2026-03-01'),
            description: 'Przychody'
        );
        $this->recordRepository->save($record);

        // Update amount
        $record->updateAmount(Money::fromDecimal('125000.00', Currency::PLN));
        $this->recordRepository->save($record);

        $logs = $this->auditLogRepository->findByCompanyId($this->company->id, action: AuditAction::RECORD_UPDATED);

        $this->assertNotEmpty($logs);
        $log = $logs[0];
        $this->assertSame(AuditAction::RECORD_UPDATED, $log->action());
        $this->assertSame('financial_record', $log->entityType());
        $this->assertSame($recordId->value(), $log->entityId());
        $this->assertSame('100000.0000', $log->oldValues()['amount']);
        $this->assertSame('125000.0000', $log->newValues()['amount']);
    }

    public function test_persists_audit_log_when_financial_record_is_deleted(): void
    {
        $this->actingAs($this->user);

        $recordId = FinancialRecordId::generate();
        $record = FinancialRecord::create(
            id: $recordId,
            companyId: $this->company->id,
            category: $this->category,
            amount: Money::fromDecimal('50000.00', Currency::PLN),
            recordDate: new DateTimeImmutable('2026-03-01'),
            description: 'Rekord do usunięcia'
        );
        $this->recordRepository->save($record);

        // Delete using command handler
        $this->deleteRecordHandler->handle(new DeleteFinancialRecordCommand($recordId->value()));

        $logs = $this->auditLogRepository->findByCompanyId($this->company->id, action: AuditAction::RECORD_DELETED);

        $this->assertNotEmpty($logs);
        $log = $logs[0];
        $this->assertSame(AuditAction::RECORD_DELETED, $log->action());
        $this->assertSame('financial_record', $log->entityType());
        $this->assertSame($recordId->value(), $log->entityId());
        $this->assertSame('50000.0000', $log->oldValues()['amount']);
    }

    public function test_persists_audit_log_when_benchmark_is_configured(): void
    {
        $this->actingAs($this->user);

        $benchmarkId = FinancialBenchmarkId::generate();
        $benchmark = FinancialBenchmark::create(
            id: $benchmarkId,
            companyId: $this->company->id,
            metricType: BenchmarkMetricType::CURRENT_RATIO,
            targetValue: 2.0,
            warningThreshold: 1.5,
            criticalThreshold: 1.0,
            higherIsBetter: true,
            description: 'Cel wskaźnika płynności bieżącej',
            configuredBy: $this->user->id
        );

        $this->benchmarkRepository->save($benchmark);

        $logs = $this->auditLogRepository->findByCompanyId($this->company->id, action: AuditAction::BENCHMARK_CONFIGURED);

        $this->assertNotEmpty($logs);
        $log = $logs[0];
        $this->assertSame(AuditAction::BENCHMARK_CONFIGURED, $log->action());
        $this->assertSame('financial_benchmark', $log->entityType());
        $this->assertSame($benchmarkId->value(), $log->entityId());
        $this->assertSame($this->user->id, $log->userId());
        $this->assertSame(2.0, (float) $log->newValues()['target_value']);
        $this->assertSame(1.5, (float) $log->newValues()['warning_threshold']);
        $this->assertSame(1.0, (float) $log->newValues()['critical_threshold']);
    }

    public function test_persists_audit_log_when_benchmarks_are_reset(): void
    {
        $this->actingAs($this->user);

        Event::dispatch(new FinancialBenchmarkReset(
            companyId: $this->company->id,
            metricType: BenchmarkMetricType::GROSS_MARGIN,
            resetBy: $this->user->id
        ));

        $logs = $this->auditLogRepository->findByCompanyId($this->company->id, action: AuditAction::BENCHMARK_RESET);

        $this->assertNotEmpty($logs);
        $log = $logs[0];
        $this->assertSame(AuditAction::BENCHMARK_RESET, $log->action());
        $this->assertSame('financial_benchmark', $log->entityType());
        $this->assertSame('GROSS_MARGIN', $log->entityId());
        $this->assertStringContainsStringIgnoringCase('Marża brutto', $log->description());
        $this->assertSame('market_defaults', $log->newValues()['reset_to']);
    }

    public function test_persists_audit_log_when_csv_import_completes_or_fails(): void
    {
        $importId = (string) Str::uuid();

        Event::dispatch(new CsvImportCompleted(
            importId: $importId,
            companyId: $this->company->id,
            importedRows: 42
        ));

        $processedLogs = $this->auditLogRepository->findByCompanyId($this->company->id, action: AuditAction::CSV_IMPORT_PROCESSED);
        $this->assertNotEmpty($processedLogs);
        $this->assertSame('csv_import', $processedLogs[0]->entityType());
        $this->assertSame($importId, $processedLogs[0]->entityId());
        $this->assertSame(42, $processedLogs[0]->newValues()['imported_rows']);

        $failedImportId = (string) Str::uuid();
        Event::dispatch(new CsvImportFailed(
            importId: $failedImportId,
            companyId: $this->company->id,
            errorCount: 3,
            errors: ['Row 1: invalid number', 'Row 5: missing category', 'Row 9: invalid date']
        ));

        $failedLogs = $this->auditLogRepository->findByCompanyId($this->company->id, action: AuditAction::CSV_IMPORT_FAILED);
        $this->assertNotEmpty($failedLogs);
        $this->assertSame('csv_import', $failedLogs[0]->entityType());
        $this->assertSame($failedImportId, $failedLogs[0]->entityId());
        $this->assertSame(3, $failedLogs[0]->newValues()['error_count']);
    }
}
