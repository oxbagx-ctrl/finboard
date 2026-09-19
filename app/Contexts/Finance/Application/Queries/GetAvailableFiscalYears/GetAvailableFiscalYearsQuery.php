<?php

declare(strict_types=1);

namespace App\Contexts\Finance\Application\Queries\GetAvailableFiscalYears;

final readonly class GetAvailableFiscalYearsQuery
{
    public function __construct(
        public string $companyId
    ) {
    }
}
