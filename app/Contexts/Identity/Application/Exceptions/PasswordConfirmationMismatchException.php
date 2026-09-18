<?php

declare(strict_types=1);

namespace App\Contexts\Identity\Application\Exceptions;

use DomainException;

final class PasswordConfirmationMismatchException extends DomainException
{
    public function __construct(string $message = 'Wprowadzone hasła nie są identyczne.')
    {
        parent::__construct($message);
    }
}
