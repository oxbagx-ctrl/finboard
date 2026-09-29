<?php

declare(strict_types=1);

namespace Tests\Unit\DocumentManagement;

use App\Contexts\DocumentManagement\Domain\Exceptions\DecryptionFailedException;
use App\Contexts\DocumentManagement\Domain\Exceptions\TamperedPayloadException;
use App\Contexts\DocumentManagement\Domain\Services\VdrEncryptionServiceInterface;
use App\Contexts\DocumentManagement\Domain\ValueObjects\EncryptedPayload;
use App\Contexts\DocumentManagement\Infrastructure\Services\OpenSslVdrEncryptionService;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Log;
use Tests\TestCase;

final class OpenSslVdrEncryptionServiceTest extends TestCase
{
    private string $key1Base64;
    private string $key2Base64;

    protected function setUp(): void
    {
        parent::setUp();

        $this->key1Base64 = base64_encode(random_bytes(32));
        $this->key2Base64 = base64_encode(random_bytes(32));

        Config::set('vdr.encryption.enabled', true);
        Config::set('vdr.encryption.algorithm', 'aes-256-gcm');
        Config::set('vdr.encryption.active_key_id', 'vdr-key-1');
        Config::set('vdr.encryption.key', $this->key1Base64);
        Config::set('vdr.encryption.keys', [
            'vdr-key-1' => $this->key1Base64,
            'vdr-key-2' => $this->key2Base64,
        ]);
        Config::set('vdr.encryption.hkdf_info', 'vdr-storage-aes-256-gcm');
    }

    public function test_ioc_container_resolves_vdr_encryption_service(): void
    {
        $service = $this->app->make(VdrEncryptionServiceInterface::class);

        $this->assertInstanceOf(OpenSslVdrEncryptionService::class, $service);
        $this->assertTrue($service->isEncryptionEnabled());
        $this->assertSame('vdr-key-1', $service->getActiveKeyId());
    }

    public function test_encrypt_produces_valid_aes_256_gcm_payload(): void
    {
        $service = new OpenSslVdrEncryptionService();
        $plaintext = "%PDF-1.4\n%Confidential Deal Financial Memo\nAcme Manufacturing 2026";

        $payload = $service->encrypt($plaintext);

        $this->assertInstanceOf(EncryptedPayload::class, $payload);
        $this->assertNotSame($plaintext, $payload->ciphertext());
        $this->assertSame(12, strlen($payload->iv()), 'AES-GCM IV must be 96 bits (12 bytes)');
        $this->assertSame(16, strlen($payload->tag()), 'AES-GCM Tag must be 128 bits (16 bytes)');
        $this->assertSame('vdr-key-1', $payload->keyId());
        $this->assertSame('aes-256-gcm', $payload->algorithm());
        $this->assertNotEmpty($payload->ivBase64());
        $this->assertNotEmpty($payload->tagBase64());
    }

    public function test_decrypt_payload_recovers_original_plaintext(): void
    {
        $service = new OpenSslVdrEncryptionService();
        $plaintext = "SUPER_SECRET_TRANSACTION_VALUATION_DATA_1234567890";

        $payload = $service->encrypt($plaintext);
        $decrypted = $service->decryptPayload($payload);

        $this->assertSame($plaintext, $decrypted);
    }

    public function test_decrypt_with_base64_iv_and_tag_recovers_plaintext(): void
    {
        $service = new OpenSslVdrEncryptionService();
        $plaintext = "Institutional Investor Confidentiality Agreement";

        $payload = $service->encrypt($plaintext, 'vdr-key-1');

        $decrypted = $service->decrypt(
            cipherContent: $payload->ciphertext(),
            iv: $payload->ivBase64(),
            tag: $payload->tagBase64(),
            keyId: 'vdr-key-1',
            algorithm: 'aes-256-gcm'
        );

        $this->assertSame($plaintext, $decrypted);
    }

    public function test_tampered_ciphertext_triggers_tampered_payload_exception(): void
    {
        $service = new OpenSslVdrEncryptionService();
        $plaintext = "Original Unmodified Due Diligence Document";

        $payload = $service->encrypt($plaintext);

        // Tamper with 1 byte of the ciphertext
        $corruptedCiphertext = $payload->ciphertext();
        $corruptedCiphertext[0] = $corruptedCiphertext[0] === 'A' ? 'B' : 'A';

        $this->expectException(TamperedPayloadException::class);
        $service->decrypt(
            cipherContent: $corruptedCiphertext,
            iv: $payload->iv(),
            tag: $payload->tag(),
            keyId: $payload->keyId()
        );
    }

    public function test_tampered_tag_triggers_tampered_payload_exception(): void
    {
        $service = new OpenSslVdrEncryptionService();
        $plaintext = "Original Unmodified Audit Report";

        $payload = $service->encrypt($plaintext);

        // Tamper with authentication tag
        $corruptedTag = $payload->tag();
        $corruptedTag[15] = chr(ord($corruptedTag[15]) ^ 0xFF);

        $this->expectException(TamperedPayloadException::class);
        $service->decrypt(
            cipherContent: $payload->ciphertext(),
            iv: $payload->iv(),
            tag: $corruptedTag,
            keyId: $payload->keyId()
        );
    }

    public function test_tampered_iv_triggers_tampered_payload_exception(): void
    {
        $service = new OpenSslVdrEncryptionService();
        $plaintext = "Sensitive Board Resolution 2026";

        $payload = $service->encrypt($plaintext);

        // Tamper with IV
        $corruptedIv = $payload->iv();
        $corruptedIv[0] = chr(ord($corruptedIv[0]) ^ 0x01);

        $this->expectException(TamperedPayloadException::class);
        $service->decrypt(
            cipherContent: $payload->ciphertext(),
            iv: $corruptedIv,
            tag: $payload->tag(),
            keyId: $payload->keyId()
        );
    }

    public function test_unsupported_algorithm_throws_decryption_failed_exception(): void
    {
        $service = new OpenSslVdrEncryptionService();
        $payload = $service->encrypt('sample data');

        $this->expectException(DecryptionFailedException::class);
        $this->expectExceptionMessage("Nieobsługiwany algorytm kryptograficzny: 'aes-128-cbc'");

        $service->decrypt(
            cipherContent: $payload->ciphertext(),
            iv: $payload->iv(),
            tag: $payload->tag(),
            keyId: $payload->keyId(),
            algorithm: 'aes-128-cbc'
        );
    }

    public function test_invalid_iv_length_throws_decryption_failed_exception(): void
    {
        $service = new OpenSslVdrEncryptionService();
        $payload = $service->encrypt('sample data');

        $this->expectException(DecryptionFailedException::class);
        $this->expectExceptionMessage("Nieprawidłowa długość wektora inicjalizującego IV (8 B)");

        $service->decrypt(
            cipherContent: $payload->ciphertext(),
            iv: 'short_iv', // 8 bytes
            tag: $payload->tag(),
            keyId: $payload->keyId()
        );
    }

    public function test_invalid_tag_length_throws_decryption_failed_exception(): void
    {
        $service = new OpenSslVdrEncryptionService();
        $payload = $service->encrypt('sample data');

        $this->expectException(DecryptionFailedException::class);
        $this->expectExceptionMessage("Nieprawidłowa długość tagu autentyczności (6 B)");

        $service->decrypt(
            cipherContent: $payload->ciphertext(),
            iv: $payload->iv(),
            tag: 'tag123', // 6 bytes
            keyId: $payload->keyId()
        );
    }

    public function test_key_rotation_supports_multiple_keys_and_rejects_wrong_key(): void
    {
        $service = new OpenSslVdrEncryptionService();
        $plaintext = "Contract encrypted under older key_id vdr-key-2";

        // Encrypt with vdr-key-2
        $payload = $service->encrypt($plaintext, 'vdr-key-2');
        $this->assertSame('vdr-key-2', $payload->keyId());

        // Decrypt with correct key vdr-key-2 -> Success
        $decrypted = $service->decryptPayload($payload);
        $this->assertSame($plaintext, $decrypted);

        // Attempting to decrypt vdr-key-2 ciphertext using vdr-key-1 -> Fails with TamperedPayloadException
        $this->expectException(TamperedPayloadException::class);
        $service->decrypt(
            cipherContent: $payload->ciphertext(),
            iv: $payload->iv(),
            tag: $payload->tag(),
            keyId: 'vdr-key-1'
        );
    }

    public function test_hkdf_fallback_when_vdr_key_is_not_configured(): void
    {
        // Unset VDR keys to simulate unconfigured OCI environment
        Config::set('vdr.encryption.key', null);
        Config::set('vdr.encryption.keys', []);
        Config::set('app.key', 'base64:' . base64_encode(random_bytes(32)));

        Log::shouldReceive('warning')
            ->atLeast()->times(2)
            ->withArgs(function (string $message) {
                return str_contains($message, 'Falling back to temporary key derived from APP_KEY via HKDF-SHA256');
            });

        $service = new OpenSslVdrEncryptionService();
        $plaintext = "Fallback Encrypted Content on Oracle Cloud";

        $payload = $service->encrypt($plaintext, 'vdr-fallback-key');
        $this->assertNotEmpty($payload->ciphertext());

        // Decrypting with the same fallback derivation
        $decrypted = $service->decryptPayload($payload);
        $this->assertSame($plaintext, $decrypted);
    }
}
