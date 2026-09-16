<?php

declare(strict_types=1);

namespace App\Contexts\Identity\Domain\Exceptions;

use DomainException;

final class InvalidEmailException extends DomainException
{
    public static function forValue(string $invalidValue): self
    {
        return new self(sprintf('The email address "%s" is invalid.', $invalidValue));
    }
}
