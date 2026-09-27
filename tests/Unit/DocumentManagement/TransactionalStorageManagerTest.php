<?php

declare(strict_types=1);

namespace Tests\Unit\DocumentManagement;

use App\Contexts\DocumentManagement\Domain\Services\DocumentStorageInterface;
use App\Contexts\DocumentManagement\Domain\Services\TransactionalStorageManagerInterface;
use App\Contexts\DocumentManagement\Infrastructure\Storage\TransactionalStorageManager;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Storage;
use RuntimeException;
use Tests\TestCase;

final class TransactionalStorageManagerTest extends TestCase
{
    use DatabaseTransactions;

    private TransactionalStorageManagerInterface $manager;
    private DocumentStorageInterface $storage;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
        $this->storage = $this->app->make(DocumentStorageInterface::class);
        $this->manager = $this->app->make(TransactionalStorageManagerInterface::class);
    }

    public function test_container_resolves_transactional_storage_manager(): void
    {
        $this->assertInstanceOf(TransactionalStorageManager::class, $this->manager);
    }

    public function test_store_and_retrieve_file_successfully(): void
    {
        $content = 'Confidential Due Diligence Dossier';
        $path = $this->manager->store($content, 'vdr/company-123', 'dossier.pdf');

        $this->assertTrue($this->manager->exists($path));
        $this->assertSame($content, $this->manager->get($path));
    }

    public function test_rollback_removes_stored_file_when_transaction_fails(): void
    {
        $content = 'Orphan Candidate File';
        $createdPath = null;

        try {
            $this->manager->transaction(function (TransactionalStorageManagerInterface $manager) use ($content, &$createdPath) {
                $createdPath = $manager->store($content, 'vdr/company-fail', 'orphan.pdf');

                // File exists while inside the transaction
                $this->assertTrue($this->storage->exists($createdPath));

                // Simulate database error or validation exception
                throw new RuntimeException('Simulated database deadlock during upload');
            });
            $this->fail('Expected RuntimeException was not thrown');
        } catch (RuntimeException $e) {
            $this->assertSame('Simulated database deadlock during upload', $e->getMessage());
        }

        // File must be deleted from storage (preventing orphan file)
        $this->assertNotNull($createdPath);
        $this->assertFalse($this->storage->exists($createdPath), 'File should be rolled back and deleted from storage');
    }

    public function test_staged_deletion_is_executed_upon_successful_transaction_commit(): void
    {
        $content = 'File marked for deletion';
        $path = $this->storage->store($content, 'vdr/company-del', 'obsolete.pdf');
        $this->assertTrue($this->storage->exists($path));

        $result = $this->manager->transaction(function (TransactionalStorageManagerInterface $manager) use ($path) {
            $manager->stageDeletion($path);
            return 'commit_success';
        });

        $this->assertSame('commit_success', $result);
        $this->assertFalse($this->storage->exists($path), 'Staged deletion should be executed on disk upon commit');
    }

    public function test_staged_deletion_is_aborted_when_transaction_fails(): void
    {
        $content = 'Precious document that must not be deleted if DB fails';
        $path = $this->storage->store($content, 'vdr/company-abort', 'precious.pdf');
        $this->assertTrue($this->storage->exists($path));

        try {
            $this->manager->transaction(function (TransactionalStorageManagerInterface $manager) use ($path) {
                $manager->stageDeletion($path);
                throw new RuntimeException('Database integrity constraint violation during deletion');
            });
            $this->fail('Expected RuntimeException was not thrown');
        } catch (RuntimeException $e) {
            $this->assertSame('Database integrity constraint violation during deletion', $e->getMessage());
        }

        // The staged deletion was NOT executed because transaction failed; original file remains intact!
        $this->assertTrue($this->storage->exists($path), 'File must be preserved if transaction fails');
        $this->assertSame($content, $this->storage->get($path));
    }
}
