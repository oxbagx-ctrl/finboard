<?php

declare(strict_types=1);

namespace Tests\Feature\Finance;

use App\Contexts\Finance\Domain\Model\FinancialAuditLog;
use App\Contexts\Finance\Domain\Repositories\FinancialAuditLogRepositoryInterface;
use App\Contexts\Finance\Domain\ValueObjects\AuditAction;
use App\Contexts\Finance\Domain\ValueObjects\FinancialAuditLogId;
use App\Models\Company;
use App\Models\FinancialAuditLog as EloquentFinancialAuditLog;
use App\Models\User;
use DateTimeImmutable;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Str;
use Tests\TestCase;

final class FinancialAuditLogRepositoryTest extends TestCase
{
    use DatabaseTransactions;

    private FinancialAuditLogRepositoryInterface $repository;
    private Company $companyA;
    private Company $companyB;
    private User $user;

    protected function setUp(): void
    {
        parent::setUp();

        $this->repository = $this->app->make(FinancialAuditLogRepositoryInterface::class);

        $this->companyA = Company::create([
            'id' => (string) Str::uuid(),
            'name' => 'Audit Test Company A',
            'code' => 'AUDIT_A_' . Str::random(4),
            'tax_id' => 'PL' . random_int(1000000000, 9999999999),
        ]);

        $this->companyB = Company::create([
            'id' => (string) Str::uuid(),
            'name' => 'Audit Test Company B',
            'code' => 'AUDIT_B_' . Str::random(4),
            'tax_id' => 'PL' . random_int(1000000000, 9999999999),
        ]);

        $this->user = User::create([
            'id' => (string) Str::uuid(),
            'name' => 'Audit Auditor',
            'email' => 'auditor_' . Str::random(5) . '@helvest.com',
            'password' => bcrypt('password123'),
            'role' => 'advisor',
            'is_active' => true,
        ]);
    }

    public function test_can_save_and_find_audit_log_by_id(): void
    {
        $logId = FinancialAuditLogId::generate();
        $domainLog = new FinancialAuditLog(
            id: $logId,
            companyId: $this->companyA->id,
            userId: $this->user->id,
            action: AuditAction::BENCHMARK_CONFIGURED,
            entityType: 'financial_benchmark',
            entityId: (string) Str::uuid(),
            description: 'Ustawiono cel wskaźnika Gross Margin na 0.40',
            oldValues: ['target_value' => 0.35],
            newValues: ['target_value' => 0.40],
            ipAddress: '10.0.0.1',
            userAgent: 'FinBoard/1.0',
            createdAt: new DateTimeImmutable()
        );

        $this->repository->save($domainLog);

        $retrieved = $this->repository->findById($logId);

        $this->assertNotNull($retrieved);
        $this->assertSame($logId->value(), $retrieved->id());
        $this->assertSame($this->companyA->id, $retrieved->companyId());
        $this->assertSame($this->user->id, $retrieved->userId());
        $this->assertSame(AuditAction::BENCHMARK_CONFIGURED, $retrieved->action());
        $this->assertSame('financial_benchmark', $retrieved->entityType());
        $this->assertSame('Ustawiono cel wskaźnika Gross Margin na 0.40', $retrieved->description());
        $this->assertSame(['target_value' => 0.35], $retrieved->oldValues());
        $this->assertSame(['target_value' => 0.40], $retrieved->newValues());
        $this->assertSame('10.0.0.1', $retrieved->ipAddress());
    }

    public function test_find_by_company_id_orders_by_created_at_desc_and_respects_limit(): void
    {
        for ($i = 1; $i <= 5; $i++) {
            $this->repository->save(FinancialAuditLog::create(
                companyId: $this->companyA->id,
                action: AuditAction::RECORD_CREATED,
                entityType: 'financial_record',
                entityId: "record-{$i}",
                userId: $this->user->id,
                description: "Zaksięgowano rekord {$i}",
                createdAt: (new DateTimeImmutable())->modify("-{$i} hours")
            ));
        }

        $all = $this->repository->findByCompanyId($this->companyA->id, limit: 3);

        $this->assertCount(3, $all);
        // Most recent record-1 was 1 hour ago, record-2 was 2 hours ago
        $this->assertSame('record-1', $all[0]->entityId());
        $this->assertSame('record-2', $all[1]->entityId());
        $this->assertSame('record-3', $all[2]->entityId());
    }

    public function test_filtering_by_action_and_entity_type(): void
    {
        $this->repository->save(FinancialAuditLog::create(
            companyId: $this->companyA->id,
            action: AuditAction::RECORD_CREATED,
            entityType: 'financial_record',
            entityId: 'rec-1',
            userId: $this->user->id
        ));

        $this->repository->save(FinancialAuditLog::create(
            companyId: $this->companyA->id,
            action: AuditAction::BENCHMARK_CONFIGURED,
            entityType: 'financial_benchmark',
            entityId: 'bm-1',
            userId: $this->user->id
        ));

        $this->repository->save(FinancialAuditLog::create(
            companyId: $this->companyA->id,
            action: AuditAction::CSV_IMPORT_PROCESSED,
            entityType: 'csv_import',
            entityId: 'imp-1',
            userId: $this->user->id
        ));

        $onlyBenchmarks = $this->repository->findByCompanyId(
            $this->companyA->id,
            action: AuditAction::BENCHMARK_CONFIGURED
        );
        $this->assertCount(1, $onlyBenchmarks);
        $this->assertSame('bm-1', $onlyBenchmarks[0]->entityId());

        $onlyImports = $this->repository->findByCompanyId(
            $this->companyA->id,
            entityType: 'csv_import'
        );
        $this->assertCount(1, $onlyImports);
        $this->assertSame('imp-1', $onlyImports[0]->entityId());
    }

    public function test_tenant_isolation_logs_are_never_mixed_between_companies(): void
    {
        $this->repository->save(FinancialAuditLog::create(
            companyId: $this->companyA->id,
            action: AuditAction::RECORD_CREATED,
            entityType: 'financial_record',
            entityId: 'rec-a-1',
            userId: $this->user->id
        ));

        $this->repository->save(FinancialAuditLog::create(
            companyId: $this->companyB->id,
            action: AuditAction::RECORD_CREATED,
            entityType: 'financial_record',
            entityId: 'rec-b-1',
            userId: $this->user->id
        ));

        $logsA = $this->repository->findByCompanyId($this->companyA->id);
        $logsB = $this->repository->findByCompanyId($this->companyB->id);

        $this->assertCount(1, $logsA);
        $this->assertSame('rec-a-1', $logsA[0]->entityId());

        $this->assertCount(1, $logsB);
        $this->assertSame('rec-b-1', $logsB[0]->entityId());

        $this->assertSame(1, $this->repository->countByCompanyId($this->companyA->id));
        $this->assertSame(1, $this->repository->countByCompanyId($this->companyB->id));
    }

    public function test_eloquent_relationships_load_correctly(): void
    {
        $logId = FinancialAuditLogId::generate();
        $this->repository->save(new FinancialAuditLog(
            id: $logId,
            companyId: $this->companyA->id,
            userId: $this->user->id,
            action: AuditAction::RECORD_CREATED,
            entityType: 'financial_record',
            entityId: 'rec-eloquent-test'
        ));

        $eloquentModel = EloquentFinancialAuditLog::with(['company', 'user'])->find($logId->value());

        $this->assertNotNull($eloquentModel);
        $this->assertSame($this->companyA->id, $eloquentModel->company->id);
        $this->assertSame($this->user->id, $eloquentModel->user->id);
    }
}
