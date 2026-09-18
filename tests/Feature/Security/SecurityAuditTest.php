<?php

declare(strict_types=1);

namespace Tests\Feature\Security;

use App\Models\Company;
use App\Models\Document;
use App\Models\FinancialRecord;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

final class SecurityAuditTest extends TestCase
{
    use DatabaseTransactions;

    private User $tenantAClient;
    private User $tenantBClient;
    private User $adminUser;
    private Company $companyA;
    private Company $companyB;
    private FinancialRecord $recordB;
    private Document $documentB;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');

        $this->companyA = Company::firstOrCreate(
            ['code' => 'TENANT_A'],
            ['name' => 'Alpha Corporation Sp. z o.o.', 'tax_id' => 'PL1111111111']
        );

        $this->companyB = Company::firstOrCreate(
            ['code' => 'TENANT_B'],
            ['name' => 'Beta Logistics S.A.', 'tax_id' => 'PL2222222222']
        );

        $this->tenantAClient = User::firstOrCreate(
            ['email' => 'cfo@alphacorp.com'],
            [
                'name' => 'Anna Kowal (CFO Alpha)',
                'password' => bcrypt('password123'),
                'role' => 'client',
                'company_id' => $this->companyA->id,
                'is_active' => true,
            ]
        );

        $this->tenantBClient = User::firstOrCreate(
            ['email' => 'cfo@betalogistics.com'],
            [
                'name' => 'Bogdan Nowak (CFO Beta)',
                'password' => bcrypt('password123'),
                'role' => 'client',
                'company_id' => $this->companyB->id,
                'is_active' => true,
            ]
        );

        $this->adminUser = User::firstOrCreate(
            ['email' => 'lead.advisor@helvest.com'],
            [
                'name' => 'Helvest Lead Advisor',
                'password' => bcrypt('password123'),
                'role' => 'admin',
                'company_id' => $this->companyA->id,
                'is_active' => true,
            ]
        );

        // Seed record and document for Tenant B
        $this->recordB = FinancialRecord::create([
            'company_id' => $this->companyB->id,
            'category_id' => 'cat-revenue',
            'record_type' => 'REVENUE',
            'amount' => 500000.00,
            'currency' => 'PLN',
            'record_date' => '2026-03-01',
            'description' => 'Beta Confidential Strategic Revenue',
            'source' => 'manual',
        ]);

        $filePath = 'documents/' . $this->companyB->id . '/beta_confidential.pdf';
        Storage::disk('local')->put($filePath, 'CONFIDENTIAL BETA ACQUISITION MEMO');

        $this->documentB = Document::create([
            'company_id' => $this->companyB->id,
            'uploaded_by_user_id' => $this->tenantBClient->id,
            'title' => 'Beta Project Falcon DD Memo',
            'type' => 'audit_report',
            'storage_path' => $filePath,
            'original_name' => 'beta_confidential.pdf',
            'size_bytes' => 1024,
            'mime_type' => 'application/pdf',
            'checksum_sha256' => hash('sha256', 'CONFIDENTIAL BETA ACQUISITION MEMO'),
            'is_archived' => false,
            'download_count' => 0,
        ]);
    }

    public function test_tenant_a_cannot_read_tenant_b_financial_record(): void
    {
        $response = $this->actingAs($this->tenantAClient, 'sanctum')
            ->getJson('/api/v1/finance/records/' . $this->recordB->id);

        $response->assertStatus(403);
    }

    public function test_tenant_a_cannot_modify_tenant_b_financial_record(): void
    {
        $response = $this->actingAs($this->tenantAClient, 'sanctum')
            ->putJson('/api/v1/finance/records/' . $this->recordB->id, [
                'category_id' => 'cat-revenue',
                'amount' => 999999.00,
                'currency' => 'PLN',
                'record_date' => '2026-03-01',
                'description' => 'Malicious cross-tenant override attempt',
            ]);

        $response->assertStatus(403);

        // Verify record in database was NOT modified
        $this->recordB->refresh();
        $this->assertEquals(500000.00, (float) $this->recordB->amount);
        $this->assertEquals('Beta Confidential Strategic Revenue', $this->recordB->description);
    }

    public function test_tenant_a_cannot_delete_tenant_b_financial_record(): void
    {
        $response = $this->actingAs($this->tenantAClient, 'sanctum')
            ->deleteJson('/api/v1/finance/records/' . $this->recordB->id);

        $response->assertStatus(403);

        // Verify record still exists
        $this->assertDatabaseHas('financial_records', ['id' => $this->recordB->id]);
    }

    public function test_tenant_a_cannot_download_tenant_b_document(): void
    {
        $response = $this->actingAs($this->tenantAClient, 'sanctum')
            ->get('/api/v1/documents/' . $this->documentB->id . '/download');

        $response->assertStatus(403);
    }

    public function test_tenant_a_cannot_alter_tenant_b_document_metadata_or_status(): void
    {
        // Update metadata
        $this->actingAs($this->tenantAClient, 'sanctum')
            ->putJson('/api/v1/documents/' . $this->documentB->id, [
                'title' => 'Compromised Document Title',
                'type' => 'other',
            ])->assertStatus(403);

        // Archive
        $this->actingAs($this->tenantAClient, 'sanctum')
            ->patchJson('/api/v1/documents/' . $this->documentB->id . '/archive')
            ->assertStatus(403);

        // Delete
        $this->actingAs($this->tenantAClient, 'sanctum')
            ->deleteJson('/api/v1/documents/' . $this->documentB->id)
            ->assertStatus(403);

        $this->documentB->refresh();
        $this->assertEquals('Beta Project Falcon DD Memo', $this->documentB->title);
        $this->assertFalse($this->documentB->is_archived);
    }

    public function test_tenant_a_cannot_access_tenant_b_audit_trail(): void
    {
        $response = $this->actingAs($this->tenantAClient, 'sanctum')
            ->getJson('/api/v1/documents/' . $this->documentB->id . '/audit-logs');

        $response->assertStatus(403);
    }

    public function test_tenant_a_header_or_param_spoofing_is_rejected(): void
    {
        // Attempt spoofing via header
        $response1 = $this->actingAs($this->tenantAClient, 'sanctum')
            ->withHeaders(['X-Company-Id' => $this->companyB->id])
            ->getJson('/api/v1/finance/analytics/metrics');

        $response1->assertStatus(403);

        // Attempt spoofing via query param
        $response2 = $this->actingAs($this->tenantAClient, 'sanctum')
            ->getJson('/api/v1/finance/analytics/metrics?company_id=' . $this->companyB->id);

        $response2->assertStatus(403);
    }

    public function test_privilege_escalation_attempt_to_admin_route_is_blocked(): void
    {
        $response = $this->actingAs($this->tenantAClient, 'sanctum')
            ->getJson('/api/v1/admin/probe');

        $response->assertStatus(403);
    }

    public function test_unauthenticated_requests_are_consistently_rejected(): void
    {
        $this->getJson('/api/v1/auth/me')->assertStatus(401);
        $this->getJson('/api/v1/finance/records')->assertStatus(401);
        $this->getJson('/api/v1/finance/analytics/metrics')->assertStatus(401);
        $this->getJson('/api/v1/documents')->assertStatus(401);
        $this->postJson('/api/v1/auth/logout')->assertStatus(401);
    }

    public function test_admin_can_legitimately_access_and_switch_between_tenants(): void
    {
        // Admin accessing Tenant A
        $responseA = $this->actingAs($this->adminUser, 'sanctum')
            ->withHeaders(['X-Company-Id' => $this->companyA->id])
            ->getJson('/api/v1/finance/analytics/metrics');
        $responseA->assertStatus(200);

        // Admin accessing Tenant B
        $responseB = $this->actingAs($this->adminUser, 'sanctum')
            ->withHeaders(['X-Company-Id' => $this->companyB->id])
            ->getJson('/api/v1/finance/analytics/metrics');
        $responseB->assertStatus(200);

        // Admin can download Tenant B's document
        $download = $this->actingAs($this->adminUser, 'sanctum')
            ->get('/api/v1/documents/' . $this->documentB->id . '/download');
        $download->assertStatus(200);
    }
}
