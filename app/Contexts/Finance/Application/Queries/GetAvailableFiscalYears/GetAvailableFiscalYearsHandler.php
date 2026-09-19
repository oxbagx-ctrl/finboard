<?php

declare(strict_types=1);

namespace App\Contexts\Finance\Application\Queries\GetAvailableFiscalYears;

use App\Contexts\Finance\Domain\Repositories\FinancialRecordRepositoryInterface;
use DateTimeImmutable;

final class GetAvailableFiscalYearsHandler
{
    public function __construct(
        private readonly FinancialRecordRepositoryInterface $recordRepository
    ) {
    }

    /**
     * @return array<int> Sorted list of available fiscal years (e.g. [2026, 2025, 2024, 2023])
     */
    public function handle(GetAvailableFiscalYearsQuery $query): array
    {
        $years = $this->recordRepository->getAvailableFiscalYears($query->companyId);

        // Edge-case: if company has no records yet, fallback to current calendar year
        if (empty($years)) {
            return [(int) (new DateTimeImmutable())->format('Y')];
        }

        return $years;
    }
}
