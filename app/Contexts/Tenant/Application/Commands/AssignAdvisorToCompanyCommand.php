<?php

declare(strict_types=1);

namespace App\Contexts\Tenant\Application\Commands;

final class AssignAdvisorToCompanyCommand
{
    public function __construct(
        public readonly string $companyId,
        public readonly string $advisorId,
        public readonly string $assignedById
    ) {
    }
}
