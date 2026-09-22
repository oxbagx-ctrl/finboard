<?php

declare(strict_types=1);

namespace App\Contexts\InvestmentProject\Domain\ValueObjects;

use App\Contexts\Finance\Domain\ValueObjects\Currency;
use App\Contexts\Finance\Domain\ValueObjects\Money;
use App\Shared\Domain\ValueObject;
use InvalidArgumentException;

final class GrantCalculationResult implements ValueObject
{
    /** @var array<int, GrantTranche> */
    private array $tranches;

    /**
     * @param array<GrantTranche> $tranches
     */
    public function __construct(
        private readonly string $grantProgramName,
        private readonly Money $totalCapex,
        private readonly Money $totalEligibleCosts,
        private readonly Money $nonEligibleCosts,
        private readonly float $coFinancingRatePercent,
        private readonly Money $maxGrantAmount,
        private readonly Money $advancePaymentAmount,
        private readonly Money $beneficiaryEligibleContribution,
        private readonly Money $totalBeneficiaryContribution,
        array $tranches = []
    ) {
        if ($this->coFinancingRatePercent < 0.0 || $this->coFinancingRatePercent > 100.0) {
            throw new InvalidArgumentException(
                sprintf('Co-financing rate must be between 0.0%% and 100.0%%, %.2f%% given.', $this->coFinancingRatePercent)
            );
        }

        $this->tranches = array_values($tranches);
    }

    public function grantProgramName(): string
    {
        return $this->grantProgramName;
    }

    public function totalCapex(): Money
    {
        return $this->totalCapex;
    }

    public function totalEligibleCosts(): Money
    {
        return $this->totalEligibleCosts;
    }

    public function nonEligibleCosts(): Money
    {
        return $this->nonEligibleCosts;
    }

    public function coFinancingRatePercent(): float
    {
        return $this->coFinancingRatePercent;
    }

    public function maxGrantAmount(): Money
    {
        return $this->maxGrantAmount;
    }

    public function advancePaymentAmount(): Money
    {
        return $this->advancePaymentAmount;
    }

    public function beneficiaryEligibleContribution(): Money
    {
        return $this->beneficiaryEligibleContribution;
    }

    public function totalBeneficiaryContribution(): Money
    {
        return $this->totalBeneficiaryContribution;
    }

    public function currency(): Currency
    {
        return $this->totalCapex->currency();
    }

    /**
     * @return array<GrantTranche>
     */
    public function tranches(): array
    {
        return $this->tranches;
    }

    public function trancheCount(): int
    {
        return count($this->tranches);
    }

    public function totalDisbursed(): Money
    {
        $sum = Money::zero($this->currency());
        foreach ($this->tranches as $tranche) {
            $sum = $sum->add($tranche->disbursementAmount());
        }

        return $sum;
    }

    public function advanceTranche(): ?GrantTranche
    {
        foreach ($this->tranches as $tranche) {
            if ($tranche->isAdvance()) {
                return $tranche;
            }
        }

        return null;
    }

    /**
     * @return array<GrantTranche>
     */
    public function interimTranches(): array
    {
        return array_values(
            array_filter($this->tranches, fn (GrantTranche $t) => $t->isInterim())
        );
    }

    public function finalTranche(): ?GrantTranche
    {
        foreach ($this->tranches as $tranche) {
            if ($tranche->isFinal()) {
                return $tranche;
            }
        }

        return null;
    }

    public function disbursementAtMonth(int $month): Money
    {
        $sum = Money::zero($this->currency());
        foreach ($this->tranches as $tranche) {
            if ($tranche->month() === $month) {
                $sum = $sum->add($tranche->disbursementAmount());
            }
        }

        return $sum;
    }

    public function cumulativeDisbursementAtMonth(int $month): Money
    {
        $sum = Money::zero($this->currency());
        foreach ($this->tranches as $tranche) {
            if ($tranche->month() <= $month) {
                $sum = $sum->add($tranche->disbursementAmount());
            }
        }

        return $sum;
    }

    /**
     * Aggregates grant disbursement inflows by year (1..horizonYears).
     *
     * @return array<int, Money> Year (1-based) => Total grant received in that year
     */
    public function annualDisbursementSummary(int $horizonYears = 15): array
    {
        $summary = [];
        for ($year = 1; $year <= $horizonYears; $year++) {
            $summary[$year] = Money::zero($this->currency());
        }

        foreach ($this->tranches as $tranche) {
            // month 1..12 => year 1, 13..24 => year 2, etc. (month 0 is treated as year 1)
            $year = $tranche->month() <= 0 ? 1 : (int) ceil($tranche->month() / 12);
            if ($year <= $horizonYears) {
                $summary[$year] = $summary[$year]->add($tranche->disbursementAmount());
            }
        }

        return $summary;
    }

    public function equals(ValueObject $other): bool
    {
        if (!$other instanceof self) {
            return false;
        }

        return $this->grantProgramName === $other->grantProgramName
            && $this->totalCapex->equals($other->totalCapex)
            && $this->totalEligibleCosts->equals($other->totalEligibleCosts)
            && $this->maxGrantAmount->equals($other->maxGrantAmount)
            && abs($this->coFinancingRatePercent - $other->coFinancingRatePercent) < 0.0001
            && $this->trancheCount() === $other->trancheCount();
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        $annual = [];
        foreach ($this->annualDisbursementSummary() as $year => $money) {
            $annual[$year] = $money->amount();
        }

        return [
            'grant_program_name' => $this->grantProgramName,
            'currency' => $this->currency()->value,
            'total_capex' => $this->totalCapex->amount(),
            'total_eligible_costs' => $this->totalEligibleCosts->amount(),
            'non_eligible_costs' => $this->nonEligibleCosts->amount(),
            'co_financing_rate_percent' => $this->coFinancingRatePercent,
            'max_grant_amount' => $this->maxGrantAmount->amount(),
            'advance_payment_amount' => $this->advancePaymentAmount->amount(),
            'beneficiary_eligible_contribution' => $this->beneficiaryEligibleContribution->amount(),
            'total_beneficiary_contribution' => $this->totalBeneficiaryContribution->amount(),
            'total_disbursed' => $this->totalDisbursed()->amount(),
            'tranches' => array_map(fn (GrantTranche $t) => $t->toArray(), $this->tranches),
            'annual_disbursement_summary' => $annual,
        ];
    }
}
