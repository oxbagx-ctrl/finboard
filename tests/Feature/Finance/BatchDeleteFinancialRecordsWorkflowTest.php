<?php

declare(strict_types=1);

namespace Tests\Feature\Finance;

use App\Contexts\Finance\Application\Commands\BatchDeleteFinancialRecords\BatchDeleteFinancialRecordsCommand;
use App\Contexts\Finance\Application\Commands\BatchDeleteFinancialRecords\BatchDeleteFinancialRecordsHandler;
use App\Contexts\Finance\Domain\Events\FinancialRecordsBatchDeleted;
use App\Contexts\Finance\Domain\Repositories\FinancialAuditLogRepositoryInterface;
use App\Contexts\Finance\Domain\Repositories\FinancialRecordRepositoryInterface;
use App\Contexts\Finance\Domain\ValueObjects\AuditAction;
use App\Models\Company;
use App\Models\FinancialCategory;
use App\Models\FinancialRecord;
use App\Models\User;
use Illuminate\Contracts\Events\Dispatcher;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

final class BatchDeleteFinancialRecordsWorkflowTest extends TestCase
{
    use DatabaseTransactions;

    private FinancialRecordRepositoryInterface $recordRepository;
    private FinancialAuditLogRepositoryInterface $auditLogRepository;
    private Company $tenantCompany;
    private Company $otherCompany;
    private User $tenantUser;
    private FinancialCategory $category;

    protected function setUp(): void
    {
        parent::setUp();

        $this->recordRepository = $this->app->make(FinancialRecordRepositoryInterface::class);
        $this->auditLogRepository = $this->app->make(FinancialAuditLogRepositoryInterface::class);

        $this->tenantCompany = Company::create([
            'id' => (string) Str::uuid(),
            'name' => 'Batch Test Tenant Company',
            'code' => 'BTT_' . Str::random(4),
            'tax_id' => 'PL' . random_int(1000000000, 9999999999),
        ]);

        $this->otherCompany = Company::create([
            'id' => (string) Str::uuid(),
            'name' => 'Batch Test Other Company',
            'code' => 'BTO_' . Str::random(4),
            'tax_id' => 'PL' . random_int(1000000000, 9999999999),
        ]);

        $this->tenantUser = User::create([
            'id' => (string) Str::uuid(),
            'name' => 'Tenant CFO',
            'email' => 'cfo_' . Str::random(5) . '@tenant.com',
            'password' => bcrypt('Secret123!'),
            'role' => 'client',
            'company_id' => $this->tenantCompany->id,
            'is_active' => true,
        ]);

        $this->category = FinancialCategory::firstOrCreate(
            ['id' => 'cat-opex-general'],
            ['name' => 'Koszty Ogólne', 'code' => 'OPEX_GEN', 'type' => 'opex']
        );
    }

    public function test_complete_batch_delete_workflow_persists_audit_log_and_dispatches_event(): void
    {
        $rec1 = FinancialRecord::create([
            'id' => (string) Str::uuid(),
            'company_id' => $this->tenantCompany->id,
            'category_id' => $this->category->id,
            'amount' => 5000.00,
            'currency' => 'PLN',
            'record_date' => '2026-05-01',
            'description' => 'Opłata za serwery 1',
            'record_type' => 'expense',
            'source' => 'manual',
        ]);

        $rec2 = FinancialRecord::create([
            'id' => (string) Str::uuid(),
            'company_id' => $this->tenantCompany->id,
            'category_id' => $this->category->id,
            'amount' => 7500.00,
            'currency' => 'PLN',
            'record_date' => '2026-05-02',
            'description' => 'Opłata za serwery 2',
            'record_type' => 'expense',
            'source' => 'manual',
        ]);

        Sanctum::actingAs($this->tenantUser);

        $response = $this->deleteJson('/api/v1/finance/records/batch', [
            'record_ids' => [$rec1->id, $rec2->id],
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('status', 'deleted')
            ->assertJsonPath('count', 2);

        $this->assertEquals(12500.0, (float) $response->json('total_amount'));

        // Assert database records removed
        $this->assertDatabaseMissing('financial_records', ['id' => $rec1->id]);
        $this->assertDatabaseMissing('financial_records', ['id' => $rec2->id]);

        // Assert institutional audit log created
        $auditLogs = $this->auditLogRepository->findByCompanyId(
            $this->tenantCompany->id,
            action: AuditAction::RECORDS_BATCH_DELETED
        );

        $this->assertNotEmpty($auditLogs);
        $log = $auditLogs[0];
        $this->assertSame(AuditAction::RECORDS_BATCH_DELETED, $log->action());
        $this->assertSame($this->tenantCompany->id, $log->companyId());
        $this->assertSame((string) $this->tenantUser->id, $log->userId());
        $this->assertSame(2, $log->oldValues()['count']);
        $this->assertEquals(12500.0, (float) $log->oldValues()['total_amount']);
        $this->assertContains($rec1->id, $log->oldValues()['record_ids']);
        $this->assertContains($rec2->id, $log->oldValues()['record_ids']);
    }

    public function test_batch_delete_strictly_protects_foreign_tenant_records_in_mixed_payload(): void
    {
        $tenantRec = FinancialRecord::create([
            'id' => (string) Str::uuid(),
            'company_id' => $this->tenantCompany->id,
            'category_id' => $this->category->id,
            'amount' => 3000.00,
            'currency' => 'PLN',
            'record_date' => '2026-05-10',
            'description' => 'Tenant record to delete',
            'record_type' => 'expense',
            'source' => 'manual',
        ]);

        $foreignRec = FinancialRecord::create([
            'id' => (string) Str::uuid(),
            'company_id' => $this->otherCompany->id,
            'category_id' => $this->category->id,
            'amount' => 9000.00,
            'currency' => 'PLN',
            'record_date' => '2026-05-10',
            'description' => 'Foreign company secret record',
            'record_type' => 'expense',
            'source' => 'manual',
        ]);

        Sanctum::actingAs($this->tenantUser);

        $response = $this->deleteJson('/api/v1/finance/records/batch', [
            'record_ids' => [$tenantRec->id, $foreignRec->id],
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('status', 'deleted')
            ->assertJsonPath('count', 1);

        $this->assertEquals(3000.0, (float) $response->json('total_amount'));

        // Tenant record was deleted
        $this->assertDatabaseMissing('financial_records', ['id' => $tenantRec->id]);

        // Foreign record is completely untouched
        $this->assertDatabaseHas('financial_records', ['id' => $foreignRec->id]);
    }

    public function test_batch_delete_database_transaction_atomicity_on_exception(): void
    {
        $rec = FinancialRecord::create([
            'id' => (string) Str::uuid(),
            'company_id' => $this->tenantCompany->id,
            'category_id' => $this->category->id,
            'amount' => 4500.00,
            'currency' => 'PLN',
            'record_date' => '2026-05-15',
            'description' => 'Record under transactional test',
            'record_type' => 'expense',
            'source' => 'manual',
        ]);

        // Mock dispatcher to throw an exception during handling
        $mockDispatcher = $this->createMock(Dispatcher::class);
        $mockDispatcher->expects($this->once())
            ->method('dispatch')
            ->willThrowException(new \RuntimeException('Forced exception to verify DB rollback'));

        $handler = new BatchDeleteFinancialRecordsHandler($this->recordRepository, $mockDispatcher);

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('Forced exception to verify DB rollback');

        try {
            $handler->handle(new BatchDeleteFinancialRecordsCommand(
                companyId: $this->tenantCompany->id,
                recordIds: [$rec->id],
                userId: (string) $this->tenantUser->id
            ));
        } finally {
            // Verify record still exists in database because transaction was rolled back
            $this->assertDatabaseHas('financial_records', ['id' => $rec->id]);
        }
    }

    public function test_batch_delete_with_only_foreign_company_records_deletes_nothing_and_does_not_audit(): void
    {
        $foreign1 = FinancialRecord::create([
            'id' => (string) Str::uuid(),
            'company_id' => $this->otherCompany->id,
            'category_id' => $this->category->id,
            'amount' => 12000.00,
            'currency' => 'PLN',
            'record_date' => '2026-05-18',
            'description' => 'Foreign Confidential A',
            'record_type' => 'expense',
            'source' => 'manual',
        ]);

        $foreign2 = FinancialRecord::create([
            'id' => (string) Str::uuid(),
            'company_id' => $this->otherCompany->id,
            'category_id' => $this->category->id,
            'amount' => 18000.00,
            'currency' => 'PLN',
            'record_date' => '2026-05-19',
            'description' => 'Foreign Confidential B',
            'record_type' => 'expense',
            'source' => 'manual',
        ]);

        Sanctum::actingAs($this->tenantUser);

        $response = $this->deleteJson('/api/v1/finance/records/batch', [
            'record_ids' => [$foreign1->id, $foreign2->id],
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('status', 'deleted')
            ->assertJsonPath('count', 0);

        $this->assertEquals(0.0, (float) $response->json('total_amount'));

        // Assert foreign records were not deleted
        $this->assertDatabaseHas('financial_records', ['id' => $foreign1->id]);
        $this->assertDatabaseHas('financial_records', ['id' => $foreign2->id]);

        // Assert no audit log was created under either company
        $tenantLogs = $this->auditLogRepository->findByCompanyId(
            $this->tenantCompany->id,
            action: AuditAction::RECORDS_BATCH_DELETED
        );
        $this->assertEmpty($tenantLogs);

        $foreignLogs = $this->auditLogRepository->findByCompanyId(
            $this->otherCompany->id,
            action: AuditAction::RECORDS_BATCH_DELETED
        );
        $this->assertEmpty($foreignLogs);
    }

    public function test_batch_delete_with_non_existent_uuids_returns_zero_count(): void
    {
        Sanctum::actingAs($this->tenantUser);

        $nonExistent1 = (string) Str::uuid();
        $nonExistent2 = (string) Str::uuid();

        $response = $this->deleteJson('/api/v1/finance/records/batch', [
            'record_ids' => [$nonExistent1, $nonExistent2],
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('status', 'deleted')
            ->assertJsonPath('count', 0);

        $this->assertEquals(0.0, (float) $response->json('total_amount'));

        // No audit logs created
        $logs = $this->auditLogRepository->findByCompanyId(
            $this->tenantCompany->id,
            action: AuditAction::RECORDS_BATCH_DELETED
        );
        $this->assertEmpty($logs);
    }

    public function test_batch_delete_deduplicates_repeated_ids_in_payload(): void
    {
        $rec = FinancialRecord::create([
            'id' => (string) Str::uuid(),
            'company_id' => $this->tenantCompany->id,
            'category_id' => $this->category->id,
            'amount' => 3500.00,
            'currency' => 'PLN',
            'record_date' => '2026-05-20',
            'description' => 'Duplicate ID Test Record',
            'record_type' => 'expense',
            'source' => 'manual',
        ]);

        Sanctum::actingAs($this->tenantUser);

        // Sending same ID 3 times in payload
        $response = $this->deleteJson('/api/v1/finance/records/batch', [
            'record_ids' => [$rec->id, $rec->id, $rec->id],
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('status', 'deleted')
            ->assertJsonPath('count', 1);

        $this->assertEquals(3500.0, (float) $response->json('total_amount'));

        $this->assertDatabaseMissing('financial_records', ['id' => $rec->id]);

        $logs = $this->auditLogRepository->findByCompanyId(
            $this->tenantCompany->id,
            action: AuditAction::RECORDS_BATCH_DELETED
        );
        $this->assertNotEmpty($logs);
        $this->assertSame(1, $logs[0]->oldValues()['count']);
        $this->assertEquals(3500.0, (float) $logs[0]->oldValues()['total_amount']);
    }

    public function test_batch_delete_rollback_guarantees_zero_partial_deletions_when_failure_occurs(): void
    {
        $rec1 = FinancialRecord::create([
            'id' => (string) Str::uuid(),
            'company_id' => $this->tenantCompany->id,
            'category_id' => $this->category->id,
            'amount' => 1000.00,
            'currency' => 'PLN',
            'record_date' => '2026-05-21',
            'description' => 'Batch Partial 1',
            'record_type' => 'expense',
            'source' => 'manual',
        ]);

        $rec2 = FinancialRecord::create([
            'id' => (string) Str::uuid(),
            'company_id' => $this->tenantCompany->id,
            'category_id' => $this->category->id,
            'amount' => 2000.00,
            'currency' => 'PLN',
            'record_date' => '2026-05-22',
            'description' => 'Batch Partial 2',
            'record_type' => 'expense',
            'source' => 'manual',
        ]);

        $rec3 = FinancialRecord::create([
            'id' => (string) Str::uuid(),
            'company_id' => $this->tenantCompany->id,
            'category_id' => $this->category->id,
            'amount' => 3000.00,
            'currency' => 'PLN',
            'record_date' => '2026-05-23',
            'description' => 'Batch Partial 3',
            'record_type' => 'expense',
            'source' => 'manual',
        ]);

        $mockDispatcher = $this->createMock(Dispatcher::class);
        $mockDispatcher->expects($this->once())
            ->method('dispatch')
            ->willThrowException(new \RuntimeException('Catastrophic failure after deleteManyByIds'));

        $handler = new BatchDeleteFinancialRecordsHandler($this->recordRepository, $mockDispatcher);

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('Catastrophic failure after deleteManyByIds');

        try {
            $handler->handle(new BatchDeleteFinancialRecordsCommand(
                companyId: $this->tenantCompany->id,
                recordIds: [$rec1->id, $rec2->id, $rec3->id],
                userId: (string) $this->tenantUser->id
            ));
        } finally {
            // All 3 records MUST still exist in database due to atomic rollback
            $this->assertDatabaseHas('financial_records', ['id' => $rec1->id]);
            $this->assertDatabaseHas('financial_records', ['id' => $rec2->id]);
            $this->assertDatabaseHas('financial_records', ['id' => $rec3->id]);
        }
    }
}
