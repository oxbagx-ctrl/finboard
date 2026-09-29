<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Contexts\DocumentManagement\Domain\Services\VdrEncryptionServiceInterface;
use App\Models\Company;
use App\Models\Document;
use App\Models\DocumentAccessLog;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

final class DocumentDataSeeder extends Seeder
{
    public function __construct(
        private readonly ?VdrEncryptionServiceInterface $encryptionService = null
    ) {
    }

    public function run(): void
    {
        $encryptionService = $this->encryptionService ?? app(VdrEncryptionServiceInterface::class);
        $diskName = (string) Config::get('vdr.storage.disk', 'local');

        $acmeCompany = Company::where('code', 'ACME')->first();
        $helvestCompany = Company::where('code', 'HELVEST')->first();

        $cfoUser = User::where('email', 'klient@acme.com')->first();
        $adminUser = User::where('email', 'admin@helvest.com')->first();

        if (!$acmeCompany || !$helvestCompany || !$cfoUser || !$adminUser) {
            return;
        }

        $acmeDocs = [
            [
                'title' => 'Sprawozdanie Finansowe i Bilans za rok 2025',
                'type' => 'financial_report',
                'original_name' => 'sprawozdanie_finansowe_2025_acme.pdf',
                'mime_type' => 'application/pdf',
                'size_bytes' => 1485760,
                'content' => "%PDF-1.4\n%FINBOARD VDR SECURE DRAFT\nSPRAWOZDANIE FINANSOWE ACME MANUFACTURING S.A. 2025\nBILANS I RACHUNEK ZYSKÓW I STRAT.",
                'downloads' => 14,
                'uploader' => $cfoUser,
            ],
            [
                'title' => 'Raport Niezależnego Biegłego Rewidenta z Badania Sprawozdania 2025',
                'type' => 'audit_report',
                'original_name' => 'raport_bieglego_rewidenta_kpmg_2025.pdf',
                'mime_type' => 'application/pdf',
                'size_bytes' => 2248576,
                'content' => "%PDF-1.4\n%FINBOARD AUDIT DRAFT\nOPINIA I RAPORT NIEZALEŻNEGO BIEGŁEGO REWIDENTA DLA AKCJONARIUSZY ACME MANUFACTURING S.A.",
                'downloads' => 8,
                'uploader' => $adminUser,
            ],
            [
                'title' => 'Umowa Ramowa na Dostawę Zrobotyzowanej Linii Montażowej',
                'type' => 'contract',
                'original_name' => 'umowa_ramowa_kuka_robotics_2025.pdf',
                'mime_type' => 'application/pdf',
                'size_bytes' => 864200,
                'content' => "%PDF-1.4\n%FINBOARD CONTRACT\nUMOWA DOSTAWY I INTEGRACJI SYSTEMU ZROBOTYZOWANEGO KUKA ROBOTICS Z DNIA 15.03.2025.",
                'downloads' => 6,
                'uploader' => $cfoUser,
            ],
            [
                'title' => 'Zeznanie Podatkowe CIT-8 z Załącznikami za rok podatkowy 2025',
                'type' => 'tax_declaration',
                'original_name' => 'cit_8_zeznanie_podatkowe_2025.pdf',
                'mime_type' => 'application/pdf',
                'size_bytes' => 532480,
                'content' => "%PDF-1.4\n%FINBOARD TAX\nDEKLARACJA CIT-8 ORAZ ZAŁĄCZNIK CIT-8/O ZA ROK PODATKOWY 2025. URZĄD SKARBOWY W WARSZAWIE.",
                'downloads' => 4,
                'uploader' => $cfoUser,
            ],
            [
                'title' => 'Memorandum Informacyjne & Teaser Inwestorski – Projekt Vulcan',
                'type' => 'presentation',
                'original_name' => 'memorandum_inwestorskie_projekt_vulcan.pdf',
                'mime_type' => 'application/pdf',
                'size_bytes' => 3984500,
                'content' => "%PDF-1.4\n%FINBOARD M&A MEMO\nMEMORANDUM INFORMACYJNE DLA POTENCJALNYCH INWESTORÓW STRATEGICZNYCH - M&A PROJECT VULCAN.",
                'downloads' => 23,
                'uploader' => $adminUser,
            ],
            [
                'title' => 'Polityka Cyberbezpieczeństwa i Procedury Ochrony Danych RODO',
                'type' => 'other',
                'original_name' => 'polityka_bezpieczenstwa_rodo.pdf',
                'mime_type' => 'application/pdf',
                'size_bytes' => 317440,
                'content' => "%PDF-1.4\n%FINBOARD COMPLIANCE\nPOLITYKA BEZPIECZEŃSTWA INFORMACJI ORAZ PROCEDURY ZGODNOŚCI Z ROZPORZĄDZENIEM RODO ACME.",
                'downloads' => 2,
                'uploader' => $cfoUser,
            ],
        ];

        foreach ($acmeDocs as $item) {
            $docId = (string) Str::uuid();
            $checksum = hash('sha256', $item['content']);
            $storagePath = sprintf('dataroom/%s/%s.pdf', $acmeCompany->id, $docId);

            $encryptedPayload = $encryptionService->encrypt($item['content']);

            Storage::disk($diskName)->put($storagePath, $encryptedPayload->ciphertext());

            $doc = Document::create([
                'id' => $docId,
                'company_id' => $acmeCompany->id,
                'uploaded_by_user_id' => $item['uploader']->id,
                'title' => $item['title'],
                'type' => $item['type'],
                'original_name' => $item['original_name'],
                'mime_type' => $item['mime_type'],
                'size_bytes' => $item['size_bytes'],
                'checksum_sha256' => $checksum,
                'storage_path' => $storagePath,
                'download_count' => $item['downloads'],
                'is_archived' => false,
                'is_encrypted' => true,
                'encryption_algo' => $encryptedPayload->algorithm(),
                'encryption_iv' => $encryptedPayload->ivBase64(),
                'encryption_tag' => $encryptedPayload->tagBase64(),
                'key_id' => $encryptedPayload->keyId(),
            ]);

            // Seed initial upload log
            DocumentAccessLog::create([
                'id' => (string) Str::uuid(),
                'document_id' => $doc->id,
                'user_id' => $item['uploader']->id,
                'action' => 'upload',
                'ip_address' => '127.0.0.1',
                'user_agent' => 'Mozilla/5.0 (X11; Linux x86_64) DealAdvisory/1.0',
                'created_at' => now()->subDays(rand(10, 60)),
            ]);

            // Seed download logs
            for ($i = 0; $i < min($item['downloads'], 5); $i++) {
                DocumentAccessLog::create([
                    'id' => (string) Str::uuid(),
                    'document_id' => $doc->id,
                    'user_id' => ($i % 2 === 0) ? $adminUser->id : $cfoUser->id,
                    'action' => 'download',
                    'ip_address' => '192.168.1.' . rand(10, 50),
                    'user_agent' => 'Mozilla/5.0 (X11; Linux x86_64) DealAdvisory/1.0',
                    'created_at' => now()->subDays(rand(1, 9))->subHours(rand(1, 23)),
                ]);
            }
        }

        // Helvest docs
        $helvestDocs = [
            [
                'title' => 'Model Finansowy DCF & Analiza Mnożnikowa EV/EBITDA Q2 2026',
                'type' => 'financial_report',
                'original_name' => 'model_finansowy_dcf_q2_2026_helvest.xlsx',
                'mime_type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'size_bytes' => 1920000,
                'content' => "PK\x03\x04HELVEST DCF VALUATION MODEL Q2 2026",
                'downloads' => 11,
                'uploader' => $adminUser,
            ],
            [
                'title' => 'Umowa o Zachowaniu Poufności (NDA) – Project Phoenix',
                'type' => 'contract',
                'original_name' => 'nda_project_phoenix.pdf',
                'mime_type' => 'application/pdf',
                'size_bytes' => 450000,
                'content' => "%PDF-1.4\n%FINBOARD NDA\nNON-DISCLOSURE AGREEMENT M&A ADVISORY HELVEST.",
                'downloads' => 7,
                'uploader' => $adminUser,
            ],
        ];

        foreach ($helvestDocs as $item) {
            $docId = (string) Str::uuid();
            $checksum = hash('sha256', $item['content']);
            $storagePath = sprintf('dataroom/%s/%s.bin', $helvestCompany->id, $docId);

            $encryptedPayload = $encryptionService->encrypt($item['content']);

            Storage::disk($diskName)->put($storagePath, $encryptedPayload->ciphertext());

            $doc = Document::create([
                'id' => $docId,
                'company_id' => $helvestCompany->id,
                'uploaded_by_user_id' => $item['uploader']->id,
                'title' => $item['title'],
                'type' => $item['type'],
                'original_name' => $item['original_name'],
                'mime_type' => $item['mime_type'],
                'size_bytes' => $item['size_bytes'],
                'checksum_sha256' => $checksum,
                'storage_path' => $storagePath,
                'download_count' => $item['downloads'],
                'is_archived' => false,
                'is_encrypted' => true,
                'encryption_algo' => $encryptedPayload->algorithm(),
                'encryption_iv' => $encryptedPayload->ivBase64(),
                'encryption_tag' => $encryptedPayload->tagBase64(),
                'key_id' => $encryptedPayload->keyId(),
            ]);

            DocumentAccessLog::create([
                'id' => (string) Str::uuid(),
                'document_id' => $doc->id,
                'user_id' => $item['uploader']->id,
                'action' => 'upload',
                'ip_address' => '127.0.0.1',
                'user_agent' => 'Mozilla/5.0 (X11; Linux x86_64) DealAdvisory/1.0',
                'created_at' => now()->subDays(15),
            ]);
        }
    }
}
