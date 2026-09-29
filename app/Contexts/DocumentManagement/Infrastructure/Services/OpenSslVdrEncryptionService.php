<?php

declare(strict_types=1);

namespace App\Contexts\DocumentManagement\Infrastructure\Services;

use App\Contexts\DocumentManagement\Domain\Exceptions\DecryptionFailedException;
use App\Contexts\DocumentManagement\Domain\Exceptions\TamperedPayloadException;
use App\Contexts\DocumentManagement\Domain\Services\VdrEncryptionServiceInterface;
use App\Contexts\DocumentManagement\Domain\ValueObjects\EncryptedPayload;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Log;

final class OpenSslVdrEncryptionService implements VdrEncryptionServiceInterface
{
    private const SUPPORTED_ALGORITHM = 'aes-256-gcm';
    private const IV_LENGTH_BYTES = 12; // 96 bits for AES-GCM
    private const TAG_LENGTH_BYTES = 16; // 128 bits for AES-GCM
    private const KEY_LENGTH_BYTES = 32; // 256 bits

    public function __construct(
        private readonly ?string $configuredActiveKeyId = null,
        private readonly ?string $configuredKey = null,
        private readonly ?string $hkdfInfo = null
    ) {
    }

    public function encrypt(string $plainContent, ?string $keyId = null): EncryptedPayload
    {
        $targetKeyId = $keyId ?? $this->getActiveKeyId();
        $rawKey = $this->resolveEncryptionKey($targetKeyId);

        $iv = random_bytes(self::IV_LENGTH_BYTES);
        $tag = '';

        $ciphertext = openssl_encrypt(
            $plainContent,
            self::SUPPORTED_ALGORITHM,
            $rawKey,
            OPENSSL_RAW_DATA,
            $iv,
            $tag,
            '',
            self::TAG_LENGTH_BYTES
        );

        // Memory cleanup of plaintext buffer
        unset($plainContent);

        if ($ciphertext === false) {
            $error = openssl_error_string() ?: 'Unknown OpenSSL encryption error';
            throw DecryptionFailedException::general("Szyfrowanie AES-256-GCM nie powiodło się: {$error}");
        }

        return new EncryptedPayload(
            ciphertext: $ciphertext,
            iv: $iv,
            tag: $tag,
            keyId: $targetKeyId,
            algorithm: self::SUPPORTED_ALGORITHM
        );
    }

    public function decrypt(
        string $cipherContent,
        string $iv,
        string $tag,
        ?string $keyId = null,
        string $algorithm = 'aes-256-gcm'
    ): string {
        $normalizedAlgo = strtolower(trim($algorithm));
        if ($normalizedAlgo !== self::SUPPORTED_ALGORITHM) {
            throw DecryptionFailedException::invalidAlgorithm($algorithm);
        }

        $binaryIv = $this->normalizeBinaryIv($iv);
        $binaryTag = $this->normalizeBinaryTag($tag);

        $targetKeyId = $keyId ?? $this->getActiveKeyId();
        $rawKey = $this->resolveEncryptionKey($targetKeyId);

        $decrypted = openssl_decrypt(
            $cipherContent,
            self::SUPPORTED_ALGORITHM,
            $rawKey,
            OPENSSL_RAW_DATA,
            $binaryIv,
            $binaryTag
        );

        // Memory cleanup of ciphertext buffer
        unset($cipherContent);

        if ($decrypted === false) {
            throw TamperedPayloadException::authenticationFailed($targetKeyId);
        }

        return $decrypted;
    }

    public function decryptPayload(EncryptedPayload $payload): string
    {
        return $this->decrypt(
            cipherContent: $payload->ciphertext(),
            iv: $payload->iv(),
            tag: $payload->tag(),
            keyId: $payload->keyId(),
            algorithm: $payload->algorithm()
        );
    }

    public function getActiveKeyId(): string
    {
        return $this->configuredActiveKeyId
            ?? (string) Config::get('vdr.encryption.active_key_id', 'vdr-key-1');
    }

    public function isEncryptionEnabled(): bool
    {
        return (bool) Config::get('vdr.encryption.enabled', true);
    }

    /**
     * Resolves raw 32-byte (256-bit) binary key for a given key ID,
     * applying HKDF-SHA256 fallback if no dedicated key is found.
     */
    private function resolveEncryptionKey(string $keyId): string
    {
        $rawConfigKey = $this->lookupConfiguredKey($keyId);

        if ($rawConfigKey !== null && trim($rawConfigKey) !== '') {
            $parsedKey = $this->parseKeyMaterial($rawConfigKey);
            if ($parsedKey !== null) {
                return $parsedKey;
            }
        }

        // Fallback: derive deterministic 256-bit key from APP_KEY via HKDF-SHA256
        return $this->deriveKeyFromAppKey($keyId);
    }

    private function lookupConfiguredKey(string $keyId): ?string
    {
        if ($this->configuredKey !== null && trim($this->configuredKey) !== '') {
            return $this->configuredKey;
        }

        $keyFromMap = Config::get("vdr.encryption.keys.{$keyId}");
        if ($keyFromMap !== null && trim((string) $keyFromMap) !== '') {
            return (string) $keyFromMap;
        }

        $primaryKey = Config::get('vdr.encryption.key');
        if ($primaryKey !== null && trim((string) $primaryKey) !== '') {
            return (string) $primaryKey;
        }

        return null;
    }

    private function parseKeyMaterial(string $keyMaterial): ?string
    {
        $trimmed = trim($keyMaterial);

        if (str_starts_with($trimmed, 'base64:')) {
            $decoded = base64_decode(substr($trimmed, 7), true);
            if ($decoded !== false && strlen($decoded) === self::KEY_LENGTH_BYTES) {
                return $decoded;
            }
        }

        // Check if raw 32 bytes
        if (strlen($trimmed) === self::KEY_LENGTH_BYTES) {
            return $trimmed;
        }

        // Check if valid base64 32 bytes (typically 44 chars)
        $decoded = base64_decode($trimmed, true);
        if ($decoded !== false && strlen($decoded) === self::KEY_LENGTH_BYTES) {
            return $decoded;
        }

        return null;
    }

    private function deriveKeyFromAppKey(string $keyId): string
    {
        Log::warning(
            "VDR Encryption: Dedicated key for key_id '{$keyId}' not found. " .
            "Falling back to temporary key derived from APP_KEY via HKDF-SHA256."
        );

        $appKey = (string) Config::get('app.key');
        if (str_starts_with($appKey, 'base64:')) {
            $decoded = base64_decode(substr($appKey, 7), true);
            if ($decoded !== false) {
                $appKey = $decoded;
            }
        }

        $info = $this->hkdfInfo
            ?? (string) Config::get('vdr.encryption.hkdf_info', 'vdr-storage-aes-256-gcm');

        return hash_hkdf('sha256', $appKey, self::KEY_LENGTH_BYTES, $info);
    }

    private function normalizeBinaryIv(string $iv): string
    {
        if (strlen($iv) === self::IV_LENGTH_BYTES) {
            return $iv;
        }

        $decoded = base64_decode($iv, true);
        if ($decoded !== false && strlen($decoded) === self::IV_LENGTH_BYTES) {
            return $decoded;
        }

        throw DecryptionFailedException::invalidIv(strlen($iv));
    }

    private function normalizeBinaryTag(string $tag): string
    {
        if (strlen($tag) === self::TAG_LENGTH_BYTES) {
            return $tag;
        }

        $decoded = base64_decode($tag, true);
        if ($decoded !== false && strlen($decoded) === self::TAG_LENGTH_BYTES) {
            return $decoded;
        }

        throw DecryptionFailedException::invalidTag(strlen($tag));
    }
}
