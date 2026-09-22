<?php

declare(strict_types=1);

namespace App\Contexts\InvestmentProject\Domain\ValueObjects;

use App\Contexts\Finance\Domain\ValueObjects\Currency;
use App\Contexts\Finance\Domain\ValueObjects\Money;
use App\Shared\Domain\ValueObject;
use InvalidArgumentException;

final class AppraisalResult implements ValueObject
{
    /** @var array<int, AnnualAppraisalPeriod> */
    private array $annualPeriods;

    /**
     * @param array<int, AnnualAppraisalPeriod> $annualPeriods
     */
    public function __construct(
        private readonly Currency $currency,
        private readonly int $horizonYears,
        private readonly WaccResult $wacc,
        private readonly ?DynamicWaccSchedule $dynamicWacc,
        private readonly TerminalValue $terminalValue,
        array $annualPeriods,
        // Enterprise / Project Level Metrics
        private readonly Money $sumDiscountedFcff,
        private readonly Money $discountedTerminalValue,
        private readonly Money $enterpriseValue,
        private readonly Money $pvCapex,
        private readonly Money $projectNpv,
        private readonly ?float $projectIrr,
        private readonly ?float $simplePaybackYears,
        private readonly ?float $discountedPaybackYears,
        private readonly float $profitabilityIndex,
        // Equity Level Metrics
        private readonly Money $initialEquity,
        private readonly Money $sumDiscountedFcfe,
        private readonly Money $discountedEquityTerminalValue,
        private readonly Money $equityNpv,
        private readonly ?float $equityIrr,
        private readonly float $equityMoic,
        private readonly ?float $equitySimplePaybackYears,
        private readonly ?float $equityDiscountedPaybackYears
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

    public function wacc(): WaccResult
    {
        return $this->wacc;
    }

    public function dynamicWacc(): ?DynamicWaccSchedule
    {
        return $this->dynamicWacc;
    }

    public function terminalValue(): TerminalValue
    {
        return $this->terminalValue;
    }

    /**
     * @return array<int, AnnualAppraisalPeriod>
     */
    public function annualPeriods(): array
    {
        return $this->annualPeriods;
    }

    public function annualPeriod(int $year): ?AnnualAppraisalPeriod
    {
        return $this->annualPeriods[$year] ?? null;
    }

    public function sumDiscountedFcff(): Money
    {
        return $this->sumDiscountedFcff;
    }

    public function discountedTerminalValue(): Money
    {
        return $this->discountedTerminalValue;
    }

    public function enterpriseValue(): Money
    {
        return $this->enterpriseValue;
    }

    public function pvCapex(): Money
    {
        return $this->pvCapex;
    }

    public function projectNpv(): Money
    {
        return $this->projectNpv;
    }

    public function projectIrr(): ?float
    {
        return $this->projectIrr;
    }

    public function simplePaybackYears(): ?float
    {
        return $this->simplePaybackYears;
    }

    public function discountedPaybackYears(): ?float
    {
        return $this->discountedPaybackYears;
    }

    public function profitabilityIndex(): float
    {
        return $this->profitabilityIndex;
    }

    public function initialEquity(): Money
    {
        return $this->initialEquity;
    }

    public function sumDiscountedFcfe(): Money
    {
        return $this->sumDiscountedFcfe;
    }

    public function discountedEquityTerminalValue(): Money
    {
        return $this->discountedEquityTerminalValue;
    }

    public function equityNpv(): Money
    {
        return $this->equityNpv;
    }

    public function equityIrr(): ?float
    {
        return $this->equityIrr;
    }

    public function equityMoic(): float
    {
        return $this->equityMoic;
    }

    public function equitySimplePaybackYears(): ?float
    {
        return $this->equitySimplePaybackYears;
    }

    public function equityDiscountedPaybackYears(): ?float
    {
        return $this->equityDiscountedPaybackYears;
    }

    public function isProjectProfitable(): bool
    {
        return $this->projectNpv->isPositive() || $this->projectNpv->isZero();
    }

    public function isEquityProfitable(): bool
    {
        return $this->equityNpv->isPositive() || $this->equityNpv->isZero();
    }

    public function equals(ValueObject $other): bool
    {
        if (!$other instanceof self) {
            return false;
        }

        return $this->currency === $other->currency
            && $this->horizonYears === $other->horizonYears
            && $this->projectNpv->equals($other->projectNpv)
            && $this->equityNpv->equals($other->equityNpv)
            && abs(($this->projectIrr ?? 0.0) - ($other->projectIrr ?? 0.0)) < 0.0001
            && abs(($this->equityIrr ?? 0.0) - ($other->equityIrr ?? 0.0)) < 0.0001;
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
            'enterprise_level' => [
                'enterprise_value' => $this->enterpriseValue->amount(),
                'pv_capex' => $this->pvCapex->amount(),
                'sum_discounted_fcff' => $this->sumDiscountedFcff->amount(),
                'discounted_terminal_value' => $this->discountedTerminalValue->amount(),
                'project_npv' => $this->projectNpv->amount(),
                'project_irr_percent' => $this->projectIrr,
                'profitability_index' => $this->profitabilityIndex,
                'simple_payback_years' => $this->simplePaybackYears,
                'discounted_payback_years' => $this->discountedPaybackYears,
                'is_profitable' => $this->isProjectProfitable(),
            ],
            'equity_level' => [
                'initial_equity' => $this->initialEquity->amount(),
                'sum_discounted_fcfe' => $this->sumDiscountedFcfe->amount(),
                'discounted_equity_terminal_value' => $this->discountedEquityTerminalValue->amount(),
                'equity_npv' => $this->equityNpv->amount(),
                'equity_irr_percent' => $this->equityIrr,
                'equity_moic' => $this->equityMoic,
                'equity_simple_payback_years' => $this->equitySimplePaybackYears,
                'equity_discounted_payback_years' => $this->equityDiscountedPaybackYears,
                'is_profitable' => $this->isEquityProfitable(),
            ],
            'terminal_value' => $this->terminalValue->toArray(),
            'wacc' => $this->wacc->toArray(),
            'dynamic_wacc' => $this->dynamicWacc?->toArray(),
            'annual_periods' => $periods,
        ];
    }
}
