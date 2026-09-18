<?php

declare(strict_types=1);

namespace App\Contexts\Identity\Domain\Exceptions;

use DomainException;

final class InvalidInvitationTokenException extends DomainException
{
    public static function invalidFormat(): self
    {
        return new self('Format tokenu zaproszenia jest nieprawidłowy.');
    }

    public static function tooShort(int $min = 32): self
    {
        return new self(sprintf('Token zaproszenia musi mieć co najmniej %d znaków.', $min));
    }

    public static function notFound(): self
    {
        return new self('Podany token zaproszenia nie istnieje lub jest nieprawidłowy.');
    }
}
