<?php

declare(strict_types=1);

namespace App\Contexts\DocumentManagement\Domain\ValueObjects;

use InvalidArgumentException;

final readonly class EncryptedPayload
{
    public function __construct(
        private string $ciphertext,
        private string $iv,
        private string $tag,
        private string $keyId,
        private string $algorithm = 'aes-256-gcm'
    ) {
        if (strlen($this->iv) !== 12) {
            throw new InvalidArgumentException(
                sprintf('IV must be exactly 12 bytes (96 bits), %d bytes given.', strlen($this->iv))
            );
        }

        if (strlen($this->tag) !== 16) {
            throw new InvalidArgumentException(
                sprintf('Authentication tag must be exactly 16 bytes (128 bits), %d bytes given.', strlen($this->tag))
            );
        }

        if (trim($this->keyId) === '') {
            throw new InvalidArgumentException('Key ID cannot be empty.');
        }
    }

    public static function fromBase64(
        string $ciphertext,
        string $ivBase64,
        string $tagBase64,
        string $keyId,
        string $algorithm = 'aes-256-gcm'
    ): self {
        $iv = base64_decode($ivBase64, true);
        if ($iv === false || strlen($iv) !== 12) {
            throw new InvalidArgumentException('Invalid Base64-encoded IV for AES-256-GCM.');
        }

        $tag = base64_decode($tagBase64, true);
        if ($tag === false || strlen($tag) !== 16) {
            throw new InvalidArgumentException('Invalid Base64-encoded Authentication Tag for AES-256-GCM.');
        }

        return new self(
            ciphertext: $ciphertext,
            iv: $iv,
            tag: $tag,
            keyId: $keyId,
            algorithm: $algorithm
        );
    }

    public function ciphertext(): string
    {
        return $this->ciphertext;
    }

    public function iv(): string
    {
        return $this->iv;
    }

    public function ivBase64(): string
    {
        return base64_encode($this->iv);
    }

    public function tag(): string
    {
        return $this->tag;
    }

    public function tagBase64(): string
    {
        return base64_encode($this->tag);
    }

    public function keyId(): string
    {
        return $this->keyId;
    }

    public function algorithm(): string
    {
        return $this->algorithm;
    }

    public function sizeBytes(): int
    {
        return strlen($this->ciphertext);
    }
}
