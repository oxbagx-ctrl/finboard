<?php

declare(strict_types=1);

namespace Tests\Unit\InvestmentProject;

use App\Contexts\InvestmentProject\Infrastructure\Providers\InvestmentProjectServiceProvider;
use Tests\TestCase;

final class InvestmentProjectContextScaffoldTest extends TestCase
{
    public function test_investment_project_service_provider_is_registered(): void
    {
        $providers = $this->app->getLoadedProviders();

        $this->assertArrayHasKey(
            InvestmentProjectServiceProvider::class,
            $providers,
            'InvestmentProjectServiceProvider should be loaded in the application.'
        );
    }

    public function test_investment_project_bounded_context_directory_structure_exists(): void
    {
        $basePath = app_path('Contexts/InvestmentProject');

        $expectedDirectories = [
            $basePath . '/Domain/Model',
            $basePath . '/Domain/Entities',
            $basePath . '/Domain/ValueObjects',
            $basePath . '/Domain/Events',
            $basePath . '/Domain/Exceptions',
            $basePath . '/Domain/Repositories',
            $basePath . '/Domain/Services',
            $basePath . '/Application/Commands',
            $basePath . '/Application/Queries',
            $basePath . '/Application/Services',
            $basePath . '/Application/Exceptions',
            $basePath . '/Application/DTOs',
            $basePath . '/Infrastructure/Providers',
            $basePath . '/Infrastructure/Repositories',
            $basePath . '/Infrastructure/Listeners',
        ];

        foreach ($expectedDirectories as $directory) {
            $this->assertDirectoryExists(
                $directory,
                sprintf('Directory "%s" should exist in InvestmentProject bounded context.', $directory)
            );
        }
    }
}
