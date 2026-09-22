<?php

declare(strict_types=1);

namespace App\Contexts\InvestmentProject\Infrastructure\Providers;

use App\Contexts\InvestmentProject\Domain\Repositories\InvestmentProjectRepositoryInterface;
use App\Contexts\InvestmentProject\Domain\Services\DebtAmortizationService;
use App\Contexts\InvestmentProject\Domain\Services\GrantAllocationService;
use App\Contexts\InvestmentProject\Domain\Services\VatBridgeLoanService;
use App\Contexts\InvestmentProject\Infrastructure\Repositories\EloquentInvestmentProjectRepository;
use Illuminate\Support\ServiceProvider;

final class InvestmentProjectServiceProvider extends ServiceProvider
{
    /**
     * Register services and domain repository bindings for InvestmentProject context.
     */
    public function register(): void
    {
        $this->app->bind(
            InvestmentProjectRepositoryInterface::class,
            EloquentInvestmentProjectRepository::class
        );

        $this->app->singleton(DebtAmortizationService::class, fn () => new DebtAmortizationService());
        $this->app->singleton(VatBridgeLoanService::class, fn () => new VatBridgeLoanService());
        $this->app->singleton(GrantAllocationService::class, fn () => new GrantAllocationService());
    }

    /**
     * Bootstrap domain event listeners and infrastructure bindings.
     */
    public function boot(): void
    {
        // Event listeners and domain integration logic
    }
}
