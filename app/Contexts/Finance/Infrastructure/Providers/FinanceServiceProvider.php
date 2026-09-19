<?php

declare(strict_types=1);

namespace App\Contexts\Finance\Infrastructure\Providers;

use App\Contexts\Finance\Application\Services\CsvFinancialDataParser;
use App\Contexts\Finance\Application\Services\KpiEvaluationService;
use App\Contexts\Finance\Domain\Events\CsvImportCompleted;
use App\Contexts\Finance\Domain\Events\CsvImportFailed;
use App\Contexts\Finance\Domain\Events\FinancialBenchmarkConfigured;
use App\Contexts\Finance\Domain\Events\FinancialBenchmarkReset;
use App\Contexts\Finance\Domain\Events\FinancialRecordCreated;
use App\Contexts\Finance\Domain\Events\FinancialRecordDeleted;
use App\Contexts\Finance\Domain\Events\FinancialRecordUpdated;
use App\Contexts\Finance\Domain\Repositories\CategoryRepositoryInterface;
use App\Contexts\Finance\Domain\Repositories\FinancialAuditLogRepositoryInterface;
use App\Contexts\Finance\Domain\Repositories\FinancialBenchmarkRepositoryInterface;
use App\Contexts\Finance\Domain\Repositories\FinancialRecordRepositoryInterface;
use App\Contexts\Finance\Domain\Services\FinancialCalculator;
use App\Contexts\Finance\Infrastructure\Listeners\LogBenchmarkConfiguredListener;
use App\Contexts\Finance\Infrastructure\Listeners\LogBenchmarkResetListener;
use App\Contexts\Finance\Infrastructure\Listeners\LogCsvImportAuditListener;
use App\Contexts\Finance\Infrastructure\Listeners\LogFinancialRecordCreatedListener;
use App\Contexts\Finance\Infrastructure\Listeners\LogFinancialRecordDeletedListener;
use App\Contexts\Finance\Infrastructure\Listeners\LogFinancialRecordUpdatedListener;
use App\Contexts\Finance\Infrastructure\Repositories\EloquentCategoryRepository;
use App\Contexts\Finance\Infrastructure\Repositories\EloquentFinancialAuditLogRepository;
use App\Contexts\Finance\Infrastructure\Repositories\EloquentFinancialBenchmarkRepository;
use App\Contexts\Finance\Infrastructure\Repositories\EloquentFinancialRecordRepository;
use Illuminate\Support\Facades\Event;
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
            FinancialAuditLogRepositoryInterface::class,
            EloquentFinancialAuditLogRepository::class
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

        $this->app->singleton(KpiEvaluationService::class, function ($app) {
            return new KpiEvaluationService($app->make(FinancialBenchmarkRepositoryInterface::class));
        });
    }

    public function boot(): void
    {
        Event::listen(FinancialRecordCreated::class, LogFinancialRecordCreatedListener::class);
        Event::listen(FinancialRecordUpdated::class, LogFinancialRecordUpdatedListener::class);
        Event::listen(FinancialRecordDeleted::class, LogFinancialRecordDeletedListener::class);
        Event::listen(FinancialBenchmarkConfigured::class, LogBenchmarkConfiguredListener::class);
        Event::listen(FinancialBenchmarkReset::class, LogBenchmarkResetListener::class);
        Event::listen(CsvImportCompleted::class, [LogCsvImportAuditListener::class, 'handleImportCompleted']);
        Event::listen(CsvImportFailed::class, [LogCsvImportAuditListener::class, 'handleImportFailed']);
    }
}
