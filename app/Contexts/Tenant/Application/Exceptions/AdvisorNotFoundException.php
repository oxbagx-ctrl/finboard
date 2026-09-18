<?php

declare(strict_types=1);

namespace App\Contexts\Tenant\Application\Exceptions;

use RuntimeException;

final class AdvisorNotFoundException extends RuntimeException
{
    public static function withId(string $advisorId): self
    {
        return new self(sprintf('Advisor user with ID "%s" does not exist.', $advisorId));
    }
}
