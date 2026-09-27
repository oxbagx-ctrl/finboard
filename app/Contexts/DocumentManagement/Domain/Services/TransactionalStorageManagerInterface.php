<?php

declare(strict_types=1);

namespace App\Contexts\DocumentManagement\Domain\Services;

interface TransactionalStorageManagerInterface extends DocumentStorageInterface
{
    /**
     * Executes a database and storage operation inside a coordinated transaction.
     *
     * - Staged/written files during the transaction are deleted if the transaction fails (preventing orphan files).
     * - Staged deletions are only executed on disk once the database transaction commits successfully.
     *
     * @template T
     * @param callable(self): T $operation
     * @return T
     */
    public function transaction(callable $operation): mixed;

    /**
     * Stage a file for deletion upon successful transaction commit.
     */
    public function stageDeletion(string $storagePath): void;

    /**
     * Get the list of currently pending staged creation files.
     *
     * @return array<int, string>
     */
    public function getPendingCreations(): array;

    /**
     * Get the list of currently pending staged deletion files.
     *
     * @return array<int, string>
     */
    public function getPendingDeletions(): array;
}
