<?php

declare(strict_types=1);

namespace App\Contexts\DocumentManagement\Domain\Exceptions;

use RuntimeException;
use Throwable;

class DecryptionFailedException extends RuntimeException
{
    public static function general(string $reason, ?Throwable $previous = null): self
    {
        return new self("Operacja deszyfrowania dokumentu VDR nie powiodła się: {$reason}", 0, $previous);
    }

    public static function keyNotFound(string $keyId): self
    {
        return new self("Nie znaleziono klucza szyfrowania dla identyfikatora: '{$keyId}'.");
    }

    public static function invalidAlgorithm(string $algorithm): self
    {
        return new self("Nieobsługiwany algorytm kryptograficzny: '{$algorithm}'. Wymagany: aes-256-gcm.");
    }

    public static function invalidIv(int $actualLength): self
    {
        return new self("Nieprawidłowa długość wektora inicjalizującego IV ({$actualLength} B). Wymagane: 12 B (96 bitów).");
    }

    public static function invalidTag(int $actualLength): self
    {
        return new self("Nieprawidłowa długość tagu autentyczności ({$actualLength} B). Wymagane: 16 B (128 bitów).");
    }
}
