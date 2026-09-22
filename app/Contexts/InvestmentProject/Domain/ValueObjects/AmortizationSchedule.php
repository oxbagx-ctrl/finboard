<?php

declare(strict_types=1);

namespace App\Contexts\InvestmentProject\Domain\ValueObjects;

use App\Contexts\Finance\Domain\ValueObjects\Currency;
use App\Contexts\Finance\Domain\ValueObjects\Money;
use App\Shared\Domain\ValueObject;

final class AmortizationSchedule implements ValueObject
{
    /** @var array<int, AmortizationPeriod> */
    private array $periods;

    /** @var array<int, AnnualDebtSummary> */
    private array $annualSummaries;

    /**
     * @param array<AmortizationPeriod> $periods
     */
    public function __construct(
        private readonly string $facilityId,
        private readonly Money $principal,
        private readonly Money $upfrontFee,
        private readonly float $nominalAnnualRate,
        private readonly AmortizationType $amortizationType,
        array $periods
    ) {
        $this->periods = $periods;
        $this->annualSummaries = $this->buildAnnualSummaries();
    }

    public function facilityId(): string
    {
        return $this->facilityId;
    }

    public function principal(): Money
    {
        return $this->principal;
    }

    public function upfrontFee(): Money
    {
        return $this->upfrontFee;
    }

    public function nominalAnnualRate(): float
    {
        return $this->nominalAnnualRate;
    }

    public function amortizationType(): AmortizationType
    {
        return $this->amortizationType;
    }

    public function currency(): Currency
    {
        return $this->principal->currency();
    }

    /**
     * @return array<AmortizationPeriod>
     */
    public function periods(): array
    {
        return $this->periods;
    }

    public function periodCount(): int
    {
        return count($this->periods);
    }

    public function period(int $number): ?AmortizationPeriod
    {
        foreach ($this->periods as $p) {
            if ($p->periodNumber() === $number) {
                return $p;
            }
        }

        return null;
    }

    /**
     * @return array<int, AnnualDebtSummary>
     */
    public function annualSummaries(): array
    {
        return $this->annualSummaries;
    }

    public function annualSummary(int $year): ?AnnualDebtSummary
    {
        return $this->annualSummaries[$year] ?? null;
    }

    public function totalPrincipalPaid(): Money
    {
        $total = Money::zero($this->currency());
        foreach ($this->periods as $p) {
            $total = $total->add($p->principalPayment());
        }

        return $total;
    }

    public function totalInterestPaid(): Money
    {
        $total = Money::zero($this->currency());
        foreach ($this->periods as $p) {
            $total = $total->add($p->interestPayment());
        }

        return $total;
    }

    public function totalDebtService(): Money
    {
        return $this->totalPrincipalPaid()->add($this->totalInterestPaid());
    }

    public function totalCostOfCredit(): Money
    {
        return $this->totalInterestPaid()->add($this->upfrontFee);
    }

    /**
     * Outstanding debt balance at the end of a specific month period.
     */
    public function outstandingBalanceAt(int $periodNumber): Money
    {
        $p = $this->period($periodNumber);
        if ($p !== null) {
            return $p->closingBalance();
        }

        if ($periodNumber <= 0) {
            return $this->principal;
        }

        return Money::zero($this->currency());
    }

    /**
     * Build aggregated yearly summaries (for 15-year 3-statement models).
     *
     * @return array<int, AnnualDebtSummary>
     */
    private function buildAnnualSummaries(): array
    {
        if (empty($this->periods)) {
            return [];
        }

        $byYear = [];
        foreach ($this->periods as $p) {
            $y = $p->yearNumber();
            $byYear[$y][] = $p;
        }

        $summaries = [];
        foreach ($byYear as $year => $yearPeriods) {
            $first = $yearPeriods[0];
            $last = end($yearPeriods);

            $yearPrincipal = Money::zero($this->currency());
            $yearInterest = Money::zero($this->currency());

            foreach ($yearPeriods as $yp) {
                $yearPrincipal = $yearPrincipal->add($yp->principalPayment());
                $yearInterest = $yearInterest->add($yp->interestPayment());
            }

            $summaries[$year] = new AnnualDebtSummary(
                year: $year,
                openingBalance: $first->openingBalance(),
                principalPaid: $yearPrincipal,
                interestPaid: $yearInterest,
                totalDebtService: $yearPrincipal->add($yearInterest),
                closingBalance: $last->closingBalance()
            );
        }

        return $summaries;
    }

    public function equals(ValueObject $other): bool
    {
        return $other instanceof self
            && $this->facilityId === $other->facilityId
            && $this->principal->equals($other->principal)
            && count($this->periods) === count($other->periods);
    }
}
