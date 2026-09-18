<?php

declare(strict_types=1);

namespace App\Contexts\Tenant\Infrastructure\Repositories;

use App\Contexts\Tenant\Domain\Repositories\CompanyRepositoryInterface;
use App\Contexts\Tenant\Domain\ValueObjects\CompanyId;
use App\Models\Company;

final class EloquentCompanyRepository implements CompanyRepositoryInterface
{
    public function exists(CompanyId $companyId): bool
    {
        return Company::where('id', $companyId->value())->exists();
    }
}
