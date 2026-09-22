<?php

declare(strict_types=1);

namespace App\Contexts\InvestmentProject\Domain\ValueObjects;

use App\Contexts\Finance\Domain\ValueObjects\Currency;
use App\Contexts\Finance\Domain\ValueObjects\Money;
use App\Shared\Domain\ValueObject;

final class DepreciationSchedule implements ValueObject
{
    /** @var array<int, FixedAssetPeriod> */
    private array $monthlyPeriods;

    /** @var array<int, AnnualDepreciationSummary> */
    private array $annualSummaries;

    /** @var array<string, array<int, AnnualDepreciationSummary>> */
    private array $byKstSummaries;

    /** @var array<string, array<int, AnnualDepreciationSummary>> */
    private array $byStageSummaries;

    /**
     * @param array<FixedAssetPeriod> $monthlyPeriods
     * @param array<int, AnnualDepreciationSummary> $annualSummaries
     * @param array<string, array<int, AnnualDepreciationSummary>> $byKstSummaries
     * @param array<string, array<int, AnnualDepreciationSummary>> $byStageSummaries
     */
    public function __construct(
        private readonly Currency $currency,
        private readonly int $horizonYears,
        array $monthlyPeriods,
        array $annualSummaries,
        array $byKstSummaries = [],
        array $byStageSummaries = []
    ) {
        $this->monthlyPeriods = array_values($monthlyPeriods);
        $this->annualSummaries = $annualSummaries;
        $this->byKstSummaries = $byKstSummaries;
        $this->byStageSummaries = $byStageSummaries;
    }

    public function currency(): Currency
    {
        return $this->currency;
    }

    public function horizonYears(): int
    {
        return $this->horizonYears;
    }

    /**
     * @return array<FixedAssetPeriod>
     */
    public function monthlyPeriods(): array
    {
        return $this->monthlyPeriods;
    }

    public function monthlyPeriodCount(): int
    {
        return count($this->monthlyPeriods);
    }

    public function monthlyPeriod(int $periodNumber): ?FixedAssetPeriod
    {
        foreach ($this->monthlyPeriods as $p) {
            if ($p->periodNumber() === $periodNumber) {
                return $p;
            }
        }

        return null;
    }

    /**
     * @return array<int, AnnualDepreciationSummary>
     */
    public function annualSummaries(): array
    {
        return $this->annualSummaries;
    }

    public function annualSummary(int $year): ?AnnualDepreciationSummary
    {
        return $this->annualSummaries[$year] ?? null;
    }

    public function annualDepreciation(int $year): Money
    {
        return isset($this->annualSummaries[$year])
            ? $this->annualSummaries[$year]->depreciationExpense()
            : Money::zero($this->currency);
    }

    public function closingNetBookValue(int $year): Money
    {
        return isset($this->annualSummaries[$year])
            ? $this->annualSummaries[$year]->closingNetBookValue()
            : Money::zero($this->currency);
    }

    public function closingTotalFixedAssets(int $year): Money
    {
        return isset($this->annualSummaries[$year])
            ? $this->annualSummaries[$year]->totalFixedAssetsClosing()
            : Money::zero($this->currency);
    }

    public function totalCapexIncurred(): Money
    {
        $sum = Money::zero($this->currency);
        foreach ($this->annualSummaries as $s) {
            $sum = $sum->add($s->capexIncurred());
        }

        return $sum;
    }

    public function totalDepreciationOverHorizon(): Money
    {
        $sum = Money::zero($this->currency);
        foreach ($this->annualSummaries as $s) {
            $sum = $sum->add($s->depreciationExpense());
        }

        return $sum;
    }

    /**
     * @return array<string, array<int, AnnualDepreciationSummary>>
     */
    public function byKstSummaries(): array
    {
        return $this->byKstSummaries;
    }

    /**
     * @return array<string, array<int, AnnualDepreciationSummary>>
     */
    public function byStageSummaries(): array
    {
        return $this->byStageSummaries;
    }

    public function equals(ValueObject $other): bool
    {
        if (!$other instanceof self) {
            return false;
        }

        return $this->currency === $other->currency
            && $this->horizonYears === $other->horizonYears
            && $this->monthlyPeriodCount() === $other->monthlyPeriodCount()
            && $this->totalCapexIncurred()->equals($other->totalCapexIncurred())
            && $this->totalDepreciationOverHorizon()->equals($other->totalDepreciationOverHorizon());
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        $annual = [];
        foreach ($this->annualSummaries as $year => $summary) {
            $annual[$year] = $summary->toArray();
        }

        return [
            'currency' => $this->currency->value,
            'horizon_years' => $this->horizonYears,
            'total_capex_incurred' => $this->totalCapexIncurred()->amount(),
            'total_depreciation_over_horizon' => $this->totalDepreciationOverHorizon()->amount(),
            'annual_summaries' => $annual,
            'monthly_periods_count' => count($this->monthlyPeriods),
        ];
    }
}
