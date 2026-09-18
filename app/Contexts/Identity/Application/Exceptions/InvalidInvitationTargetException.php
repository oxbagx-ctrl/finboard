<?php

declare(strict_types=1);

namespace App\Contexts\Identity\Application\Exceptions;

use DomainException;

final class InvalidInvitationTargetException extends DomainException
{
    public static function companyRequiredForClient(): self
    {
        return new self('Dla zaproszenia na poziomie Klienta wymagane jest podanie spółki powiązanej.');
    }

    public static function companyNotFound(string $companyId): self
    {
        return new self(sprintf('Wskazana spółka "%s" nie istnieje w systemie.', $companyId));
    }
}
