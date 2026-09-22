<?php

declare(strict_types=1);

namespace App\Contexts\InvestmentProject\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;

final class InvestmentProjectServiceProvider extends ServiceProvider
{
    /**
     * Register services and domain repository bindings for InvestmentProject context.
     */
    public function register(): void
    {
        // Bindings for repositories and domain services will be registered here.
    }

    /**
     * Bootstrap domain event listeners and infrastructure bindings.
     */
    public function boot(): void
    {
        // Event listeners and domain integration logic
    }
}
