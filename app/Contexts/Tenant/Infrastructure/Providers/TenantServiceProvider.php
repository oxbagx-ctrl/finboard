<?php

declare(strict_types=1);

namespace App\Contexts\Tenant\Infrastructure\Providers;

use App\Contexts\Tenant\Domain\Repositories\CompanyAdvisorRepositoryInterface;
use App\Contexts\Tenant\Infrastructure\Repositories\EloquentCompanyAdvisorRepository;
use Illuminate\Support\ServiceProvider;

final class TenantServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(
            CompanyAdvisorRepositoryInterface::class,
            EloquentCompanyAdvisorRepository::class
        );
    }
}
