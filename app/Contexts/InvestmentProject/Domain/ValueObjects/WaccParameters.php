<?php

declare(strict_types=1);

namespace App\Contexts\InvestmentProject\Domain\ValueObjects;

use App\Shared\Domain\ValueObject;
use InvalidArgumentException;

final class WaccParameters implements ValueObject
{
    public function __construct(
        private readonly float $riskFreeRatePercent,
        private readonly float $equityRiskPremiumPercent,
        private readonly float $beta,
        private readonly float $sizeRiskPremiumPercent = 0.0,
        private readonly ?float $preTaxCostOfDebtPercent = null,
        private readonly float $taxRatePercent = 19.0,
        private readonly float $inflationRatePercent = 2.50,
        private readonly ?float $unleveredBeta = null
    ) {
        if ($this->riskFreeRatePercent < 0.0 || $this->riskFreeRatePercent > 50.0) {
            throw new InvalidArgumentException(
                sprintf('Risk-free rate must be between 0.0%% and 50.0%%, %.2f%% given.', $this->riskFreeRatePercent)
            );
        }

        if ($this->equityRiskPremiumPercent < 0.0 || $this->equityRiskPremiumPercent > 30.0) {
            throw new InvalidArgumentException(
                sprintf('Equity risk premium must be between 0.0%% and 30.0%%, %.2f%% given.', $this->equityRiskPremiumPercent)
            );
        }

        if ($this->beta <= 0.0 || $this->beta > 5.0) {
            throw new InvalidArgumentException(
                sprintf('Equity beta must be positive and at most 5.0, %.2f given.', $this->beta)
            );
        }

        if ($this->sizeRiskPremiumPercent < 0.0 || $this->sizeRiskPremiumPercent > 20.0) {
            throw new InvalidArgumentException(
                sprintf('Size risk premium must be between 0.0%% and 20.0%%, %.2f%% given.', $this->sizeRiskPremiumPercent)
            );
        }

        if ($this->preTaxCostOfDebtPercent !== null && ($this->preTaxCostOfDebtPercent < 0.0 || $this->preTaxCostOfDebtPercent > 50.0)) {
            throw new InvalidArgumentException(
                sprintf('Pre-tax cost of debt must be between 0.0%% and 50.0%%, %.2f%% given.', $this->preTaxCostOfDebtPercent)
            );
        }

        if ($this->taxRatePercent < 0.0 || $this->taxRatePercent > 60.0) {
            throw new InvalidArgumentException(
                sprintf('Tax rate must be between 0.0%% and 60.0%%, %.2f%% given.', $this->taxRatePercent)
            );
        }

        if ($this->inflationRatePercent < -10.0 || $this->inflationRatePercent > 50.0) {
            throw new InvalidArgumentException(
                sprintf('Inflation rate must be between -10.0%% and 50.0%%, %.2f%% given.', $this->inflationRatePercent)
            );
        }

        if ($this->unleveredBeta !== null && ($this->unleveredBeta <= 0.0 || $this->unleveredBeta > 5.0)) {
            throw new InvalidArgumentException(
                sprintf('Unlevered beta must be positive and at most 5.0, %.2f given.', $this->unleveredBeta)
            );
        }
    }

    /**
     * Standard parameters calibrated for Polish corporate finance and 10Y Polish Treasury bonds.
     */
    public static function defaultForPoland(?float $preTaxCostOfDebt = null): self
    {
        return new self(
            riskFreeRatePercent: 5.25,      // Rentowność 10-letnich obligacji skarbowych RP
            equityRiskPremiumPercent: 5.50, // Premia za ryzyko rynku akcji (ERP dla Polski)
            beta: 1.00,                     // Rynkowa beta bazowa
            sizeRiskPremiumPercent: 1.50,   // Premia za wielkość / specyficzne ryzyko projektu
            preTaxCostOfDebtPercent: $preTaxCostOfDebt,
            taxRatePercent: 19.0,           // Stawka podatku CIT
            inflationRatePercent: 2.50,     // Cel inflacyjny NBP
            unleveredBeta: 0.80             // Domyślna nieoddźwignięta beta aktywów
        );
    }

    public function riskFreeRatePercent(): float
    {
        return $this->riskFreeRatePercent;
    }

    public function equityRiskPremiumPercent(): float
    {
        return $this->equityRiskPremiumPercent;
    }

    public function beta(): float
    {
        return $this->beta;
    }

    public function sizeRiskPremiumPercent(): float
    {
        return $this->sizeRiskPremiumPercent;
    }

    public function preTaxCostOfDebtPercent(): ?float
    {
        return $this->preTaxCostOfDebtPercent;
    }

    public function taxRatePercent(): float
    {
        return $this->taxRatePercent;
    }

    public function inflationRatePercent(): float
    {
        return $this->inflationRatePercent;
    }

    public function unleveredBeta(): ?float
    {
        return $this->unleveredBeta;
    }

    /**
     * CAPM Cost of Equity: Ke = Rf + Beta * ERP + SizePremium
     */
    public function costOfEquityPercent(): float
    {
        return round($this->riskFreeRatePercent + ($this->beta * $this->equityRiskPremiumPercent) + $this->sizeRiskPremiumPercent, 4);
    }

    /**
     * Tax shield multiplier: (1 - T)
     */
    public function taxShieldMultiplier(): float
    {
        return 1.0 - ($this->taxRatePercent / 100.0);
    }

    public function withPreTaxCostOfDebt(float $rate): self
    {
        return new self(
            riskFreeRatePercent: $this->riskFreeRatePercent,
            equityRiskPremiumPercent: $this->equityRiskPremiumPercent,
            beta: $this->beta,
            sizeRiskPremiumPercent: $this->sizeRiskPremiumPercent,
            preTaxCostOfDebtPercent: $rate,
            taxRatePercent: $this->taxRatePercent,
            inflationRatePercent: $this->inflationRatePercent,
            unleveredBeta: $this->unleveredBeta
        );
    }

    public function withBeta(float $beta): self
    {
        return new self(
            riskFreeRatePercent: $this->riskFreeRatePercent,
            equityRiskPremiumPercent: $this->equityRiskPremiumPercent,
            beta: $beta,
            sizeRiskPremiumPercent: $this->sizeRiskPremiumPercent,
            preTaxCostOfDebtPercent: $this->preTaxCostOfDebtPercent,
            taxRatePercent: $this->taxRatePercent,
            inflationRatePercent: $this->inflationRatePercent,
            unleveredBeta: $this->unleveredBeta
        );
    }

    public function equals(ValueObject $other): bool
    {
        if (!$other instanceof self) {
            return false;
        }

        return abs($this->riskFreeRatePercent - $other->riskFreeRatePercent) < 0.0001
            && abs($this->equityRiskPremiumPercent - $other->equityRiskPremiumPercent) < 0.0001
            && abs($this->beta - $other->beta) < 0.0001
            && abs($this->sizeRiskPremiumPercent - $other->sizeRiskPremiumPercent) < 0.0001
            && abs($this->taxRatePercent - $other->taxRatePercent) < 0.0001
            && abs($this->inflationRatePercent - $other->inflationRatePercent) < 0.0001;
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'risk_free_rate_percent' => $this->riskFreeRatePercent,
            'equity_risk_premium_percent' => $this->equityRiskPremiumPercent,
            'beta' => $this->beta,
            'size_risk_premium_percent' => $this->sizeRiskPremiumPercent,
            'cost_of_equity_percent' => $this->costOfEquityPercent(),
            'pre_tax_cost_of_debt_percent' => $this->preTaxCostOfDebtPercent,
            'tax_rate_percent' => $this->taxRatePercent,
            'tax_shield_multiplier' => $this->taxShieldMultiplier(),
            'inflation_rate_percent' => $this->inflationRatePercent,
            'unlevered_beta' => $this->unleveredBeta,
        ];
    }
}
