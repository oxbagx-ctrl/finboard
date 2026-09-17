<?php

declare(strict_types=1);

namespace App\Contexts\Finance\Domain\Repositories;

use App\Contexts\Finance\Domain\Model\FinancialRecord;
use App\Contexts\Finance\Domain\ValueObjects\DateRange;
use App\Contexts\Finance\Domain\ValueObjects\FinancialRecordId;

interface FinancialRecordRepositoryInterface
{
    public function findById(FinancialRecordId $id): ?FinancialRecord;

    /**
     * @return array<FinancialRecord>
     */
    public function findByCompanyId(string $companyId, ?DateRange $period = null): array;

    public function save(FinancialRecord $record): void;

    /**
     * @param array<FinancialRecord> $records
     */
    public function saveMany(array $records): void;

    public function delete(FinancialRecordId $id): void;

    public function deleteByCompanyId(string $companyId): int;
}
