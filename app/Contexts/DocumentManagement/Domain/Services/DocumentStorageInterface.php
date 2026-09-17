<?php

declare(strict_types=1);

namespace App\Contexts\DocumentManagement\Domain\Services;

interface DocumentStorageInterface
{
    /**
     * Store file content and return the stored relative path.
     */
    public function store(string $content, string $directory, string $filename): string;

    /**
     * Retrieve file content.
     */
    public function get(string $storagePath): ?string;

    /**
     * Delete stored file.
     */
    public function delete(string $storagePath): bool;

    /**
     * Check if file exists.
     */
    public function exists(string $storagePath): bool;

    /**
     * Get absolute path or temporary stream for download.
     */
    public function fullPath(string $storagePath): string;
}
