<?php

declare(strict_types=1);

namespace App\Contexts\InvestmentProject\Domain\ValueObjects;

use App\Contexts\Finance\Domain\ValueObjects\Currency;
use App\Contexts\Finance\Domain\ValueObjects\Money;
use App\Shared\Domain\ValueObject;

final class CashFlowStatement implements ValueObject
{
    /** @var array<int, CashFlowPeriod> */
    private array $monthlyPeriods;

    /** @var array<int, AnnualCashFlowStatement> */
    private array $annualStatements;

    /**
     * @param array<CashFlowPeriod> $monthlyPeriods
     * @param array<int, AnnualCashFlowStatement> $annualStatements
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
     * @return array<CashFlowPeriod>
     */
    public function monthlyPeriods(): array
    {
        return $this->monthlyPeriods;
    }

    public function monthlyPeriodCount(): int
    {
        return count($this->monthlyPeriods);
    }

    public function monthlyPeriod(int $periodNumber): ?CashFlowPeriod
    {
        foreach ($this->monthlyPeriods as $p) {
            if ($p->periodNumber() === $periodNumber) {
                return $p;
            }
        }

        return null;
    }

    /**
     * @return array<int, AnnualCashFlowStatement>
     */
    public function annualStatements(): array
    {
        return $this->annualStatements;
    }

    public function annualStatement(int $year): ?AnnualCashFlowStatement
    {
        return $this->annualStatements[$year] ?? null;
    }

    public function annualOperatingCashFlow(int $year): Money
    {
        return isset($this->annualStatements[$year])
            ? $this->annualStatements[$year]->operatingCashFlow()
            : Money::zero($this->currency);
    }

    public function annualInvestingCashFlow(int $year): Money
    {
        return isset($this->annualStatements[$year])
            ? $this->annualStatements[$year]->investingCashFlow()
            : Money::zero($this->currency);
    }

    public function annualFinancingCashFlow(int $year): Money
    {
        return isset($this->annualStatements[$year])
            ? $this->annualStatements[$year]->financingCashFlow()
            : Money::zero($this->currency);
    }

    public function annualNetCashFlow(int $year): Money
    {
        return isset($this->annualStatements[$year])
            ? $this->annualStatements[$year]->netCashFlow()
            : Money::zero($this->currency);
    }

    public function closingCashBalance(int $year): Money
    {
        return isset($this->annualStatements[$year])
            ? $this->annualStatements[$year]->closingCashBalance()
            : Money::zero($this->currency);
    }

    public function totalOperatingCashFlow(): Money
    {
        $sum = Money::zero($this->currency);
        foreach ($this->annualStatements as $s) {
            $sum = $sum->add($s->operatingCashFlow());
        }

        return $sum;
    }

    public function totalInvestingCashFlow(): Money
    {
        $sum = Money::zero($this->currency);
        foreach ($this->annualStatements as $s) {
            $sum = $sum->add($s->investingCashFlow());
        }

        return $sum;
    }

    public function totalFinancingCashFlow(): Money
    {
        $sum = Money::zero($this->currency);
        foreach ($this->annualStatements as $s) {
            $sum = $sum->add($s->financingCashFlow());
        }

        return $sum;
    }

    public function totalNetCashFlow(): Money
    {
        $sum = Money::zero($this->currency);
        foreach ($this->annualStatements as $s) {
            $sum = $sum->add($s->netCashFlow());
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
            && $this->totalNetCashFlow()->equals($other->totalNetCashFlow());
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
            'total_cfo' => $this->totalOperatingCashFlow()->amount(),
            'total_cfi' => $this->totalInvestingCashFlow()->amount(),
            'total_cff' => $this->totalFinancingCashFlow()->amount(),
            'total_ncf' => $this->totalNetCashFlow()->amount(),
            'annual_statements' => $annual,
            'monthly_periods_count' => count($this->monthlyPeriods),
        ];
    }
}
