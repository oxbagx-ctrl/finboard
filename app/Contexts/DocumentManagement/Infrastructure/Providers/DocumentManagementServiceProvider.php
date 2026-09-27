<?php

declare(strict_types=1);

namespace App\Contexts\DocumentManagement\Infrastructure\Providers;

use App\Contexts\DocumentManagement\Domain\Repositories\DocumentRepositoryInterface;
use App\Contexts\DocumentManagement\Domain\Services\DocumentStorageInterface;
use App\Contexts\DocumentManagement\Domain\Services\TransactionalStorageManagerInterface;
use App\Contexts\DocumentManagement\Infrastructure\Repositories\EloquentDocumentRepository;
use App\Contexts\DocumentManagement\Infrastructure\Storage\LocalStorageDocumentStorage;
use App\Contexts\DocumentManagement\Infrastructure\Storage\TransactionalStorageManager;
use Illuminate\Support\ServiceProvider;

final class DocumentManagementServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(
            DocumentRepositoryInterface::class,
            EloquentDocumentRepository::class
        );

        $this->app->bind(
            DocumentStorageInterface::class,
            LocalStorageDocumentStorage::class
        );

        $this->app->bind(
            TransactionalStorageManagerInterface::class,
            TransactionalStorageManager::class
        );
    }

    public function boot(): void
    {
    }
}
