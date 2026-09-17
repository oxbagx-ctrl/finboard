<?php

declare(strict_types=1);

namespace App\Contexts\Finance\Application\Commands\CreateFinancialRecord;

final readonly class CreateFinancialRecordCommand
{
    public function __construct(
        public string $companyId,
        public string $categoryId,
        public string|int|float $amount,
        public string $currency,
        public string $recordDate,
        public string $description,
        public string $source = 'manual'
    ) {
    }
}
