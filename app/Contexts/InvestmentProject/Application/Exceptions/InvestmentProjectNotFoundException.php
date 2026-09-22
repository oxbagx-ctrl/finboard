<?php

declare(strict_types=1);

namespace App\Contexts\InvestmentProject\Application\Exceptions;

use DomainException;

final class InvestmentProjectNotFoundException extends DomainException
{
    public static function withId(string $id, ?string $companyId = null): self
    {
        if ($companyId !== null) {
            return new self(sprintf('Investment project with ID "%s" not found for company "%s".', $id, $companyId));
        }

        return new self(sprintf('Investment project with ID "%s" not found.', $id));
    }
}
