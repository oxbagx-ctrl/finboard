<?php

declare(strict_types=1);

namespace Tests\Feature\Api;

use App\Models\Company;
use App\Models\Document;
use App\Models\FinancialRecord;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

final class EndToEndWorkflowApiTest extends TestCase
{
    use DatabaseTransactions;

    private User $adminUser;
    private User $clientUser;
    private Company $acmeCompany;
    private Company $helvestCompany;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');

        $this->helvestCompany = Company::firstOrCreate(
            ['code' => 'HELVEST'],
            ['name' => 'Helvest Advisory Sp. z o.o.', 'tax_id' => 'PL5252525252']
        );

        $this->acmeCompany = Company::firstOrCreate(
            ['code' => 'ACME'],
            ['name' => 'Acme Manufacturing S.A.', 'tax_id' => 'PL7010101010']
        );

        $this->adminUser = User::firstOrCreate(
            ['email' => 'admin@helvest.com'],
            [
                'name' => 'Admin Helvest',
                'password' => bcrypt('password123'),
                'role' => 'admin',
                'company_id' => $this->helvestCompany->id,
                'is_active' => true,
            ]
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

    public function test_complete_deal_advisory_and_collaboration_workflow(): void
    {
        // -----------------------------------------------------------------
        // KROK 1: Logowanie Klienta (CFO Acme) i weryfikacja profilu
        // -----------------------------------------------------------------
        $clientLogin = $this->postJson('/api/v1/auth/login', [
            'email' => 'klient@acme.com',
            'password' => 'password123',
        ]);
        $clientLogin->assertStatus(200);
        $clientToken = $clientLogin->json('token');
        $this->assertNotEmpty($clientToken);

        $clientHeaders = ['Authorization' => 'Bearer ' . $clientToken];

        $meResponse = $this->withHeaders($clientHeaders)->getJson('/api/v1/auth/me');
        $meResponse->assertStatus(200)
            ->assertJsonPath('user.company.code', 'ACME');

        // -----------------------------------------------------------------
        // KROK 2: Klient sprawdza kategorie finansowe oraz wstępne KPI
        // -----------------------------------------------------------------
        $catResponse = $this->withHeaders($clientHeaders)->getJson('/api/v1/finance/categories');
        $catResponse->assertStatus(200)
            ->assertJsonStructure(['data' => ['*' => ['id', 'name', 'type', 'code']]]);

        $initialMetrics = $this->withHeaders($clientHeaders)
            ->getJson('/api/v1/finance/analytics/metrics?start_date=2026-01-01&end_date=2026-03-31');
        $initialMetrics->assertStatus(200);
        $initialRevenue = (float) $initialMetrics->json('data.pnl.revenue.amount');
        $this->assertGreaterThan(0, $initialRevenue);

        // -----------------------------------------------------------------
        // KROK 3: Klient testuje podgląd pliku CSV (dry-run preview)
        // -----------------------------------------------------------------
        $csvContent = "date,category_id,amount,currency,description\n2026-02-15,cat-revenue,150000.00,PLN,Kontrakt eksportowy\n";
        $csvFile = UploadedFile::fake()->createWithContent('import.csv', $csvContent);

        $previewResponse = $this->withHeaders($clientHeaders)
            ->postJson('/api/v1/finance/import/preview', ['file' => $csvFile]);
        $previewResponse->assertStatus(200)
            ->assertJsonPath('valid', true)
            ->assertJsonPath('valid_count', 1)
            ->assertJsonPath('error_count', 0);

        // -----------------------------------------------------------------
        // KROK 4: Klient dodaje nowy rekord finansowy (Przychód 100 000 PLN)
        // -----------------------------------------------------------------
        $createRecordResponse = $this->withHeaders($clientHeaders)
            ->postJson('/api/v1/finance/records', [
                'category_id' => 'cat-revenue',
                'amount' => 100000.00,
                'currency' => 'PLN',
                'record_date' => '2026-02-20',
                'description' => 'Kontrakt strategiczny M&A',
                'source' => 'manual',
            ]);
        $createRecordResponse->assertStatus(201)
            ->assertJsonPath('data.description', 'Kontrakt strategiczny M&A');

        $this->assertEquals(100000.0, (float) $createRecordResponse->json('data.amount'));

        $recordId = $createRecordResponse->json('data.id');

        // -----------------------------------------------------------------
        // KROK 5: Klient weryfikuje aktualizację wskaźników analitycznych
        // -----------------------------------------------------------------
        $updatedMetrics = $this->withHeaders($clientHeaders)
            ->getJson('/api/v1/finance/analytics/metrics?start_date=2026-01-01&end_date=2026-03-31');
        $updatedMetrics->assertStatus(200);
        $updatedRevenue = (float) $updatedMetrics->json('data.pnl.revenue.amount');
        $this->assertEqualsWithDelta($initialRevenue + 100000.00, $updatedRevenue, 0.01);

        // -----------------------------------------------------------------
        // KROK 6: Klient wrzuca poufny raport do Wirtualnego Pokoju Danych (VDR)
        // -----------------------------------------------------------------
        $docContent = "%PDF-1.4 POUFNY AUDYT DUE DILIGENCE SPOLKI ACME";
        $docFile = UploadedFile::fake()->createWithContent('audit_due_diligence.pdf', $docContent);

        $uploadDocResponse = $this->withHeaders($clientHeaders)
            ->postJson('/api/v1/documents', [
                'file' => $docFile,
                'title' => 'Audyt Due Diligence 2026',
                'type' => 'audit_report',
            ]);
        $uploadDocResponse->assertStatus(201)
            ->assertJsonPath('data.title', 'Audyt Due Diligence 2026')
            ->assertJsonPath('data.download_count', 0);

        $documentId = $uploadDocResponse->json('data.id');

        // -----------------------------------------------------------------
        // KROK 7: Logowanie Doradcy (Admin Helvest) i inspekcja danych Acme
        // -----------------------------------------------------------------
        $this->app['auth']->forgetGuards();

        $adminLogin = $this->postJson('/api/v1/auth/login', [
            'email' => 'admin@helvest.com',
            'password' => 'password123',
        ]);
        $adminLogin->assertStatus(200);
        $adminToken = $adminLogin->json('token');
        $adminHeaders = ['Authorization' => 'Bearer ' . $adminToken];

        // Doradca pobiera listę dokumentów klienta Acme
        $adminDocsResponse = $this->withHeaders($adminHeaders)
            ->getJson('/api/v1/documents?company_id=' . $this->acmeCompany->id);
        $adminDocsResponse->assertStatus(200);

        $found = false;
        foreach ($adminDocsResponse->json('data') as $doc) {
            if ($doc['id'] === $documentId) {
                $found = true;
                break;
            }
        }
        $this->assertTrue($found, 'Doradca powinien widzieć dokument wgranego przez klienta Acme.');

        // -----------------------------------------------------------------
        // KROK 8: Doradca pobiera dokument z Pokoju Danych
        // -----------------------------------------------------------------
        $downloadResponse = $this->withHeaders($adminHeaders)
            ->get('/api/v1/documents/' . $documentId . '/download');
        $downloadResponse->assertStatus(200);
        $this->assertSame($docContent, $downloadResponse->getContent());

        // -----------------------------------------------------------------
        // KROK 9: Weryfikacja Dziennika Audytowego (Audit Log)
        // -----------------------------------------------------------------
        $auditLogsResponse = $this->withHeaders($adminHeaders)
            ->getJson('/api/v1/documents/' . $documentId . '/audit-logs');
        $auditLogsResponse->assertStatus(200);

        $actions = array_column($auditLogsResponse->json('data'), 'action');
        $this->assertContains('upload', $actions);
        $this->assertContains('download', $actions);

        // -----------------------------------------------------------------
        // KROK 10: Izolacja Multi-Tenant: Klient próbuje podejrzeć dane Helvest
        // -----------------------------------------------------------------
        $this->app['auth']->forgetGuards();

        $crossTenantFinance = $this->withHeaders($clientHeaders)
            ->getJson('/api/v1/finance/analytics/metrics?company_id=' . $this->helvestCompany->id);
        $crossTenantFinance->assertStatus(403);

        $crossTenantDocuments = $this->withHeaders($clientHeaders)
            ->getJson('/api/v1/documents?company_id=' . $this->helvestCompany->id);
        $crossTenantDocuments->assertStatus(403);

        // -----------------------------------------------------------------
        // KROK 11: Klient aktualizuje i usuwa dodany rekord
        // -----------------------------------------------------------------
        $updateResponse = $this->withHeaders($clientHeaders)
            ->putJson('/api/v1/finance/records/' . $recordId, [
                'category_id' => 'cat-revenue',
                'amount' => 120000.00,
                'currency' => 'PLN',
                'record_date' => '2026-02-25',
                'description' => 'Zaktualizowany kontrakt strategiczny',
            ]);
        $updateResponse->assertStatus(200);

        $deleteResponse = $this->withHeaders($clientHeaders)
            ->deleteJson('/api/v1/finance/records/' . $recordId);
        $deleteResponse->assertStatus(200)
            ->assertJsonPath('status', 'deleted');

        // -----------------------------------------------------------------
        // KROK 12: Wylogowanie obu stron i unieważnienie sesji
        // -----------------------------------------------------------------
        $clientLogout = $this->withHeaders($clientHeaders)->postJson('/api/v1/auth/logout');
        $clientLogout->assertStatus(200);

        $this->app['auth']->forgetGuards();

        $adminLogout = $this->withHeaders($adminHeaders)->postJson('/api/v1/auth/logout');
        $adminLogout->assertStatus(200);

        $this->app['auth']->forgetGuards();

        // Potwierdzenie wygaśnięcia tokenów
        $this->withHeaders($clientHeaders)->getJson('/api/v1/auth/me')->assertStatus(401);
        $this->withHeaders($adminHeaders)->getJson('/api/v1/auth/me')->assertStatus(401);
    }
}
