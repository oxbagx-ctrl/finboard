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

    /**
     * @return array<int> List of distinct fiscal years with financial records for company, sorted descending (e.g. [2026, 2025, 2024])
     */
    public function getAvailableFiscalYears(string $companyId): array;

    public function save(FinancialRecord $record): void;

    /**
     * @param array<FinancialRecord> $records
     */
    public function saveMany(array $records): void;

    public function delete(FinancialRecordId $id): void;

    public function deleteByCompanyId(string $companyId): int;
}
