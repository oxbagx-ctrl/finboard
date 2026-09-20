<?php

declare(strict_types=1);

namespace App\Contexts\Finance\Application\Commands\BatchDeleteFinancialRecords;

final readonly class BatchDeleteFinancialRecordsResult
{
    /**
     * @param int $deletedCount Number of records successfully deleted
     * @param float $totalAmount Sum of financial amounts deleted
     * @param array<string> $deletedRecordIds List of IDs that were deleted
     */
    public function __construct(
        public int $deletedCount,
        public float $totalAmount,
        public array $deletedRecordIds = []
    ) {
    }
}
