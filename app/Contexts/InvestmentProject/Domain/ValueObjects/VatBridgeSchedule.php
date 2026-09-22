<?php

declare(strict_types=1);

namespace App\Contexts\InvestmentProject\Domain\ValueObjects;

use App\Contexts\Finance\Domain\ValueObjects\Currency;
use App\Contexts\Finance\Domain\ValueObjects\Money;
use App\Shared\Domain\ValueObject;

final class VatBridgeSchedule implements ValueObject
{
    /** @var array<int, VatBridgePeriod> */
    private array $periods;

    /**
     * @param array<VatBridgePeriod> $periods
     */
    public function __construct(
        private readonly Money $facilityLimit,
        private readonly int $reimbursementLagMonths,
        private readonly float $annualInterestRate,
        array $periods
    ) {
        $this->periods = $periods;
    }

    public function facilityLimit(): Money
    {
        return $this->facilityLimit;
    }

    public function reimbursementLagMonths(): int
    {
        return $this->reimbursementLagMonths;
    }

    public function annualInterestRate(): float
    {
        return $this->annualInterestRate;
    }

    public function currency(): Currency
    {
        return $this->facilityLimit->currency();
    }

    /**
     * @return array<VatBridgePeriod>
     */
    public function periods(): array
    {
        return $this->periods;
    }

    public function periodCount(): int
    {
        return count($this->periods);
    }

    public function period(int $number): ?VatBridgePeriod
    {
        foreach ($this->periods as $p) {
            if ($p->periodNumber() === $number) {
                return $p;
            }
        }

        return null;
    }

    public function finalPeriod(): ?VatBridgePeriod
    {
        return empty($this->periods) ? null : $this->periods[count($this->periods) - 1];
    }

    public function peakExposure(): Money
    {
        $peak = Money::zero($this->currency());
        foreach ($this->periods as $p) {
            if ($p->closingBalance()->greaterThan($peak)) {
                $peak = $p->closingBalance();
            }
        }

        return $peak;
    }

    public function totalVatIncurred(): Money
    {
        $total = Money::zero($this->currency());
        foreach ($this->periods as $p) {
            $total = $total->add($p->vatIncurred());
        }

        return $total;
    }

    public function totalVatRefunded(): Money
    {
        $total = Money::zero($this->currency());
        foreach ($this->periods as $p) {
            $total = $total->add($p->vatRefunded());
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

    public function isFullySettled(): bool
    {
        if (empty($this->periods)) {
            return true;
        }

        $last = end($this->periods);

        return $last->closingBalance()->isZero();
    }

    public function isWithinLimit(): bool
    {
        if ($this->facilityLimit->isZero()) {
            return true;
        }

        return !$this->peakExposure()->greaterThan($this->facilityLimit);
    }

    /**
     * Group monthly schedule into yearly summaries for 3-statement models.
     *
     * @return array<int, array<string, mixed>>
     */
    public function annualSummaries(): array
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

            $incurred = Money::zero($this->currency());
            $refunded = Money::zero($this->currency());
            $interest = Money::zero($this->currency());
            $peakYear = Money::zero($this->currency());

            foreach ($yearPeriods as $yp) {
                $incurred = $incurred->add($yp->vatIncurred());
                $refunded = $refunded->add($yp->vatRefunded());
                $interest = $interest->add($yp->interestPayment());
                if ($yp->closingBalance()->greaterThan($peakYear)) {
                    $peakYear = $yp->closingBalance();
                }
            }

            $summaries[$year] = [
                'year' => $year,
                'opening_balance' => $first->openingBalance()->amount(),
                'vat_incurred' => $incurred->amount(),
                'vat_refunded' => $refunded->amount(),
                'interest_paid' => $interest->amount(),
                'closing_balance' => $last->closingBalance()->amount(),
                'peak_exposure' => $peakYear->amount(),
                'currency' => $this->currency()->value,
            ];
        }

        return $summaries;
    }

    public function equals(ValueObject $other): bool
    {
        return $other instanceof self
            && $this->facilityLimit->equals($other->facilityLimit)
            && $this->reimbursementLagMonths === $other->reimbursementLagMonths
            && count($this->periods) === count($other->periods);
    }
}
