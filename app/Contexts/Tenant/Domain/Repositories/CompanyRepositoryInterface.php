<?php

declare(strict_types=1);

namespace App\Contexts\Tenant\Domain\Repositories;

use App\Contexts\Tenant\Domain\ValueObjects\CompanyId;

interface CompanyRepositoryInterface
{
    public function exists(CompanyId $companyId): bool;
}
