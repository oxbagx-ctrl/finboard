<?php

declare(strict_types=1);

namespace App\Contexts\Tenant\Application\Exceptions;

use RuntimeException;

final class UnauthorizedAssignmentException extends RuntimeException
{
    public static function notAuthorized(string $actorId): self
    {
        return new self(sprintf('User "%s" does not have permission to manage advisor assignments.', $actorId));
    }
}
