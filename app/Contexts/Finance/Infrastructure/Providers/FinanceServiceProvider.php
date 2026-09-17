<?php

declare(strict_types=1);

namespace App\Contexts\Finance\Infrastructure\Providers;

use App\Contexts\Finance\Domain\Repositories\FinancialRecordRepositoryInterface;
use App\Contexts\Finance\Domain\Services\FinancialCalculator;
use App\Contexts\Finance\Infrastructure\Repositories\EloquentFinancialRecordRepository;
use Illuminate\Support\ServiceProvider;

final class FinanceServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(
            FinancialRecordRepositoryInterface::class,
            EloquentFinancialRecordRepository::class
        );

        $this->app->singleton(FinancialCalculator::class, function () {
            return new FinancialCalculator();
        });
    }

    public function boot(): void
    {
    }
}
