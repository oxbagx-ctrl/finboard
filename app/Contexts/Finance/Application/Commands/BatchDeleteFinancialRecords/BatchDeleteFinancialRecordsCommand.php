<?php

declare(strict_types=1);

namespace App\Contexts\Finance\Application\Commands\BatchDeleteFinancialRecords;

final readonly class BatchDeleteFinancialRecordsCommand
{
    /**
     * @param string $companyId The tenant company UUID
     * @param array<string> $recordIds Array of record UUIDs to delete
     * @param string|null $userId ID of the user executing the batch delete
     * @param string|null $ipAddress Client IP address for auditing
     */
    public function __construct(
        public string $companyId,
        public array $recordIds,
        public ?string $userId = null,
        public ?string $ipAddress = null
    ) {
    }
}
