<?php

declare(strict_types=1);

namespace App\Contexts\InvestmentProject\Domain\ValueObjects;

use App\Contexts\Finance\Domain\ValueObjects\Currency;
use App\Contexts\Finance\Domain\ValueObjects\Money;
use App\Shared\Domain\ValueObject;

final class BalanceSheet implements ValueObject
{
    /** @var array<int, BalanceSheetPeriod> */
    private array $monthlyPeriods;

    /** @var array<int, AnnualBalanceSheet> */
    private array $annualStatements;

    /**
     * @param array<BalanceSheetPeriod> $monthlyPeriods
     * @param array<int, AnnualBalanceSheet> $annualStatements
     */
    public function __construct(
        private readonly Currency $currency,
        private readonly int $horizonYears,
        array $monthlyPeriods,
        array $annualStatements
    ) {
        $this->monthlyPeriods = array_values($monthlyPeriods);
        $this->annualStatements = $annualStatements;
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
     * @return array<BalanceSheetPeriod>
     */
    public function monthlyPeriods(): array
    {
        return $this->monthlyPeriods;
    }

    public function monthlyPeriodCount(): int
    {
        return count($this->monthlyPeriods);
    }

    public function monthlyPeriod(int $periodNumber): ?BalanceSheetPeriod
    {
        foreach ($this->monthlyPeriods as $p) {
            if ($p->periodNumber() === $periodNumber) {
                return $p;
            }
        }

        return null;
    }

    /**
     * @return array<int, AnnualBalanceSheet>
     */
    public function annualStatements(): array
    {
        return $this->annualStatements;
    }

    public function annualStatement(int $year): ?AnnualBalanceSheet
    {
        return $this->annualStatements[$year] ?? null;
    }

    public function isBalancedOverHorizon(): bool
    {
        foreach ($this->annualStatements as $stmt) {
            if (!$stmt->isBalanced()) {
                return false;
            }
        }

        foreach ($this->monthlyPeriods as $period) {
            if (!$period->isBalanced()) {
                return false;
            }
        }

        return true;
    }

    public function maxVarianceOverHorizon(): Money
    {
        $max = Money::zero($this->currency);
        foreach ($this->annualStatements as $stmt) {
            $absVar = $stmt->variance()->isNegative()
                ? $stmt->variance()->multiply(-1)
                : $stmt->variance();

            if ($absVar->greaterThan($max)) {
                $max = $absVar;
            }
        }

        return $max;
    }

    public function annualTotalAssets(int $year): Money
    {
        return isset($this->annualStatements[$year])
            ? $this->annualStatements[$year]->totalAssets()
            : Money::zero($this->currency);
    }

    public function annualTotalEquity(int $year): Money
    {
        return isset($this->annualStatements[$year])
            ? $this->annualStatements[$year]->totalEquity()
            : Money::zero($this->currency);
    }

    public function annualTotalLiabilities(int $year): Money
    {
        return isset($this->annualStatements[$year])
            ? $this->annualStatements[$year]->totalLiabilities()
            : Money::zero($this->currency);
    }

    public function annualCashAndEquivalents(int $year): Money
    {
        return isset($this->annualStatements[$year])
            ? $this->annualStatements[$year]->cashAndEquivalents()
            : Money::zero($this->currency);
    }

    public function annualTotalFixedAssets(int $year): Money
    {
        return isset($this->annualStatements[$year])
            ? $this->annualStatements[$year]->totalFixedAssets()
            : Money::zero($this->currency);
    }

    public function equals(ValueObject $other): bool
    {
        if (!$other instanceof self) {
            return false;
        }

        return $this->currency === $other->currency
            && $this->horizonYears === $other->horizonYears
            && $this->isBalancedOverHorizon() === $other->isBalancedOverHorizon();
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        $annual = [];
        foreach ($this->annualStatements as $year => $s) {
            $annual[$year] = $s->toArray();
        }

        return [
            'currency' => $this->currency->value,
            'horizon_years' => $this->horizonYears,
            'is_balanced' => $this->isBalancedOverHorizon(),
            'max_variance' => $this->maxVarianceOverHorizon()->amount(),
            'annual_statements' => $annual,
            'monthly_periods_count' => count($this->monthlyPeriods),
        ];
    }
}
