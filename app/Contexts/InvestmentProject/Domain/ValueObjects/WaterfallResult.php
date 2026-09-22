<?php

declare(strict_types=1);

namespace App\Contexts\InvestmentProject\Domain\ValueObjects;

use App\Contexts\Finance\Domain\ValueObjects\Currency;
use App\Contexts\Finance\Domain\ValueObjects\Money;
use App\Shared\Domain\ValueObject;
use InvalidArgumentException;

final class WaterfallResult implements ValueObject
{
    /** @var array<int, WaterfallAnnualPeriod> */
    private array $annualPeriods;

    /**
     * @param array<int, WaterfallAnnualPeriod> $annualPeriods
     */
    public function __construct(
        private readonly Currency $currency,
        private readonly int $horizonYears,
        private readonly Money $totalEquityInvested,
        private readonly Money $totalCashDistributed,
        private readonly WaterfallStructure $structure,
        private readonly InvestorReturn $investor1Return,
        private readonly InvestorReturn $investor2Return,
        array $annualPeriods,
        private readonly ?float $targetIrr = null,
        private readonly ?float $targetIrrVariance = null
    ) {
        if ($this->horizonYears < 1) {
            throw new InvalidArgumentException(
                sprintf('Horizon years must be >= 1, %d given.', $this->horizonYears)
            );
        }

        $this->annualPeriods = $annualPeriods;
    }

    public function currency(): Currency
    {
        return $this->currency;
    }

    public function horizonYears(): int
    {
        return $this->horizonYears;
    }

    public function totalEquityInvested(): Money
    {
        return $this->totalEquityInvested;
    }

    public function totalCashDistributed(): Money
    {
        return $this->totalCashDistributed;
    }

    public function structure(): WaterfallStructure
    {
        return $this->structure;
    }

    public function investor1Return(): InvestorReturn
    {
        return $this->investor1Return;
    }

    public function investor2Return(): InvestorReturn
    {
        return $this->investor2Return;
    }

    /**
     * @return array<int, WaterfallAnnualPeriod>
     */
    public function annualPeriods(): array
    {
        return $this->annualPeriods;
    }

    public function annualPeriod(int $year): ?WaterfallAnnualPeriod
    {
        return $this->annualPeriods[$year] ?? null;
    }

    public function targetIrr(): ?float
    {
        return $this->targetIrr;
    }

    public function targetIrrVariance(): ?float
    {
        return $this->targetIrrVariance;
    }

    public function isTargetIrrMet(): bool
    {
        if ($this->targetIrr === null || $this->targetIrrVariance === null) {
            return true;
        }

        return abs($this->targetIrrVariance) < 0.05; // Within 5 bps
    }

    public function isFullyBalanced(): bool
    {
        $sumDistributions = $this->investor1Return->totalDistributions()->add($this->investor2Return->totalDistributions());

        return $sumDistributions->equals($this->totalCashDistributed);
    }

    public function equals(ValueObject $other): bool
    {
        if (!$other instanceof self) {
            return false;
        }

        return $this->currency === $other->currency
            && $this->horizonYears === $other->horizonYears
            && $this->totalEquityInvested->equals($other->totalEquityInvested)
            && $this->totalCashDistributed->equals($other->totalCashDistributed)
            && $this->investor1Return->equals($other->investor1Return)
            && $this->investor2Return->equals($other->investor2Return);
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        $periods = [];
        foreach ($this->annualPeriods as $year => $period) {
            $periods[$year] = $period->toArray();
        }

        return [
            'currency' => $this->currency->value,
            'horizon_years' => $this->horizonYears,
            'total_equity_invested' => $this->totalEquityInvested->amount(),
            'total_cash_distributed' => $this->totalCashDistributed->amount(),
            'is_fully_balanced' => $this->isFullyBalanced(),
            'target_irr_percent' => $this->targetIrr,
            'target_irr_variance' => $this->targetIrrVariance,
            'is_target_irr_met' => $this->isTargetIrrMet(),
            'structure' => $this->structure->toArray(),
            'investor_1' => $this->investor1Return->toArray(),
            'investor_2' => $this->investor2Return->toArray(),
            'annual_periods' => $periods,
        ];
    }
}
