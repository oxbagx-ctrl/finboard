<?php

declare(strict_types=1);

namespace Tests\Unit\DocumentManagement;

use App\Contexts\DocumentManagement\Application\Queries\GetVdrAuditLogs\GetVdrAuditLogsHandler;
use App\Contexts\DocumentManagement\Application\Queries\GetVdrAuditLogs\GetVdrAuditLogsQuery;
use App\Models\Company;
use App\Models\Document;
use App\Models\DocumentAccessLog;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Str;
use Tests\TestCase;

final class GetVdrAuditLogsQueryTest extends TestCase
{
    use DatabaseTransactions;

    private GetVdrAuditLogsHandler $handler;
    private Company $companyA;
    private Company $companyB;
    private User $userA;
    private User $userB;

    protected function setUp(): void
    {
        parent::setUp();
        $this->handler = $this->app->make(GetVdrAuditLogsHandler::class);

        $suffix = (string) Str::uuid();
        $this->companyA = Company::create([
            'id' => (string) Str::uuid(),
            'name' => "Tenant Alpha {$suffix}",
            'code' => 'TA_' . substr(str_replace('-', '', $suffix), 0, 8),
            'tax_id' => 'PL' . substr(str_replace('-', '', $suffix), 0, 10),
        ]);

        $this->companyB = Company::create([
            'id' => (string) Str::uuid(),
            'name' => "Tenant Beta {$suffix}",
            'code' => 'TB_' . substr(str_replace('-', '', $suffix), 0, 8),
            'tax_id' => 'PL' . substr(strrev(str_replace('-', '', $suffix)), 0, 10),
        ]);

        $this->userA = User::factory()->create([
            'company_id' => $this->companyA->id,
            'name' => 'Alice Auditor',
            'email' => "alice.{$suffix}@audit.pl",
        ]);

        $this->userB = User::factory()->create([
            'company_id' => $this->companyB->id,
            'name' => 'Bob Beta',
            'email' => "bob.{$suffix}@beta.pl",
        ]);
    }

    public function test_filter_by_company_and_action(): void
    {
        DocumentAccessLog::create([
            'id' => (string) Str::uuid(),
            'company_id' => $this->companyA->id,
            'user_id' => $this->userA->id,
            'action' => 'upload',
            'document_title' => 'Financial Model.xlsx',
            'created_at' => now()->subMinutes(10),
        ]);

        DocumentAccessLog::create([
            'id' => (string) Str::uuid(),
            'company_id' => $this->companyA->id,
            'user_id' => $this->userA->id,
            'action' => 'download',
            'document_title' => 'Tax Opinion.pdf',
            'created_at' => now()->subMinutes(5),
        ]);

        // Beta company log
        DocumentAccessLog::create([
            'id' => (string) Str::uuid(),
            'company_id' => $this->companyB->id,
            'user_id' => $this->userB->id,
            'action' => 'upload',
            'document_title' => 'Beta Secret.pdf',
            'created_at' => now()->subMinutes(2),
        ]);

        // Query uploads for Company A only
        $query = new GetVdrAuditLogsQuery(
            companyId: $this->companyA->id,
            action: 'upload'
        );

        $results = $this->handler->handle($query);

        $this->assertCount(1, $results->items());
        $this->assertSame('Financial Model.xlsx', $results->items()[0]->document_title);
        $this->assertSame('upload', $results->items()[0]->action);
    }

    public function test_filter_by_comma_separated_actions(): void
    {
        DocumentAccessLog::create([
            'id' => (string) Str::uuid(),
            'company_id' => $this->companyA->id,
            'user_id' => $this->userA->id,
            'action' => 'upload',
            'document_title' => 'Doc 1.pdf',
            'created_at' => now()->subMinutes(10),
        ]);

        DocumentAccessLog::create([
            'id' => (string) Str::uuid(),
            'company_id' => $this->companyA->id,
            'user_id' => $this->userA->id,
            'action' => 'update',
            'document_title' => 'Doc 2.pdf',
            'created_at' => now()->subMinutes(5),
        ]);

        DocumentAccessLog::create([
            'id' => (string) Str::uuid(),
            'company_id' => $this->companyA->id,
            'user_id' => $this->userA->id,
            'action' => 'download',
            'document_title' => 'Doc 3.pdf',
            'created_at' => now()->subMinutes(2),
        ]);

        $query = new GetVdrAuditLogsQuery(
            companyId: $this->companyA->id,
            action: 'upload,update'
        );

        $results = $this->handler->handle($query);

        $this->assertCount(2, $results->items());
        $actions = array_map(fn($item) => $item->action, $results->items());
        $this->assertContains('upload', $actions);
        $this->assertContains('update', $actions);
        $this->assertNotContains('download', $actions);
    }

    public function test_case_insensitive_search_across_document_title_and_user(): void
    {
        DocumentAccessLog::create([
            'id' => (string) Str::uuid(),
            'company_id' => $this->companyA->id,
            'user_id' => $this->userA->id,
            'action' => 'download',
            'document_title' => 'Audyt_Spółki_Przejęcie.pdf',
            'ip_address' => '192.168.1.100',
            'created_at' => now(),
        ]);

        DocumentAccessLog::create([
            'id' => (string) Str::uuid(),
            'company_id' => $this->companyA->id,
            'user_id' => $this->userA->id,
            'action' => 'update',
            'document_title' => 'Umowa_Inwestycyjna.docx',
            'ip_address' => '10.0.0.5',
            'created_at' => now(),
        ]);

        // Search by title fragment
        $searchQuery = new GetVdrAuditLogsQuery(
            companyId: $this->companyA->id,
            search: 'przejęcie'
        );
        $results = $this->handler->handle($searchQuery);
        $this->assertCount(1, $results->items());
        $this->assertSame('Audyt_Spółki_Przejęcie.pdf', $results->items()[0]->document_title);

        // Search by IP address
        $ipQuery = new GetVdrAuditLogsQuery(
            companyId: $this->companyA->id,
            search: '192.168.1'
        );
        $resultsIp = $this->handler->handle($ipQuery);
        $this->assertCount(1, $resultsIp->items());

        // Search by user name
        $userQuery = new GetVdrAuditLogsQuery(
            companyId: $this->companyA->id,
            search: 'Alice Auditor'
        );
        $resultsUser = $this->handler->handle($userQuery);
        $this->assertCount(2, $resultsUser->items());
    }

    public function test_filter_by_specific_document_id(): void
    {
        $docA = Document::create([
            'id' => (string) Str::uuid(),
            'company_id' => $this->companyA->id,
            'uploaded_by_user_id' => $this->userA->id,
            'title' => 'Target Doc',
            'type' => 'other',
            'original_name' => 'target.pdf',
            'mime_type' => 'application/pdf',
            'size_bytes' => 1024,
            'checksum_sha256' => hash('sha256', 'target'),
            'storage_path' => 'vdr/target.pdf',
        ]);

        $docB = Document::create([
            'id' => (string) Str::uuid(),
            'company_id' => $this->companyA->id,
            'uploaded_by_user_id' => $this->userA->id,
            'title' => 'Other Doc',
            'type' => 'other',
            'original_name' => 'other.pdf',
            'mime_type' => 'application/pdf',
            'size_bytes' => 1024,
            'checksum_sha256' => hash('sha256', 'other'),
            'storage_path' => 'vdr/other.pdf',
        ]);

        DocumentAccessLog::create([
            'id' => (string) Str::uuid(),
            'document_id' => $docA->id,
            'company_id' => $this->companyA->id,
            'user_id' => $this->userA->id,
            'action' => 'download',
            'document_title' => 'Target Doc.pdf',
            'created_at' => now(),
        ]);

        DocumentAccessLog::create([
            'id' => (string) Str::uuid(),
            'document_id' => $docB->id,
            'company_id' => $this->companyA->id,
            'user_id' => $this->userA->id,
            'action' => 'download',
            'document_title' => 'Other Doc.pdf',
            'created_at' => now(),
        ]);

        $query = new GetVdrAuditLogsQuery(
            companyId: $this->companyA->id,
            documentId: $docA->id
        );

        $results = $this->handler->handle($query);

        $this->assertCount(1, $results->items());
        $this->assertSame($docA->id, $results->items()[0]->document_id);
    }
}
