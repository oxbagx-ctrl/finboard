<?php

declare(strict_types=1);

namespace App\Contexts\Finance\Application\Queries\CalculateFinancialDynamics;

final readonly class CalculateFinancialDynamicsQuery
{
    public function __construct(
        public string $companyId,
        public ?string $startDate = null,
        public ?string $endDate = null,
        public string $currency = 'PLN'
    ) {
    }
}
