<?php

return [
    App\Providers\AppServiceProvider::class,
    App\Contexts\Identity\Infrastructure\Providers\IdentityServiceProvider::class,
    App\Contexts\Finance\Infrastructure\Providers\FinanceServiceProvider::class,
    App\Contexts\DocumentManagement\Infrastructure\Providers\DocumentManagementServiceProvider::class,
    App\Contexts\Tenant\Infrastructure\Providers\TenantServiceProvider::class,
    App\Contexts\InvestmentProject\Infrastructure\Providers\InvestmentProjectServiceProvider::class,
];
