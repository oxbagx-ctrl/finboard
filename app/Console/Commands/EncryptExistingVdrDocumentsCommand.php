<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Contexts\DocumentManagement\Domain\Services\VdrEncryptionServiceInterface;
use App\Models\Document;
use App\Models\DocumentAccessLog;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Console\ConfirmableTrait;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Throwable;

final class EncryptExistingVdrDocumentsCommand extends Command
{
    use ConfirmableTrait;

    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'vdr:encrypt-existing-documents
                            {--dry-run : Symuluje proces migracji bez fizycznego szyfrowania plików i zapisu do bazy danych}
                            {--chunk=50 : Liczba dokumentów przetwarzanych w pojedynczej paczce}
                            {--key-id= : Opcjonalny identyfikator klucza szyfrowania (domyślnie aktywny klucz)}
                            {--force : Wymusza wykonanie operacji w środowisku produkcyjnym bez pytania o potwierdzenie}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Migruje istniejące nieszyfrowane dokumenty VDR do fizycznego szyfrowania AES-256-GCM z weryfikacją sumy SHA-256 i audytem';

    /**
     * The console command aliases.
     *
     * @var array<int, string>
     */
    protected $aliases = [
        'vdr:encrypt-existing',
    ];

    public function __construct(
        private readonly VdrEncryptionServiceInterface $encryptionService
    ) {
        parent::__construct();
    }

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $dryRun = (bool) $this->option('dry-run');

        if (!$dryRun && !$this->confirmToProceed()) {
            return self::FAILURE;
        }

        $chunkSize = max(1, (int) $this->option('chunk'));
        $keyId = (string) ($this->option('key-id') ?: $this->encryptionService->getActiveKeyId());
        $diskName = (string) config('vdr.storage.disk', 'local');
        $disk = Storage::disk($diskName);

        $unencryptedQuery = Document::where('is_encrypted', false)->orWhereNull('is_encrypted');
        $total = $unencryptedQuery->count();

        if ($total === 0) {
            $this->info('Wszystkie dokumenty w VDR są już fizycznie zaszyfrowane (AES-256-GCM). Brak dokumentów do przetworzenia.');
            return self::SUCCESS;
        }

        $this->newLine();
        $this->info('========================================================================');
        $this->info(' FinBoard VDR - Migracja Szyfrowania Danych Spoczynkowych (AES-256-GCM) ');
        $this->info('========================================================================');
        $this->line(" Liczba dokumentów do przetworzenia : {$total}");
        $this->line(" Rozmiar paczki (chunk)             : {$chunkSize}");
        $this->line(" Tryb wykonania                     : " . ($dryRun ? '<comment>DRY-RUN (symulacja)</comment>' : '<fg=green>PRODUKCYJNY (fizyczny zapis)</fg=green>'));
        $this->line(" Identyfikator klucza (key_id)      : {$keyId}");
        $this->line(" Dysk magazynu                      : {$diskName}");
        $this->info('========================================================================');
        $this->newLine();

        $bar = $this->output->createProgressBar($total);
        $bar->start();

        $processedCount = 0;
        $succeededCount = 0;
        $failedCount = 0;
        $skippedCount = 0;
        $errors = [];

        $defaultUserId = User::first()?->id;

        $unencryptedQuery->chunkById($chunkSize, function (Collection $documents) use (
            $disk,
            $dryRun,
            $keyId,
            $defaultUserId,
            $bar,
            &$processedCount,
            &$succeededCount,
            &$failedCount,
            &$skippedCount,
            &$errors
        ): void {
            /** @var Document $document */
            foreach ($documents as $document) {
                $processedCount++;

                $storagePath = (string) $document->storage_path;
                if ($storagePath === '' || !$disk->exists($storagePath)) {
                    $skippedCount++;
                    $msg = "Dokument [ID: {$document->id}, Tytuł: {$document->title}]: plik nie istnieje w magazynie pod ścieżką '{$storagePath}'.";
                    $errors[] = $msg;
                    Log::warning("VDR Encryption Migration: {$msg}");
                    $bar->advance();
                    continue;
                }

                $rawContent = $disk->get($storagePath);
                if ($rawContent === null) {
                    $skippedCount++;
                    $msg = "Dokument [ID: {$document->id}]: nie udało się odczytać zawartości z magazynu.";
                    $errors[] = $msg;
                    Log::warning("VDR Encryption Migration: {$msg}");
                    $bar->advance();
                    continue;
                }

                // 1. Pre-encryption SHA-256 verification
                $preHash = hash('sha256', $rawContent);
                if (
                    $document->checksum_sha256 !== null &&
                    trim($document->checksum_sha256) !== '' &&
                    $document->checksum_sha256 !== $preHash
                ) {
                    $failedCount++;
                    $msg = "Dokument [ID: {$document->id}]: niezgodność sumy kontrolnej SHA-256 przed szyfrowaniem (oczekiwano: {$document->checksum_sha256}, otrzymano: {$preHash}). Pominięto dla bezpieczeństwa danych.";
                    $errors[] = $msg;
                    Log::error("VDR Encryption Migration: {$msg}");
                    unset($rawContent);
                    $bar->advance();
                    continue;
                }

                try {
                    // 2. Encryption using AES-256-GCM
                    $payload = $this->encryptionService->encrypt($rawContent, $keyId);

                    // 3. Post-encryption in-memory verification
                    $decryptedContent = $this->encryptionService->decrypt(
                        cipherContent: $payload->ciphertext(),
                        iv: $payload->iv(),
                        tag: $payload->tag(),
                        keyId: $payload->keyId(),
                        algorithm: $payload->algorithm()
                    );

                    $postHash = hash('sha256', $decryptedContent);
                    unset($decryptedContent);

                    if ($postHash !== $preHash) {
                        $failedCount++;
                        $msg = "Dokument [ID: {$document->id}]: weryfikacja sumy kontrolnej SHA-256 po odszyfrowaniu nie powiodła się.";
                        $errors[] = $msg;
                        Log::critical("VDR Encryption Migration: {$msg}");
                        unset($rawContent, $payload);
                        $bar->advance();
                        continue;
                    }

                    if ($dryRun) {
                        $succeededCount++;
                        unset($rawContent, $payload);
                        $bar->advance();
                        continue;
                    }

                    // 4. Atomic persistence (Ciphertext to Storage + Metadata to PostgreSQL + Audit Log)
                    DB::transaction(function () use ($disk, $document, $storagePath, $payload, $preHash, $defaultUserId): void {
                        $disk->put($storagePath, $payload->ciphertext());

                        $document->update([
                            'is_encrypted' => true,
                            'encryption_algo' => $payload->algorithm(),
                            'encryption_iv' => $payload->ivBase64(),
                            'encryption_tag' => $payload->tagBase64(),
                            'key_id' => $payload->keyId(),
                            'checksum_sha256' => $preHash,
                        ]);

                        DocumentAccessLog::create([
                            'id' => Str::uuid()->toString(),
                            'document_id' => $document->id,
                            'document_title' => $document->title,
                            'company_id' => $document->company_id,
                            'user_id' => $document->uploaded_by_user_id ?: $defaultUserId,
                            'action' => 'encrypt',
                            'ip_address' => '127.0.0.1',
                            'user_agent' => 'CLI vdr:encrypt-existing-documents',
                            'created_at' => now(),
                        ]);
                    });

                    $succeededCount++;
                    unset($rawContent, $payload);
                    $bar->advance();
                } catch (Throwable $e) {
                    $failedCount++;
                    $msg = "Dokument [ID: {$document->id}]: błąd podczas szyfrowania/zapisu: {$e->getMessage()}";
                    $errors[] = $msg;
                    Log::error("VDR Encryption Migration: {$msg}", ['exception' => $e]);
                    unset($rawContent);
                    $bar->advance();
                }
            }
        });

        $bar->finish();
        $this->newLine(2);

        $this->table(
            ['Metryka', 'Wartość'],
            [
                ['Liczba przetworzonych dokumentów', (string) $processedCount],
                [$dryRun ? 'Zasymulowano pomyślnie (dry-run)' : 'Zaszyfrowano pomyślnie', (string) $succeededCount],
                ['Pominięto (brak pliku)', (string) $skippedCount],
                ['Błędy weryfikacji / zapisu', (string) $failedCount],
            ]
        );

        if (!empty($errors)) {
            $this->newLine();
            $this->warn('Napotkano ostrzeżenia / błędy podczas migracji:');
            foreach ($errors as $error) {
                $this->error(" - {$error}");
            }
        }

        if ($failedCount > 0) {
            $this->error('Migracja zakończona z błędami integralności.');
            return self::FAILURE;
        }

        if ($dryRun) {
            $this->comment('Symulacja migracji (dry-run) zakończona sukcesem. Nie wprowadzono żadnych zmian na dysku ani w bazie.');
        } else {
            $this->info('Migracja szyfrowania dokumentów VDR (AES-256-GCM) zakończona pełnym sukcesem.');
        }

        return self::SUCCESS;
    }
}
