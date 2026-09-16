<?php

declare(strict_types=1);

namespace App\Contexts\Identity\Infrastructure\Providers;

use App\Contexts\Identity\Domain\Repositories\UserRepositoryInterface;
use App\Contexts\Identity\Infrastructure\Repositories\EloquentUserRepository;
use Illuminate\Support\ServiceProvider;

final class IdentityServiceProvider extends ServiceProvider
{
    /**
     * All of the container bindings that should be registered.
     *
     * @var array<string, string>
     */
    public array $bindings = [
        UserRepositoryInterface::class => EloquentUserRepository::class,
    ];

    public function register(): void
    {
        $this->app->bind(UserRepositoryInterface::class, EloquentUserRepository::class);
    }
}
