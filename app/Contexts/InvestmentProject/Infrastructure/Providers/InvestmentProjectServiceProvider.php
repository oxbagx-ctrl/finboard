<?php

declare(strict_types=1);

namespace App\Contexts\InvestmentProject\Infrastructure\Providers;

use App\Contexts\InvestmentProject\Domain\Repositories\InvestmentProjectRepositoryInterface;
use App\Contexts\InvestmentProject\Domain\Services\BalanceSheetService;
use App\Contexts\InvestmentProject\Domain\Services\CashFlowService;
use App\Contexts\InvestmentProject\Domain\Services\DebtAmortizationService;
use App\Contexts\InvestmentProject\Domain\Services\DepreciationScheduleService;
use App\Contexts\InvestmentProject\Domain\Services\GrantAllocationService;
use App\Contexts\InvestmentProject\Domain\Services\IncomeStatementService;
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
        $this->app->singleton(DepreciationScheduleService::class, fn () => new DepreciationScheduleService());
        $this->app->singleton(IncomeStatementService::class, fn ($app) => new IncomeStatementService(
            $app->make(DepreciationScheduleService::class),
            $app->make(DebtAmortizationService::class),
            $app->make(VatBridgeLoanService::class)
        ));
        $this->app->singleton(CashFlowService::class, fn () => new CashFlowService());
        $this->app->singleton(BalanceSheetService::class, fn ($app) => new BalanceSheetService(
            $app->make(CashFlowService::class),
            $app->make(IncomeStatementService::class),
            $app->make(DepreciationScheduleService::class),
            $app->make(DebtAmortizationService::class),
            $app->make(VatBridgeLoanService::class),
            $app->make(GrantAllocationService::class)
        ));
    }

    /**
     * Bootstrap domain event listeners and infrastructure bindings.
     */
    public function boot(): void
    {
        // Event listeners and domain integration logic
    }
}
