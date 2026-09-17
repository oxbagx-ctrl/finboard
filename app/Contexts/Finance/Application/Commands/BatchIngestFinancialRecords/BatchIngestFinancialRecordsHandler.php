<?php

declare(strict_types=1);

namespace App\Contexts\Finance\Application\Commands\BatchIngestFinancialRecords;

use App\Contexts\Finance\Application\Exceptions\CategoryNotFoundException;
use App\Contexts\Finance\Domain\Model\FinancialRecord;
use App\Contexts\Finance\Domain\Repositories\CategoryRepositoryInterface;
use App\Contexts\Finance\Domain\Repositories\FinancialRecordRepositoryInterface;
use App\Contexts\Finance\Domain\ValueObjects\Currency;
use App\Contexts\Finance\Domain\ValueObjects\FinancialRecordId;
use App\Contexts\Finance\Domain\ValueObjects\Money;
use DateTimeImmutable;

final class BatchIngestFinancialRecordsHandler
{
    public function __construct(
        private readonly FinancialRecordRepositoryInterface $recordRepository,
        private readonly CategoryRepositoryInterface $categoryRepository
    ) {
    }

    /**
     * @return array<string> List of created FinancialRecord IDs
     */
    public function handle(BatchIngestFinancialRecordsCommand $command): array
    {
        if (empty($command->recordsData)) {
            return [];
        }

        // Cache all categories to prevent N+1 queries
        $categories = [];
        foreach ($this->categoryRepository->all() as $cat) {
            $categories[$cat->id()] = $cat;
            $categories[$cat->code()] = $cat; // Also allow matching by code
        }

        $records = [];
        $createdIds = [];

        foreach ($command->recordsData as $data) {
            $categoryId = $data['category_id'];
            $category = $categories[$categoryId] ?? null;

            if ($category === null) {
                throw CategoryNotFoundException::withId($categoryId);
            }

            $recordId = FinancialRecordId::generate();
            $currency = Currency::from($data['currency'] ?? $command->defaultCurrency);
            $amount = Money::fromDecimal($data['amount'], $currency);
            $recordDate = new DateTimeImmutable($data['record_date']);
            $source = $data['source'] ?? $command->defaultSource;

            $record = FinancialRecord::create(
                id: $recordId,
                companyId: $command->companyId,
                category: $category,
                amount: $amount,
                recordDate: $recordDate,
                description: $data['description'],
                source: $source
            );

            $records[] = $record;
            $createdIds[] = $record->id();
        }

        $this->recordRepository->saveMany($records);

        return $createdIds;
    }
}
