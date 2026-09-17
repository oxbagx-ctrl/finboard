<?php

declare(strict_types=1);

namespace App\Contexts\Finance\Application\Queries\GetCategoryBreakdown;

final readonly class GetCategoryBreakdownQuery
{
    public function __construct(
        public string $companyId,
        public ?string $startDate = null,
        public ?string $endDate = null,
        public string $recordType = 'EXPENSE', // EXPENSE, REVENUE, ASSET, LIABILITY
        public string $currency = 'PLN'
    ) {
    }
}
