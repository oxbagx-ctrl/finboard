<?php

declare(strict_types=1);

namespace App\Contexts\InvestmentProject\Application\Exceptions;

use DomainException;

final class CapexStageNotFoundException extends DomainException
{
    public static function withId(string $stageId, ?string $projectId = null): self
    {
        if ($projectId !== null) {
            return new self(sprintf('Capex stage with ID "%s" not found for project "%s".', $stageId, $projectId));
        }

        return new self(sprintf('Capex stage with ID "%s" not found.', $stageId));
    }
}
