<?php

declare(strict_types=1);

namespace App\Contexts\DocumentManagement\Domain\ValueObjects;

use App\Shared\Domain\ValueObject;
use InvalidArgumentException;

final class FileMetadata implements ValueObject
{
    public function __construct(
        private readonly string $originalName,
        private readonly string $mimeType,
        private readonly int $sizeInBytes,
        private readonly string $checksumSha256
    ) {
        if ($this->sizeInBytes <= 0) {
            throw new InvalidArgumentException('File size must be strictly greater than zero.');
        }

        if (strlen($this->checksumSha256) !== 64) {
            throw new InvalidArgumentException('Checksum must be a valid 64-character SHA-256 string.');
        }
    }

    public function originalName(): string
    {
        return $this->originalName;
    }

    public function mimeType(): string
    {
        return $this->mimeType;
    }

    public function sizeInBytes(): int
    {
        return $this->sizeInBytes;
    }

    public function checksumSha256(): string
    {
        return $this->checksumSha256;
    }

    public function extension(): string
    {
        return strtolower(pathinfo($this->originalName, PATHINFO_EXTENSION));
    }

    public function formattedSize(): string
    {
        $bytes = $this->sizeInBytes;
        if ($bytes >= 1048576) {
            return sprintf('%.2f MB', $bytes / 1048576);
        }
        if ($bytes >= 1024) {
            return sprintf('%.2f KB', $bytes / 1024);
        }

        return $bytes . ' B';
    }

    public function equals(ValueObject $other): bool
    {
        if (!$other instanceof self) {
            return false;
        }

        return $this->checksumSha256 === $other->checksumSha256
            && $this->sizeInBytes === $other->sizeInBytes
            && $this->mimeType === $other->mimeType;
    }
}
