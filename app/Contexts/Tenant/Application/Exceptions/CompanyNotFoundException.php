<?php

declare(strict_types=1);

namespace App\Contexts\Tenant\Application\Exceptions;

use RuntimeException;

final class CompanyNotFoundException extends RuntimeException
{
    public static function withId(string $companyId): self
    {
        return new self(sprintf('Company with ID "%s" does not exist.', $companyId));
    }
}
