<?php

declare(strict_types=1);

namespace App\Contexts\Finance\Application\Commands\UpdateFinancialRecord;

final readonly class UpdateFinancialRecordCommand
{
    public function __construct(
        public string $recordId,
        public string|int|float $amount,
        public string $currency,
        public string $recordDate,
        public string $description,
        public string $categoryId
    ) {
    }
}
