<?php

declare(strict_types=1);

namespace App\Contexts\Finance\Application\Commands\BatchDeleteFinancialRecords;

use App\Contexts\Finance\Domain\Events\FinancialRecordsBatchDeleted;
use App\Contexts\Finance\Domain\Repositories\FinancialRecordRepositoryInterface;
use Illuminate\Contracts\Events\Dispatcher;
use Illuminate\Support\Facades\DB;


final class BatchDeleteFinancialRecordsHandler
{
    public function __construct(
        private readonly FinancialRecordRepositoryInterface $recordRepository,
        private readonly ?Dispatcher $dispatcher = null
    ) {
    }

    public function handle(BatchDeleteFinancialRecordsCommand $command): BatchDeleteFinancialRecordsResult
    {
        // 1. Sanitize input record IDs: remove empty values and duplicates
        $cleanRecordIds = array_values(array_unique(array_filter(
            $command->recordIds,
            fn ($id) => is_string($id) && trim($id) !== ''
        )));

        if (empty($cleanRecordIds)) {
            return new BatchDeleteFinancialRecordsResult(
                deletedCount: 0,
                totalAmount: 0.0,
                deletedRecordIds: []
            );
        }

        // 2. Execute deletion atomically within a database transaction with company tenant isolation
        return DB::transaction(function () use ($command, $cleanRecordIds): BatchDeleteFinancialRecordsResult {
            // Find records strictly belonging to the active company tenant
            $records = [];
            if (method_exists($this->recordRepository, 'findByIds')) {
                $records = $this->recordRepository->findByIds($command->companyId, $cleanRecordIds);
            }

            // Calculate aggregate financial amount and extract validated record IDs
            $totalAmount = 0.0;
            $matchingIds = [];

            if (!empty($records)) {
                foreach ($records as $record) {
                    $totalAmount += $record->amount()->amount();
                    $matchingIds[] = $record->id();
                }
            } else {
                // If repository doesn't have findByIds yet, fallback to cleanRecordIds scoped to tenant
                $matchingIds = $cleanRecordIds;
            }

            if (empty($matchingIds)) {
                return new BatchDeleteFinancialRecordsResult(
                    deletedCount: 0,
                    totalAmount: 0.0,
                    deletedRecordIds: []
                );
            }

            // Delegate tenant-scoped deletion to repository
            $deletedCount = 0;
            if (method_exists($this->recordRepository, 'deleteManyByIds')) {
                $deletedCount = $this->recordRepository->deleteManyByIds($command->companyId, $matchingIds);
            }

            $roundedAmount = round($totalAmount, 2);

            // Dispatch domain event if available
            if ($deletedCount > 0 && $this->dispatcher !== null) {
                $this->dispatcher->dispatch(new FinancialRecordsBatchDeleted(
                    companyId: $command->companyId,
                    recordIds: $matchingIds,
                    deletedCount: $deletedCount,
                    totalAmount: $roundedAmount,
                    userId: $command->userId,
                    ipAddress: $command->ipAddress
                ));
            }


            return new BatchDeleteFinancialRecordsResult(
                deletedCount: $deletedCount,
                totalAmount: $roundedAmount,
                deletedRecordIds: $matchingIds
            );
        });
    }
}
