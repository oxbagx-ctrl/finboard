<?php

declare(strict_types=1);

namespace App\Contexts\Identity\Application\Exceptions;

use DomainException;

final class UserAlreadyExistsException extends DomainException
{
    public static function withEmail(string $email): self
    {
        return new self(sprintf('Użytkownik o adresie email "%s" już istnieje w systemie.', $email));
    }
}
