<?php

declare(strict_types=1);

namespace App\Domain\Finance\Exceptions;

use RuntimeException;

final class NbpApiException extends RuntimeException
{
    public static function requestFailed(string $url, int $status, string $responseBody): self
    {
        return new self("Żądanie do API NBP ({$url}) nie powiodło się ze statusem {$status}: {$responseBody}");
    }

    public static function networkError(string $url, string $error): self
    {
        return new self("Błąd połączenia sieciowego z API NBP ({$url}): {$error}");
    }

    public static function invalidPayload(string $reason): self
    {
        return new self("Nieprawidłowa struktura odpowiedzi JSON z API NBP: {$reason}");
    }

    public static function currencyNotFound(string $currency): self
    {
        return new self("Nie znaleziono kursu waluty {$currency} w tabeli NBP.");
    }
}
