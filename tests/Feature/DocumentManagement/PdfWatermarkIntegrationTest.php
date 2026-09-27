<?php

declare(strict_types=1);

namespace Tests\Feature\DocumentManagement;

use App\Contexts\DocumentManagement\Domain\Repositories\VdrPermissionRepositoryInterface;
use App\Contexts\DocumentManagement\Domain\ValueObjects\AccessSubject;
use App\Contexts\DocumentManagement\Domain\ValueObjects\DocumentId;
use App\Contexts\DocumentManagement\Domain\ValueObjects\PermissionLevel;
use App\Contexts\DocumentManagement\Domain\ValueObjects\VdrPermissionId;
use App\Contexts\DocumentManagement\Domain\Model\VdrDocumentPermission;
use App\Contexts\Identity\Domain\ValueObjects\RoleType;
use App\Models\Company;
use App\Models\Document;
use App\Models\TransactionFolder;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use setasign\Fpdi\Fpdi;
use Tests\TestCase;

final class PdfWatermarkIntegrationTest extends TestCase
{
    use DatabaseTransactions;

    private Company $company;
    private User $superAdmin;
    private User $advisor;
    private User $clientUser;
    private TransactionFolder $folder;
    private Document $pdfDocument;
    private Document $txtDocument;
    private string $rawPdfContent;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');

        $this->company = Company::create([
            'id' => (string) Str::uuid(),
            'name' => 'Acme Due Diligence Sp. z o.o.',
            'code' => 'ACME_WM_' . uniqid(),
            'tax_id' => 'PL' . mt_rand(1000000000, 9999999999),
        ]);

        $this->superAdmin = User::create([
            'id' => (string) Str::uuid(),
            'name' => 'Super Administrator',
            'email' => 'admin_wm_' . uniqid() . '@finboard.pl',
            'password' => Hash::make('secret123'),
            'role' => RoleType::SUPER_ADMIN->value,
            'is_active' => true,
        ]);

        $this->advisor = User::create([
            'id' => (string) Str::uuid(),
            'name' => 'Partner Lead Advisor',
            'email' => 'advisor_wm_' . uniqid() . '@finboard.pl',
            'password' => Hash::make('secret123'),
            'role' => RoleType::ADVISOR->value,
            'is_active' => true,
        ]);
        $this->advisor->assignedCompanies()->attach($this->company->id, [
            'assigned_by' => $this->superAdmin->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->clientUser = User::create([
            'id' => (string) Str::uuid(),
            'name' => 'CFO Jan Zieliński',
            'email' => 'zielinski_' . uniqid() . '@acme.pl',
            'password' => Hash::make('secret123'),
            'role' => RoleType::CLIENT->value,
            'company_id' => $this->company->id,
            'is_active' => true,
        ]);

        $this->folder = TransactionFolder::create([
            'company_id' => $this->company->id,
            'name' => '01 Corporate Governance',
            'index_code' => '01',
            'order_index' => 1,
        ]);

        // Generate a valid PDF
        $fpdf = new Fpdi();
        $fpdf->AddPage();
        $fpdf->SetFont('Helvetica', 'B', 16);
        $fpdf->Cell(40, 10, 'Strictly Confidential Due Diligence Memo');
        $this->rawPdfContent = (string) $fpdf->Output('S');

        $pdfPath = 'dataroom/' . $this->company->id . '/sample_memo.pdf';
        Storage::disk('local')->put($pdfPath, $this->rawPdfContent);

        $this->pdfDocument = Document::create([
            'company_id' => $this->company->id,
            'folder_id' => $this->folder->id,
            'uploaded_by_user_id' => $this->advisor->id,
            'title' => 'Confidential Acquisition Memo',
            'type' => 'contract',
            'storage_path' => $pdfPath,
            'original_name' => 'acquisition_memo.pdf',
            'size_bytes' => strlen($this->rawPdfContent),
            'mime_type' => 'application/pdf',
            'checksum_sha256' => hash('sha256', $this->rawPdfContent),
        ]);

        $txtContent = 'PLAIN TEXT AGREEMENT NOTES';
        $txtPath = 'dataroom/' . $this->company->id . '/notes.txt';
        Storage::disk('local')->put($txtPath, $txtContent);

        $this->txtDocument = Document::create([
            'company_id' => $this->company->id,
            'folder_id' => $this->folder->id,
            'uploaded_by_user_id' => $this->advisor->id,
            'title' => 'Plain Notes',
            'type' => 'other',
            'storage_path' => $txtPath,
            'original_name' => 'notes.txt',
            'size_bytes' => strlen($txtContent),
            'mime_type' => 'text/plain',
            'checksum_sha256' => hash('sha256', $txtContent),
        ]);
    }

    public function test_client_with_watermark_required_receives_dynamically_watermarked_pdf_on_download(): void
    {
        // Grant client download permission with watermark_required = true
        $permRepo = app(VdrPermissionRepositoryInterface::class);
        $permRepo->saveDocumentPermission(VdrDocumentPermission::grant(
            id: VdrPermissionId::generate(),
            companyId: $this->company->id,
            documentId: DocumentId::fromString((string) $this->pdfDocument->id),
            subject: AccessSubject::fromTypeAndId('user', (string) $this->clientUser->id),
            permissionLevel: PermissionLevel::DOWNLOAD,
            watermarkRequired: true
        ));

        Sanctum::actingAs($this->clientUser);

        $response = $this->get('/api/v1/documents/' . $this->pdfDocument->id . '/download');

        $response->assertStatus(200);
        $response->assertHeader('Content-Type', 'application/pdf');
        $this->assertStringContainsString('attachment', (string) $response->headers->get('Content-Disposition'));

        $downloadedContent = $response->getContent();
        $this->assertStringStartsWith('%PDF-', $downloadedContent);
        // Watermarked PDF has additional stamps and streams, so length is strictly greater than original
        $this->assertGreaterThan(strlen($this->rawPdfContent), strlen($downloadedContent));

        // Verify audit log
        $this->assertDatabaseHas('document_access_logs', [
            'document_id' => $this->pdfDocument->id,
            'user_id' => $this->clientUser->id,
            'action' => 'download',
        ]);
    }

    public function test_preview_endpoint_serves_watermarked_pdf_with_inline_disposition(): void
    {
        // Client has default VIEW permission with watermark_required = true
        Sanctum::actingAs($this->clientUser);

        $response = $this->get('/api/v1/documents/' . $this->pdfDocument->id . '/preview');

        $response->assertStatus(200);
        $response->assertHeader('Content-Type', 'application/pdf');
        $this->assertStringContainsString('inline', (string) $response->headers->get('Content-Disposition'));

        $previewContent = $response->getContent();
        $this->assertStringStartsWith('%PDF-', $previewContent);
        $this->assertGreaterThan(strlen($this->rawPdfContent), strlen($previewContent));
    }

    public function test_advisor_without_watermark_receives_original_file(): void
    {
        Sanctum::actingAs($this->advisor);

        $response = $this->get('/api/v1/documents/' . $this->pdfDocument->id . '/download');

        $response->assertStatus(200);
        // Advisor has default DOWNLOAD permission without watermark requirement -> original unmodified content
        $this->assertSame($this->rawPdfContent, $response->getContent());
    }

    public function test_client_with_permission_none_is_forbidden_from_download_and_preview(): void
    {
        // Explicitly revoke access for client: permission_level = NONE
        $permRepo = app(VdrPermissionRepositoryInterface::class);
        $permRepo->saveDocumentPermission(VdrDocumentPermission::grant(
            id: VdrPermissionId::generate(),
            companyId: $this->company->id,
            documentId: DocumentId::fromString((string) $this->pdfDocument->id),
            subject: AccessSubject::fromTypeAndId('user', (string) $this->clientUser->id),
            permissionLevel: PermissionLevel::NONE,
            watermarkRequired: true
        ));

        Sanctum::actingAs($this->clientUser);

        $this->get('/api/v1/documents/' . $this->pdfDocument->id . '/download')->assertStatus(403);
        $this->get('/api/v1/documents/' . $this->pdfDocument->id . '/preview')->assertStatus(403);
    }

    public function test_watermark_can_be_forced_via_query_parameter(): void
    {
        Sanctum::actingAs($this->advisor);

        // Advisor requests download with ?watermark=1
        $response = $this->get('/api/v1/documents/' . $this->pdfDocument->id . '/download?watermark=1');

        $response->assertStatus(200);
        $downloadedContent = $response->getContent();
        $this->assertStringStartsWith('%PDF-', $downloadedContent);
        $this->assertGreaterThan(strlen($this->rawPdfContent), strlen($downloadedContent));
    }

    public function test_non_pdf_file_download_is_served_gracefully_without_corruption(): void
    {
        Sanctum::actingAs($this->advisor);

        $response = $this->get('/api/v1/documents/' . $this->txtDocument->id . '/download?watermark=1');

        $response->assertStatus(200);
        $this->assertSame('PLAIN TEXT AGREEMENT NOTES', $response->getContent());
    }
}
