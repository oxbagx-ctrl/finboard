<?php

declare(strict_types=1);

namespace App\Contexts\InvestmentProject\Domain\ValueObjects;

use App\Contexts\Finance\Domain\ValueObjects\Currency;
use App\Contexts\Finance\Domain\ValueObjects\Money;
use App\Shared\Domain\ValueObject;
use InvalidArgumentException;

final class LiquiditySchedule implements ValueObject
{
    /** @var array<int, LiquidityPeriod> */
    private array $monthlyPeriods;

    /** @var array<int, AnnualLiquiditySummary> */
    private array $annualSummaries;

    /** @var array<int, LiquidityAlert> */
    private array $alerts;

    /**
     * @param array<LiquidityPeriod> $monthlyPeriods
     * @param array<int, AnnualLiquiditySummary> $annualSummaries
     * @param array<LiquidityAlert> $alerts
     */
    public function __construct(
        private readonly Currency $currency,
        private readonly int $horizonYears,
        private readonly Money $facilityLimit,
        private readonly Money $minimumCashBuffer,
        private readonly float $annualInterestRate,
        array $monthlyPeriods,
        array $annualSummaries,
        array $alerts = []
    ) {
        if ($this->horizonYears < 1) {
            throw new InvalidArgumentException(
                sprintf('Horizon years must be >= 1, %d given.', $this->horizonYears)
            );
        }

        if ($this->annualInterestRate < 0.0) {
            throw new InvalidArgumentException(
                sprintf('Annual interest rate cannot be negative, %.2f given.', $this->annualInterestRate)
            );
        }

        $this->monthlyPeriods = array_values($monthlyPeriods);
        $this->annualSummaries = $annualSummaries;
        $this->alerts = array_values($alerts);
    }

    public function currency(): Currency
    {
        return $this->currency;
    }

    public function horizonYears(): int
    {
        return $this->horizonYears;
    }

    public function facilityLimit(): Money
    {
        return $this->facilityLimit;
    }

    public function minimumCashBuffer(): Money
    {
        return $this->minimumCashBuffer;
    }

    public function annualInterestRate(): float
    {
        return $this->annualInterestRate;
    }

    /**
     * @return array<LiquidityPeriod>
     */
    public function monthlyPeriods(): array
    {
        return $this->monthlyPeriods;
    }

    public function monthlyPeriodCount(): int
    {
        return count($this->monthlyPeriods);
    }

    public function monthlyPeriod(int $periodNumber): ?LiquidityPeriod
    {
        foreach ($this->monthlyPeriods as $p) {
            if ($p->periodNumber() === $periodNumber) {
                return $p;
            }
        }

        return null;
    }

    /**
     * @return array<int, AnnualLiquiditySummary>
     */
    public function annualSummaries(): array
    {
        return $this->annualSummaries;
    }

    public function annualSummary(int $year): ?AnnualLiquiditySummary
    {
        return $this->annualSummaries[$year] ?? null;
    }

    /**
     * @return array<LiquidityAlert>
     */
    public function alerts(): array
    {
        return $this->alerts;
    }

    /**
     * @return array<LiquidityAlert>
     */
    public function criticalAlerts(): array
    {
        return array_values(
            array_filter($this->alerts, fn (LiquidityAlert $a) => $a->isCritical())
        );
    }

    /**
     * @return array<LiquidityAlert>
     */
    public function warningAlerts(): array
    {
        return array_values(
            array_filter($this->alerts, fn (LiquidityAlert $a) => $a->isWarning())
        );
    }

    public function peakCashDeficit(): Money
    {
        $max = Money::zero($this->currency);
        foreach ($this->monthlyPeriods as $p) {
            if ($p->cashDeficit()->greaterThan($max)) {
                $max = $p->cashDeficit();
            }
        }

        return $max;
    }

    public function maxFacilityExposure(): Money
    {
        $max = Money::zero($this->currency);
        foreach ($this->monthlyPeriods as $p) {
            if ($p->revolvingFacilityClosing()->greaterThan($max)) {
                $max = $p->revolvingFacilityClosing();
            }
        }

        return $max;
    }

    public function totalInterestPaid(): Money
    {
        $sum = Money::zero($this->currency);
        foreach ($this->monthlyPeriods as $p) {
            $sum = $sum->add($p->revolvingInterest());
        }

        return $sum;
    }

    public function totalDrawdowns(): Money
    {
        $sum = Money::zero($this->currency);
        foreach ($this->monthlyPeriods as $p) {
            $sum = $sum->add($p->revolvingDrawdown());
        }

        return $sum;
    }

    public function totalRepayments(): Money
    {
        $sum = Money::zero($this->currency);
        foreach ($this->monthlyPeriods as $p) {
            $sum = $sum->add($p->revolvingRepayment());
        }

        return $sum;
    }

    public function totalMonthsWithDeficit(): int
    {
        $count = 0;
        foreach ($this->monthlyPeriods as $p) {
            if ($p->hasDeficit()) {
                $count++;
            }
        }

        return $count;
    }

    public function hasUnfundedDeficit(): bool
    {
        foreach ($this->monthlyPeriods as $p) {
            if ($p->isLimitExceeded()) {
                return true;
            }
        }

        return false;
    }

    /**
     * @return array<int> Period numbers where unfunded deficit occurs
     */
    public function unfundedDeficitMonths(): array
    {
        $months = [];
        foreach ($this->monthlyPeriods as $p) {
            if ($p->isLimitExceeded()) {
                $months[] = $p->periodNumber();
            }
        }

        return $months;
    }

    public function isLiquidOverHorizon(): bool
    {
        return !$this->hasUnfundedDeficit();
    }

    public function equals(ValueObject $other): bool
    {
        if (!$other instanceof self) {
            return false;
        }

        return $this->currency === $other->currency
            && $this->horizonYears === $other->horizonYears
            && $this->facilityLimit->equals($other->facilityLimit)
            && $this->minimumCashBuffer->equals($other->minimumCashBuffer)
            && abs($this->annualInterestRate - $other->annualInterestRate) < 0.0001
            && $this->totalInterestPaid()->equals($other->totalInterestPaid());
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

        $alerts = [];
        foreach ($this->alerts as $alert) {
            $alerts[] = $alert->toArray();
        }

        return [
            'currency' => $this->currency->value,
            'horizon_years' => $this->horizonYears,
            'facility_limit' => $this->facilityLimit->amount(),
            'minimum_cash_buffer' => $this->minimumCashBuffer->amount(),
            'annual_interest_rate' => $this->annualInterestRate,
            'peak_cash_deficit' => $this->peakCashDeficit()->amount(),
            'max_facility_exposure' => $this->maxFacilityExposure()->amount(),
            'total_interest_paid' => $this->totalInterestPaid()->amount(),
            'total_drawdowns' => $this->totalDrawdowns()->amount(),
            'total_repayments' => $this->totalRepayments()->amount(),
            'total_months_with_deficit' => $this->totalMonthsWithDeficit(),
            'has_unfunded_deficit' => $this->hasUnfundedDeficit(),
            'unfunded_deficit_months' => $this->unfundedDeficitMonths(),
            'is_liquid_over_horizon' => $this->isLiquidOverHorizon(),
            'alerts' => $alerts,
            'annual_summaries' => $annual,
            'monthly_periods_count' => count($this->monthlyPeriods),
        ];
    }
}
