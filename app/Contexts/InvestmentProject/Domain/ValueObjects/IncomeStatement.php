<?php

declare(strict_types=1);

namespace App\Contexts\InvestmentProject\Domain\ValueObjects;

use App\Contexts\Finance\Domain\ValueObjects\Currency;
use App\Contexts\Finance\Domain\ValueObjects\Money;
use App\Shared\Domain\ValueObject;

final class IncomeStatement implements ValueObject
{
    /** @var array<int, IncomeStatementPeriod> */
    private array $monthlyPeriods;

    /** @var array<int, AnnualIncomeStatement> */
    private array $annualStatements;

    /**
     * @param array<IncomeStatementPeriod> $monthlyPeriods
     * @param array<int, AnnualIncomeStatement> $annualStatements
     */
    public function __construct(
        private readonly Currency $currency,
        private readonly int $horizonYears,
        private readonly OperatingAssumptions $assumptions,
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

    public function assumptions(): OperatingAssumptions
    {
        return $this->assumptions;
    }

    /**
     * @return array<IncomeStatementPeriod>
     */
    public function monthlyPeriods(): array
    {
        return $this->monthlyPeriods;
    }

    public function monthlyPeriodCount(): int
    {
        return count($this->monthlyPeriods);
    }

    public function monthlyPeriod(int $periodNumber): ?IncomeStatementPeriod
    {
        foreach ($this->monthlyPeriods as $p) {
            if ($p->periodNumber() === $periodNumber) {
                return $p;
            }
        }

        return null;
    }

    /**
     * @return array<int, AnnualIncomeStatement>
     */
    public function annualStatements(): array
    {
        return $this->annualStatements;
    }

    public function annualStatement(int $year): ?AnnualIncomeStatement
    {
        return $this->annualStatements[$year] ?? null;
    }

    public function annualRevenue(int $year): Money
    {
        return isset($this->annualStatements[$year])
            ? $this->annualStatements[$year]->revenue()
            : Money::zero($this->currency);
    }

    public function annualEbitda(int $year): Money
    {
        return isset($this->annualStatements[$year])
            ? $this->annualStatements[$year]->ebitda()
            : Money::zero($this->currency);
    }

    public function annualEbit(int $year): Money
    {
        return isset($this->annualStatements[$year])
            ? $this->annualStatements[$year]->ebit()
            : Money::zero($this->currency);
    }

    public function annualNetIncome(int $year): Money
    {
        return isset($this->annualStatements[$year])
            ? $this->annualStatements[$year]->netIncome()
            : Money::zero($this->currency);
    }

    public function annualInterestExpense(int $year): Money
    {
        return isset($this->annualStatements[$year])
            ? $this->annualStatements[$year]->interestExpense()
            : Money::zero($this->currency);
    }

    public function annualDepreciation(int $year): Money
    {
        return isset($this->annualStatements[$year])
            ? $this->annualStatements[$year]->depreciation()
            : Money::zero($this->currency);
    }

    public function annualCit(int $year): Money
    {
        return isset($this->annualStatements[$year])
            ? $this->annualStatements[$year]->incomeTax()
            : Money::zero($this->currency);
    }

    public function totalRevenuesOverHorizon(): Money
    {
        $sum = Money::zero($this->currency);
        foreach ($this->annualStatements as $s) {
            $sum = $sum->add($s->revenue());
        }

        return $sum;
    }

    public function totalNetIncomeOverHorizon(): Money
    {
        $sum = Money::zero($this->currency);
        foreach ($this->annualStatements as $s) {
            $sum = $sum->add($s->netIncome());
        }

        return $sum;
    }

    public function equals(ValueObject $other): bool
    {
        if (!$other instanceof self) {
            return false;
        }

        return $this->currency === $other->currency
            && $this->horizonYears === $other->horizonYears
            && $this->totalRevenuesOverHorizon()->equals($other->totalRevenuesOverHorizon())
            && $this->totalNetIncomeOverHorizon()->equals($other->totalNetIncomeOverHorizon());
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
            'assumptions' => $this->assumptions->toArray(),
            'total_revenues_over_horizon' => $this->totalRevenuesOverHorizon()->amount(),
            'total_net_income_over_horizon' => $this->totalNetIncomeOverHorizon()->amount(),
            'annual_statements' => $annual,
            'monthly_periods_count' => count($this->monthlyPeriods),
        ];
    }
}
