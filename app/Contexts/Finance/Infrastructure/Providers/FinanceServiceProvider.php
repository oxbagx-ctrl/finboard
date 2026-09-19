<?php

declare(strict_types=1);

namespace App\Contexts\Finance\Infrastructure\Providers;

use App\Contexts\Finance\Application\Services\CsvFinancialDataParser;
use App\Contexts\Finance\Domain\Repositories\CategoryRepositoryInterface;
use App\Contexts\Finance\Domain\Repositories\FinancialBenchmarkRepositoryInterface;
use App\Contexts\Finance\Domain\Repositories\FinancialRecordRepositoryInterface;
use App\Contexts\Finance\Domain\Services\FinancialCalculator;
use App\Contexts\Finance\Infrastructure\Repositories\EloquentCategoryRepository;
use App\Contexts\Finance\Infrastructure\Repositories\EloquentFinancialBenchmarkRepository;
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

        $this->app->bind(
            FinancialBenchmarkRepositoryInterface::class,
            EloquentFinancialBenchmarkRepository::class
        );

        $this->app->bind(
            CategoryRepositoryInterface::class,
            EloquentCategoryRepository::class
        );

        $this->app->singleton(FinancialCalculator::class, function () {
            return new FinancialCalculator();
        });

        $this->app->singleton(CsvFinancialDataParser::class, function ($app) {
            return new CsvFinancialDataParser($app->make(CategoryRepositoryInterface::class));
        });
    }

    public function boot(): void
    {
    }
}
