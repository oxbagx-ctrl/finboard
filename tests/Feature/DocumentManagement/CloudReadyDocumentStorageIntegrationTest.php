<?php

declare(strict_types=1);

namespace Tests\Feature\DocumentManagement;

use App\Contexts\DocumentManagement\Domain\Services\VdrEncryptionServiceInterface;
use App\Contexts\DocumentManagement\Infrastructure\Storage\CloudReadyDocumentStorage;
use App\Contexts\DocumentManagement\Infrastructure\Storage\LocalStorageDocumentStorage;
use App\Contexts\DocumentManagement\Infrastructure\Storage\TransactionalStorageManager;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Storage;
use RuntimeException;
use Tests\TestCase;

final class CloudReadyDocumentStorageIntegrationTest extends TestCase
{
    use DatabaseTransactions;

    private string $testDirectory;

    protected function setUp(): void
    {
        parent::setUp();

        $this->testDirectory = 'dataroom/test-cloud-ready-' . uniqid();
        Config::set('vdr.storage.disk', 'local');
    }

    protected function tearDown(): void
    {
        Storage::disk('local')->deleteDirectory($this->testDirectory);
        parent::tearDown();
    }

    public function test_cloud_ready_storage_preserves_raw_binary_ciphertext(): void
    {
        $storage = new CloudReadyDocumentStorage();
        $encryptionService = $this->app->make(VdrEncryptionServiceInterface::class);

        $plainContent = "%PDF-1.4\n%Confidential Strategic Acquisition Model\nBinary bytes: \x00\x01\x02\xFF\xFE\xFD";
        $encryptedPayload = $encryptionService->encrypt($plainContent);

        $storedPath = $storage->store(
            content: $encryptedPayload->ciphertext(),
            directory: $this->testDirectory,
            filename: 'audit_model.bin'
        );

        $this->assertTrue($storage->exists($storedPath));

        $retrievedCiphertext = $storage->get($storedPath);
        $this->assertSame($encryptedPayload->ciphertext(), $retrievedCiphertext);

        // Decrypt retrieved content to confirm bit-for-bit fidelity
        $decrypted = $encryptionService->decrypt(
            cipherContent: $retrievedCiphertext,
            iv: $encryptedPayload->iv(),
            tag: $encryptedPayload->tag(),
            keyId: $encryptedPayload->keyId()
        );

        $this->assertSame($plainContent, $decrypted);
    }

    public function test_full_path_gracefully_handles_cloud_storage_without_local_path(): void
    {
        // Mock a filesystem driver that throws BadMethodCallException on path() (e.g. OCI Object Storage / S3)
        $mockDisk = $this->createMock(Filesystem::class);
        $mockDisk->method('path')
            ->willThrowException(new \BadMethodCallException('This driver does not support retrieving paths.'));

        $storage = new CloudReadyDocumentStorage($mockDisk);
        $path = 'dataroom/company-1/doc-123.bin';

        $resolvedPath = $storage->fullPath($path);
        $this->assertSame($path, $resolvedPath, 'Cloud drivers without local paths must return the storage path without throwing.');
    }

    public function test_transactional_storage_manager_rolls_back_orphan_ciphertext_on_failure(): void
    {
        $storage = new LocalStorageDocumentStorage();
        $manager = new TransactionalStorageManager($storage);

        $createdPath = null;

        try {
            $manager->transaction(function (TransactionalStorageManager $txManager) use (&$createdPath) {
                $createdPath = $txManager->store(
                    content: 'temporary_ciphertext_that_should_be_rolled_back',
                    directory: $this->testDirectory,
                    filename: 'orphan_test.bin'
                );

                $this->assertTrue($txManager->exists($createdPath));

                // Force database/business logic failure
                throw new RuntimeException('Simulated database error during document creation transaction.');
            });
        } catch (RuntimeException $e) {
            $this->assertSame('Simulated database error during document creation transaction.', $e->getMessage());
        }

        $this->assertNotNull($createdPath);
        $this->assertFalse(
            $storage->exists($createdPath),
            'Orphan ciphertext file must be physically removed on transaction rollback.'
        );
    }

    public function test_transactional_storage_manager_commits_pending_deletions_on_success(): void
    {
        $storage = new LocalStorageDocumentStorage();
        $manager = new TransactionalStorageManager($storage);

        // Pre-create a document file
        $path = $storage->store('old_ciphertext_to_replace', $this->testDirectory, 'old_doc.bin');
        $this->assertTrue($storage->exists($path));

        $manager->transaction(function (TransactionalStorageManager $txManager) use ($path) {
            $txManager->stageDeletion($path);
            // File should still exist during transaction
            $this->assertTrue($txManager->exists($path));
        });

        // After successful transaction commit, file should be physically deleted
        $this->assertFalse(
            $storage->exists($path),
            'Staged deletion must be physically executed upon transaction commit.'
        );
    }
}
