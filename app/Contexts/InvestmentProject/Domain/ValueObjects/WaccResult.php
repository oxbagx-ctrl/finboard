<?php

declare(strict_types=1);

namespace App\Contexts\InvestmentProject\Domain\ValueObjects;

use App\Contexts\Finance\Domain\ValueObjects\Money;
use App\Shared\Domain\ValueObject;
use InvalidArgumentException;

final class WaccResult implements ValueObject
{
    public function __construct(
        private readonly float $equityWeightPercent,
        private readonly float $debtWeightPercent,
        private readonly float $costOfEquityPercent,
        private readonly float $preTaxCostOfDebtPercent,
        private readonly float $afterTaxCostOfDebtPercent,
        private readonly float $nominalWaccPercent,
        private readonly float $realWaccPercent,
        private readonly float $taxShieldPercent,
        private readonly float $inflationRatePercent,
        private readonly ?Money $equityValue = null,
        private readonly ?Money $debtValue = null
    ) {
        if ($this->equityWeightPercent < 0.0 || $this->equityWeightPercent > 100.0001) {
            throw new InvalidArgumentException(
                sprintf('Equity weight must be between 0.0%% and 100.0%%, %.2f%% given.', $this->equityWeightPercent)
            );
        }

        if ($this->debtWeightPercent < 0.0 || $this->debtWeightPercent > 100.0001) {
            throw new InvalidArgumentException(
                sprintf('Debt weight must be between 0.0%% and 100.0%%, %.2f%% given.', $this->debtWeightPercent)
            );
        }
    }

    public function equityWeightPercent(): float
    {
        return $this->equityWeightPercent;
    }

    public function debtWeightPercent(): float
    {
        return $this->debtWeightPercent;
    }

    public function costOfEquityPercent(): float
    {
        return $this->costOfEquityPercent;
    }

    public function preTaxCostOfDebtPercent(): float
    {
        return $this->preTaxCostOfDebtPercent;
    }

    public function afterTaxCostOfDebtPercent(): float
    {
        return $this->afterTaxCostOfDebtPercent;
    }

    public function nominalWaccPercent(): float
    {
        return $this->nominalWaccPercent;
    }

    public function realWaccPercent(): float
    {
        return $this->realWaccPercent;
    }

    public function taxShieldPercent(): float
    {
        return $this->taxShieldPercent;
    }

    public function inflationRatePercent(): float
    {
        return $this->inflationRatePercent;
    }

    public function equityValue(): ?Money
    {
        return $this->equityValue;
    }

    public function debtValue(): ?Money
    {
        return $this->debtValue;
    }

    public function nominalWaccDecimal(): float
    {
        return $this->nominalWaccPercent / 100.0;
    }

    public function realWaccDecimal(): float
    {
        return $this->realWaccPercent / 100.0;
    }

    /**
     * Discount factor for year t: DF_t = 1 / (1 + WACC)^t
     */
    public function discountFactor(int $periodYears, bool $useReal = false): float
    {
        if ($periodYears < 0) {
            throw new InvalidArgumentException('Period years cannot be negative.');
        }

        $rateDecimal = $useReal ? $this->realWaccDecimal() : $this->nominalWaccDecimal();

        return round(1.0 / pow(1.0 + $rateDecimal, $periodYears), 6);
    }

    public function equals(ValueObject $other): bool
    {
        if (!$other instanceof self) {
            return false;
        }

        return abs($this->nominalWaccPercent - $other->nominalWaccPercent) < 0.0001
            && abs($this->realWaccPercent - $other->realWaccPercent) < 0.0001
            && abs($this->equityWeightPercent - $other->equityWeightPercent) < 0.0001
            && abs($this->debtWeightPercent - $other->debtWeightPercent) < 0.0001;
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'equity_weight_percent' => $this->equityWeightPercent,
            'debt_weight_percent' => $this->debtWeightPercent,
            'cost_of_equity_percent' => $this->costOfEquityPercent,
            'pre_tax_cost_of_debt_percent' => $this->preTaxCostOfDebtPercent,
            'after_tax_cost_of_debt_percent' => $this->afterTaxCostOfDebtPercent,
            'nominal_wacc_percent' => $this->nominalWaccPercent,
            'real_wacc_percent' => $this->realWaccPercent,
            'nominal_wacc_decimal' => $this->nominalWaccDecimal(),
            'real_wacc_decimal' => $this->realWaccDecimal(),
            'tax_shield_percent' => $this->taxShieldPercent,
            'inflation_rate_percent' => $this->inflationRatePercent,
            'equity_value' => $this->equityValue?->amount(),
            'debt_value' => $this->debtValue?->amount(),
        ];
    }
}
