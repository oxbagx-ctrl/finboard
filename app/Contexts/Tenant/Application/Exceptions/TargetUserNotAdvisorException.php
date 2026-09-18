<?php

declare(strict_types=1);

namespace App\Contexts\Tenant\Application\Exceptions;

use RuntimeException;

final class TargetUserNotAdvisorException extends RuntimeException
{
    public static function forUser(string $userId, string $actualRole): self
    {
        return new self(sprintf(
            'User "%s" has role "%s" and cannot be assigned as an advisor to a company. Only Advisor roles are eligible.',
            $userId,
            $actualRole
        ));
    }
}
