<?php

declare(strict_types=1);

namespace App\Contexts\Finance\Application\Queries\GetFinancialMetrics;

use App\Contexts\Finance\Domain\Repositories\FinancialRecordRepositoryInterface;
use App\Contexts\Finance\Domain\Services\FinancialCalculator;
use App\Contexts\Finance\Domain\ValueObjects\Currency;
use App\Contexts\Finance\Domain\ValueObjects\DateRange;
use App\Contexts\Finance\Domain\ValueObjects\FinancialMetrics;

final class GetFinancialMetricsHandler
{
    public function __construct(
        private readonly FinancialRecordRepositoryInterface $recordRepository,
        private readonly FinancialCalculator $calculator
    ) {
    }

    public function handle(GetFinancialMetricsQuery $query): FinancialMetrics
    {
        $currency = Currency::tryFrom(strtoupper($query->currency)) ?? Currency::PLN;

        $period = null;
        if ($query->startDate !== null && $query->endDate !== null) {
            $period = DateRange::fromStrings($query->startDate, $query->endDate);
        }

        $records = $this->recordRepository->findByCompanyId($query->companyId, $period);

        return $this->calculator->calculateMetrics($records, $currency, $period);
    }
}
