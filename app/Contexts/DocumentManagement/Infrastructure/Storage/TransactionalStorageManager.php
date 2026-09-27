<?php

declare(strict_types=1);

namespace App\Contexts\DocumentManagement\Infrastructure\Storage;

use App\Contexts\DocumentManagement\Domain\Services\DocumentStorageInterface;
use App\Contexts\DocumentManagement\Domain\Services\TransactionalStorageManagerInterface;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Throwable;

final class TransactionalStorageManager implements TransactionalStorageManagerInterface
{
    /** @var array<int, string> */
    private array $pendingCreations = [];

    /** @var array<int, string> */
    private array $pendingDeletions = [];

    public function __construct(
        private readonly DocumentStorageInterface $storage
    ) {
    }

    public function transaction(callable $operation): mixed
    {
        $initialCreations = $this->pendingCreations;
        $initialDeletions = $this->pendingDeletions;

        try {
            $result = DB::transaction(function () use ($operation) {
                return $operation($this);
            });

            // Commit phase: physically remove staged deletions from storage
            foreach ($this->pendingDeletions as $deletionPath) {
                try {
                    $this->storage->delete($deletionPath);
                } catch (Throwable $e) {
                    Log::warning("Failed to delete staged file on transaction commit: {$deletionPath}", [
                        'error' => $e->getMessage(),
                    ]);
                }
            }

            return $result;
        } catch (Throwable $e) {
            // Rollback phase: remove any files created during the failed transaction to prevent orphan files
            foreach ($this->pendingCreations as $creationPath) {
                try {
                    $this->storage->delete($creationPath);
                    Log::info("Rolled back orphan file after transaction failure: {$creationPath}");
                } catch (Throwable $delEx) {
                    Log::error("Failed to delete orphan file during transaction rollback: {$creationPath}", [
                        'error' => $delEx->getMessage(),
                    ]);
                }
            }

            throw $e;
        } finally {
            $this->pendingCreations = $initialCreations;
            $this->pendingDeletions = $initialDeletions;
        }
    }

    public function store(string $content, string $directory, string $filename): string
    {
        $path = $this->storage->store($content, $directory, $filename);
        $this->pendingCreations[] = $path;

        return $path;
    }

    public function stageDeletion(string $storagePath): void
    {
        $this->pendingDeletions[] = $storagePath;
    }

    public function delete(string $storagePath): bool
    {
        return $this->storage->delete($storagePath);
    }

    public function get(string $storagePath): ?string
    {
        return $this->storage->get($storagePath);
    }

    public function exists(string $storagePath): bool
    {
        return $this->storage->exists($storagePath);
    }

    public function fullPath(string $storagePath): string
    {
        return $this->storage->fullPath($storagePath);
    }

    public function getPendingCreations(): array
    {
        return $this->pendingCreations;
    }

    public function getPendingDeletions(): array
    {
        return $this->pendingDeletions;
    }
}
