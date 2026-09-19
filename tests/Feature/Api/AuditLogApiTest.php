<?php

declare(strict_types=1);

namespace Tests\Feature\Api;

use App\Contexts\Finance\Domain\ValueObjects\AuditAction;
use App\Models\Company;
use App\Models\FinancialAuditLog;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Str;
use Tests\TestCase;

final class AuditLogApiTest extends TestCase
{
    use DatabaseTransactions;

    private Company $companyA;
    private Company $companyB;
    private User $admin;
    private User $advisor;
    private User $clientA;
    private User $clientB;

    protected function setUp(): void
    {
        parent::setUp();

        $this->companyA = Company::create([
            'id' => (string) Str::uuid(),
            'name' => 'Audit Test Alpha Sp. z o.o.',
            'code' => 'AUD_A_' . Str::random(4),
            'tax_id' => 'PL' . random_int(1000000000, 9999999999),
        ]);

        $this->companyB = Company::create([
            'id' => (string) Str::uuid(),
            'name' => 'Audit Test Beta S.A.',
            'code' => 'AUD_B_' . Str::random(4),
            'tax_id' => 'PL' . random_int(1000000000, 9999999999),
        ]);

        $this->admin = User::create([
            'id' => (string) Str::uuid(),
            'name' => 'Super Admin',
            'email' => 'admin_audit_' . Str::random(6) . '@finboard.local',
            'password' => bcrypt('secret123'),
            'role' => 'super_admin',
            'company_id' => $this->companyA->id,
            'is_active' => true,
        ]);

        $this->advisor = User::create([
            'id' => (string) Str::uuid(),
            'name' => 'Portfolio Advisor',
            'email' => 'advisor_audit_' . Str::random(6) . '@finboard.local',
            'password' => bcrypt('secret123'),
            'role' => 'advisor',
            'company_id' => $this->companyA->id,
            'is_active' => true,
        ]);

        // Assign advisor to companyA without extra id in pivot
        $this->advisor->assignedCompanies()->attach($this->companyA->id);

        $this->clientA = User::create([
            'id' => (string) Str::uuid(),
            'name' => 'CFO Client Alpha',
            'email' => 'client_a_' . Str::random(6) . '@alpha.com',
            'password' => bcrypt('secret123'),
            'role' => 'client',
            'company_id' => $this->companyA->id,
            'is_active' => true,
        ]);

        $this->clientB = User::create([
            'id' => (string) Str::uuid(),
            'name' => 'CFO Client Beta',
            'email' => 'client_b_' . Str::random(6) . '@beta.com',
            'password' => bcrypt('secret123'),
            'role' => 'client',
            'company_id' => $this->companyB->id,
            'is_active' => true,
        ]);
    }

    public function test_unauthenticated_request_returns_401(): void
    {
        $response = $this->getJson('/api/v1/finance/audit-logs');
        $response->assertStatus(401);
    }

    public function test_client_can_retrieve_own_company_audit_logs(): void
    {
        $this->createAuditLog($this->companyA->id, $this->clientA->id, AuditAction::RECORD_CREATED, 'Utworzono rekord 1');
        $this->createAuditLog($this->companyA->id, $this->clientA->id, AuditAction::RECORD_UPDATED, 'Zaktualizowano rekord 1');
        $this->createAuditLog($this->companyB->id, $this->clientB->id, AuditAction::RECORD_CREATED, 'Utworzono rekord w firmie B');

        $this->actingAs($this->clientA);

        $response = $this->getJson('/api/v1/finance/audit-logs');

        $response->assertStatus(200)
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('company_id', $this->companyA->id);

        $data = $response->json('data');
        $this->assertCount(2, $data);
        foreach ($data as $item) {
            $this->assertSame($this->companyA->id, $item['company_id']);
        }
    }

    public function test_client_cannot_access_other_company_audit_logs(): void
    {
        $this->actingAs($this->clientA);

        $response = $this->getJson('/api/v1/finance/audit-logs?company_id=' . $this->companyB->id);
        $response->assertStatus(403);
    }

    public function test_advisor_can_retrieve_assigned_company_audit_logs(): void
    {
        $this->createAuditLog($this->companyA->id, $this->advisor->id, AuditAction::BENCHMARK_CONFIGURED, 'Skonfigurowano cel wskaźnika');

        $this->actingAs($this->advisor);

        $response = $this->getJson('/api/v1/finance/audit-logs?company_id=' . $this->companyA->id);

        $response->assertStatus(200)
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('company_id', $this->companyA->id);

        $data = $response->json('data');
        $this->assertNotEmpty($data);
        $this->assertSame('BENCHMARK_CONFIGURED', $data[0]['action']);
        $this->assertSame('Konfiguracja celu finansowego', $data[0]['action_label']);
    }

    public function test_advisor_cannot_retrieve_unassigned_company_audit_logs(): void
    {
        $this->actingAs($this->advisor);

        $response = $this->getJson('/api/v1/finance/audit-logs?company_id=' . $this->companyB->id);
        $response->assertStatus(403);
    }

    public function test_admin_can_retrieve_any_company_audit_logs(): void
    {
        $this->createAuditLog($this->companyB->id, $this->clientB->id, AuditAction::RECORD_CREATED, 'Utworzono rekord w firmie B');

        $this->actingAs($this->admin);

        $response = $this->getJson('/api/v1/finance/audit-logs?company_id=' . $this->companyB->id);

        $response->assertStatus(200)
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('company_id', $this->companyB->id);

        $data = $response->json('data');
        $this->assertCount(1, $data);
        $this->assertSame($this->companyB->id, $data[0]['company_id']);
    }

    public function test_filters_by_action_and_entity_type(): void
    {
        $this->createAuditLog($this->companyA->id, $this->clientA->id, AuditAction::RECORD_CREATED, 'Utworzono rekord', 'financial_record');
        $this->createAuditLog($this->companyA->id, $this->clientA->id, AuditAction::BENCHMARK_CONFIGURED, 'Skonfigurowano cel', 'financial_benchmark');
        $this->createAuditLog($this->companyA->id, $this->clientA->id, AuditAction::CSV_IMPORT_PROCESSED, 'Zaimportowano CSV', 'csv_import');

        $this->actingAs($this->clientA);

        // Filter by action
        $resAction = $this->getJson('/api/v1/finance/audit-logs?action=BENCHMARK_CONFIGURED');
        $resAction->assertStatus(200);
        $this->assertCount(1, $resAction->json('data'));
        $this->assertSame('BENCHMARK_CONFIGURED', $resAction->json('data.0.action'));

        // Filter by entity_type
        $resEntity = $this->getJson('/api/v1/finance/audit-logs?entity_type=csv_import');
        $resEntity->assertStatus(200);
        $this->assertCount(1, $resEntity->json('data'));
        $this->assertSame('csv_import', $resEntity->json('data.0.entity_type'));
    }

    public function test_filters_by_search_query(): void
    {
        $this->createAuditLog($this->companyA->id, $this->clientA->id, AuditAction::RECORD_CREATED, 'Specjalny kontrakt exportowy Alpha', 'financial_record', 'REC-ALPHA-999');
        $this->createAuditLog($this->companyA->id, $this->clientA->id, AuditAction::RECORD_CREATED, 'Standardowe koszty biurowe', 'financial_record', 'REC-STD-001');

        $this->actingAs($this->clientA);

        $res = $this->getJson('/api/v1/finance/audit-logs?search=exportowy');
        $res->assertStatus(200);
        $this->assertCount(1, $res->json('data'));
        $this->assertStringContainsString('exportowy', $res->json('data.0.description'));

        $resById = $this->getJson('/api/v1/finance/audit-logs?search=ALPHA-999');
        $resById->assertStatus(200);
        $this->assertCount(1, $resById->json('data'));
    }

    public function test_show_audit_log_details(): void
    {
        $logA = $this->createAuditLog($this->companyA->id, $this->clientA->id, AuditAction::RECORD_UPDATED, 'Zaktualizowano kwotę');
        $logB = $this->createAuditLog($this->companyB->id, $this->clientB->id, AuditAction::RECORD_DELETED, 'Usunięto rekord');

        $this->actingAs($this->clientA);

        // Can view own log
        $res = $this->getJson('/api/v1/finance/audit-logs/' . $logA->id);
        $res->assertStatus(200)
            ->assertJsonPath('data.id', $logA->id)
            ->assertJsonPath('data.action', 'RECORD_UPDATED');

        // Cannot view log of another company
        $resForbidden = $this->getJson('/api/v1/finance/audit-logs/' . $logB->id);
        $resForbidden->assertStatus(403);

        // Non-existent log returns 404
        $resNotFound = $this->getJson('/api/v1/finance/audit-logs/' . Str::uuid());
        $resNotFound->assertStatus(404);
    }

    public function test_stats_endpoint_returns_aggregated_metrics(): void
    {
        $this->createAuditLog($this->companyA->id, $this->clientA->id, AuditAction::RECORD_CREATED, 'Utworzono rekord 1');
        $this->createAuditLog($this->companyA->id, $this->clientA->id, AuditAction::RECORD_CREATED, 'Utworzono rekord 2');
        $this->createAuditLog($this->companyA->id, $this->clientA->id, AuditAction::RECORD_DELETED, 'Usunięto rekord 3');

        $this->actingAs($this->clientA);

        $response = $this->getJson('/api/v1/finance/audit-logs/stats');

        $response->assertStatus(200)
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('company_id', $this->companyA->id)
            ->assertJsonPath('data.total_events', 3);

        $actions = $response->json('data.by_action');
        $this->assertArrayHasKey('RECORD_CREATED', $actions);
        $this->assertSame(2, $actions['RECORD_CREATED']['count']);
        $this->assertSame('Utworzenie rekordu finansowego', $actions['RECORD_CREATED']['label']);
        $this->assertSame('emerald', $actions['RECORD_CREATED']['color']);

        $this->assertArrayHasKey('RECORD_DELETED', $actions);
        $this->assertSame(1, $actions['RECORD_DELETED']['count']);
    }

    private function createAuditLog(
        string $companyId,
        string $userId,
        AuditAction $action,
        string $description,
        string $entityType = 'financial_record',
        ?string $entityId = null
    ): FinancialAuditLog {
        return FinancialAuditLog::create([
            'id' => (string) Str::uuid(),
            'company_id' => $companyId,
            'user_id' => $userId,
            'action' => $action->value,
            'entity_type' => $entityType,
            'entity_id' => $entityId ?? (string) Str::uuid(),
            'description' => $description,
            'old_values' => ['amount' => '10000.00'],
            'new_values' => ['amount' => '12000.00'],
            'ip_address' => '127.0.0.1',
            'user_agent' => 'PHPUnit Integration Test',
            'created_at' => now(),
        ]);
    }
}
