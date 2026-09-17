<?php

declare(strict_types=1);

namespace App\Contexts\Finance\Application\Commands\BatchIngestFinancialRecords;

final readonly class BatchIngestFinancialRecordsCommand
{
    /**
     * @param array<int, array{
     *     category_id: string,
     *     amount: string|int|float,
     *     currency?: string,
     *     record_date: string,
     *     description: string,
     *     source?: string
     * }> $recordsData
     */
    public function __construct(
        public string $companyId,
        public array $recordsData,
        public string $defaultCurrency = 'PLN',
        public string $defaultSource = 'csv_import'
    ) {
    }
}
