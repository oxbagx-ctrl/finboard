<?php

declare(strict_types=1);

namespace App\Contexts\DocumentManagement\Domain\Services;

use App\Contexts\DocumentManagement\Domain\Exceptions\DecryptionFailedException;
use App\Contexts\DocumentManagement\Domain\Exceptions\TamperedPayloadException;
use App\Contexts\DocumentManagement\Domain\ValueObjects\EncryptedPayload;

interface VdrEncryptionServiceInterface
{
    /**
     * Encrypts plaintext binary content using AES-256-GCM authenticated encryption.
     *
     * @param string $plainContent Raw binary content of the file
     * @param string|null $keyId Key identifier to use (null defaults to active key ID)
     * @return EncryptedPayload Value Object containing ciphertext, 96-bit IV, 128-bit tag, algo and key_id
     */
    public function encrypt(string $plainContent, ?string $keyId = null): EncryptedPayload;

    /**
     * Decrypts ciphertext binary content using AES-256-GCM and verifies authenticity tag.
     *
     * @param string $cipherContent Raw binary ciphertext from physical storage
     * @param string $iv 96-bit binary IV or Base64-encoded IV
     * @param string $tag 128-bit binary tag or Base64-encoded Tag
     * @param string|null $keyId Key identifier used during encryption (null defaults to active key ID)
     * @param string $algorithm Encryption algorithm identifier (defaults to aes-256-gcm)
     * @return string Plaintext binary content
     *
     * @throws DecryptionFailedException
     * @throws TamperedPayloadException
     */
    public function decrypt(
        string $cipherContent,
        string $iv,
        string $tag,
        ?string $keyId = null,
        string $algorithm = 'aes-256-gcm'
    ): string;

    /**
     * Decrypts an EncryptedPayload Value Object.
     *
     * @param EncryptedPayload $payload
     * @return string Plaintext binary content
     *
     * @throws DecryptionFailedException
     * @throws TamperedPayloadException
     */
    public function decryptPayload(EncryptedPayload $payload): string;

    /**
     * Returns the currently active encryption key identifier.
     */
    public function getActiveKeyId(): string;

    /**
     * Checks whether encryption is enabled in configuration.
     */
    public function isEncryptionEnabled(): bool;
}
