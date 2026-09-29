<?php

declare(strict_types=1);

namespace App\Contexts\DocumentManagement\Domain\Exceptions;

final class TamperedPayloadException extends DecryptionFailedException
{
    public static function authenticationFailed(string $keyId = ''): self
    {
        $context = $keyId !== '' ? " dla klucza '{$keyId}'" : '';
        return new self(
            "Kryptograficzna weryfikacja integralności AEAD nie powiodła się{$context}: " .
            "naruszono tag autentyczności GCM lub dane zostały zmodyfikowane (tampering detected)."
        );
    }
}
