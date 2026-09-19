<?php

declare(strict_types=1);

namespace Tests\Unit\Finance;

use App\Contexts\Finance\Domain\Model\FinancialAuditLog;
use App\Contexts\Finance\Domain\ValueObjects\AuditAction;
use App\Contexts\Finance\Domain\ValueObjects\FinancialAuditLogId;
use DateTimeImmutable;
use InvalidArgumentException;
use PHPUnit\Framework\TestCase;
use Ramsey\Uuid\Uuid;

final class FinancialAuditLogTest extends TestCase
{
    public function test_can_instantiate_valid_financial_audit_log_id(): void
    {
        $uuid = Uuid::uuid4()->toString();
        $id = FinancialAuditLogId::fromString($uuid);

        $this->assertSame($uuid, $id->value());
        $this->assertSame($uuid, (string) $id);

        $generated = FinancialAuditLogId::generate();
        $this->assertTrue(Uuid::isValid($generated->value()));
    }

    public function test_throws_exception_on_invalid_uuid_for_financial_audit_log_id(): void
    {
        $this->expectException(InvalidArgumentException::class);
        FinancialAuditLogId::fromString('not-a-valid-uuid');
    }

    public function test_audit_action_enum_methods(): void
    {
        $this->assertSame('Utworzenie rekordu finansowego', AuditAction::RECORD_CREATED->label());
        $this->assertSame('emerald', AuditAction::RECORD_CREATED->color());
        $this->assertSame('financial_record', AuditAction::RECORD_CREATED->category());

        $this->assertSame('Konfiguracja celu finansowego', AuditAction::BENCHMARK_CONFIGURED->label());
        $this->assertSame('indigo', AuditAction::BENCHMARK_CONFIGURED->color());
        $this->assertSame('benchmark', AuditAction::BENCHMARK_CONFIGURED->category());

        $this->assertSame('Reset celów benchmarkowych', AuditAction::BENCHMARK_RESET->label());
        $this->assertSame('amber', AuditAction::BENCHMARK_RESET->color());

        $this->assertSame('Asynchroniczny import danych CSV', AuditAction::CSV_IMPORT_PROCESSED->label());
        $this->assertSame('cyan', AuditAction::CSV_IMPORT_PROCESSED->color());
        $this->assertSame('import', AuditAction::CSV_IMPORT_PROCESSED->category());
    }

    public function test_can_create_domain_financial_audit_log_instance(): void
    {
        $companyId = Uuid::uuid4()->toString();
        $userId = Uuid::uuid4()->toString();
        $entityId = Uuid::uuid4()->toString();

        $log = FinancialAuditLog::create(
            companyId: $companyId,
            action: AuditAction::BENCHMARK_CONFIGURED,
            entityType: 'financial_benchmark',
            entityId: $entityId,
            userId: $userId,
            description: 'Ustawiono cel wskaźnika Current Ratio na 2.0',
            oldValues: ['target_value' => 1.5],
            newValues: ['target_value' => 2.0],
            ipAddress: '192.168.1.50',
            userAgent: 'Mozilla/5.0 FinBoard Agent'
        );

        $this->assertInstanceOf(FinancialAuditLogId::class, $log->auditLogId());
        $this->assertTrue(Uuid::isValid($log->id()));
        $this->assertSame($companyId, $log->companyId());
        $this->assertSame($userId, $log->userId());
        $this->assertSame(AuditAction::BENCHMARK_CONFIGURED, $log->action());
        $this->assertSame('financial_benchmark', $log->entityType());
        $this->assertSame($entityId, $log->entityId());
        $this->assertSame('Ustawiono cel wskaźnika Current Ratio na 2.0', $log->description());
        $this->assertSame(['target_value' => 1.5], $log->oldValues());
        $this->assertSame(['target_value' => 2.0], $log->newValues());
        $this->assertSame('192.168.1.50', $log->ipAddress());
        $this->assertSame('Mozilla/5.0 FinBoard Agent', $log->userAgent());
        $this->assertInstanceOf(DateTimeImmutable::class, $log->createdAt());
    }

    public function test_throws_exception_when_company_id_is_empty(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('FinancialAuditLog must be associated with a valid companyId.');

        FinancialAuditLog::create(
            companyId: '   ',
            action: AuditAction::RECORD_CREATED,
            entityType: 'financial_record'
        );
    }

    public function test_throws_exception_when_entity_type_is_empty(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('FinancialAuditLog entityType cannot be empty.');

        FinancialAuditLog::create(
            companyId: Uuid::uuid4()->toString(),
            action: AuditAction::RECORD_CREATED,
            entityType: ' '
        );
    }

    public function test_serializes_to_array_correctly(): void
    {
        $companyId = Uuid::uuid4()->toString();
        $id = FinancialAuditLogId::generate();

        $log = new FinancialAuditLog(
            id: $id,
            companyId: $companyId,
            userId: null,
            action: AuditAction::RECORD_DELETED,
            entityType: 'financial_record',
            entityId: 'rec-123',
            description: 'Usunięto rekord kosztowy',
            oldValues: ['amount' => 5000.0],
            newValues: null,
            ipAddress: '127.0.0.1',
            userAgent: 'CLI',
            createdAt: new DateTimeImmutable('2026-03-19 12:00:00')
        );

        $array = $log->toArray();

        $this->assertSame($id->value(), $array['id']);
        $this->assertSame($companyId, $array['company_id']);
        $this->assertNull($array['user_id']);
        $this->assertSame('RECORD_DELETED', $array['action']);
        $this->assertSame('Usunięcie rekordu finansowego', $array['action_label']);
        $this->assertSame('rose', $array['action_color']);
        $this->assertSame('financial_record', $array['entity_type']);
        $this->assertSame('rec-123', $array['entity_id']);
        $this->assertSame('Usunięto rekord kosztowy', $array['description']);
        $this->assertSame(['amount' => 5000.0], $array['old_values']);
        $this->assertNull($array['new_values']);
        $this->assertSame('127.0.0.1', $array['ip_address']);
        $this->assertSame('CLI', $array['user_agent']);
        $this->assertNotEmpty($array['created_at']);
    }
}
