<?php

declare(strict_types=1);

namespace App\Contexts\DocumentManagement\Infrastructure\Storage;

use App\Contexts\DocumentManagement\Domain\Services\DocumentStorageInterface;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Support\Facades\Storage;

final class LocalStorageDocumentStorage implements DocumentStorageInterface
{
    private Filesystem $disk;

    public function __construct(?Filesystem $disk = null)
    {
        $this->disk = $disk ?? Storage::disk('local');
    }

    public function store(string $content, string $directory, string $filename): string
    {
        $path = trim($directory, '/') . '/' . trim($filename, '/');
        $this->disk->put($path, $content);

        return $path;
    }

    public function get(string $storagePath): ?string
    {
        if (!$this->disk->exists($storagePath)) {
            return null;
        }

        return $this->disk->get($storagePath);
    }

    public function delete(string $storagePath): bool
    {
        if (!$this->disk->exists($storagePath)) {
            return false;
        }

        return $this->disk->delete($storagePath);
    }

    public function exists(string $storagePath): bool
    {
        return $this->disk->exists($storagePath);
    }

    public function fullPath(string $storagePath): string
    {
        return $this->disk->path($storagePath);
    }
}
