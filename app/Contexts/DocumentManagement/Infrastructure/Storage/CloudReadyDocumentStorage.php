<?php

declare(strict_types=1);

namespace App\Contexts\DocumentManagement\Infrastructure\Storage;

use App\Contexts\DocumentManagement\Domain\Services\DocumentStorageInterface;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Storage;
use Throwable;

final class CloudReadyDocumentStorage implements DocumentStorageInterface
{
    private Filesystem $disk;

    public function __construct(
        ?Filesystem $disk = null,
        ?string $diskName = null
    ) {
        $targetDisk = $diskName ?? (string) Config::get('vdr.storage.disk', 'local');
        $this->disk = $disk ?? Storage::disk($targetDisk);
    }

    public function store(string $content, string $directory, string $filename): string
    {
        $path = trim($directory, '/') . '/' . trim($filename, '/');
        $this->disk->put($path, $content);

        unset($content);

        return $path;
    }

    public function get(string $storagePath): ?string
    {
        if (!$this->disk->exists($storagePath)) {
            return null;
        }

        $content = $this->disk->get($storagePath);

        return $content !== null ? (string) $content : null;
    }

    public function delete(string $storagePath): bool
    {
        if (!$this->disk->exists($storagePath)) {
            return false;
        }

        return (bool) $this->disk->delete($storagePath);
    }

    public function exists(string $storagePath): bool
    {
        return (bool) $this->disk->exists($storagePath);
    }

    public function fullPath(string $storagePath): string
    {
        try {
            if (method_exists($this->disk, 'path')) {
                return (string) $this->disk->path($storagePath);
            }
        } catch (Throwable) {
            // Cloud storage drivers (e.g. OCI Object Storage / S3) do not have local filesystem paths
        }

        return $storagePath;
    }
}
