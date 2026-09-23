<?php

declare(strict_types=1);

namespace App\Contexts\InvestmentProject\Domain\ValueObjects;

use App\Contexts\Finance\Domain\ValueObjects\Currency;
use App\Contexts\Finance\Domain\ValueObjects\Money;
use App\Shared\Domain\ValueObject;
use InvalidArgumentException;

final class OperatingAssumptions implements ValueObject
{
    /** @var array<int, float> */
    private array $capacityRampUp;

    /**
     * @param  array<int, float>  $capacityRampUp  Operating Year (1-based) => capacity utilization % (e.g. [1 => 60.0, 2 => 85.0, 3 => 100.0])
     */
    public function __construct(
        private readonly Money $annualRevenueBase,
        private readonly float $revenueGrowthRatePercent = 2.5,
        private readonly float $variableCostPercent = 40.0,
        private readonly Money $annualFixedCostsBase = new Money('0.0000', Currency::PLN),
        private readonly float $fixedCostGrowthRatePercent = 2.5,
        private readonly Money $annualPayrollBase = new Money('0.0000', Currency::PLN),
        private readonly float $payrollGrowthRatePercent = 3.0,
        array $capacityRampUp = [],
        private readonly float $citRatePercent = 19.0,
        private readonly bool $taxLossCarryForwardEnabled = true,
        private readonly float $taxLossOffsetCapPercent = 50.0,
        private readonly TaxLossSettlementMode $taxLossSettlementMode = TaxLossSettlementMode::STANDARD_LOSS_CAP,
        private readonly ?Money $taxLossOneOffCapAmount = null
    ) {
        if ($this->annualRevenueBase->isNegative()) {
            throw new InvalidArgumentException('Annual revenue base cannot be negative.');
        }

        if ($this->annualFixedCostsBase->isNegative()) {
            throw new InvalidArgumentException('Annual fixed costs base cannot be negative.');
        }

        if ($this->annualPayrollBase->isNegative()) {
            throw new InvalidArgumentException('Annual payroll base cannot be negative.');
        }

        if ($this->variableCostPercent < 0.0 || $this->variableCostPercent > 100.0) {
            throw new InvalidArgumentException(
                sprintf('Variable cost percentage must be between 0.0%% and 100.0%%, %.2f%% given.', $this->variableCostPercent)
            );
        }

        if ($this->citRatePercent < 0.0 || $this->citRatePercent > 100.0) {
            throw new InvalidArgumentException(
                sprintf('CIT rate must be between 0.0%% and 100.0%%, %.2f%% given.', $this->citRatePercent)
            );
        }

        if ($this->taxLossOffsetCapPercent < 0.0 || $this->taxLossOffsetCapPercent > 100.0) {
            throw new InvalidArgumentException(
                sprintf('Tax loss offset cap must be between 0.0%% and 100.0%%, %.2f%% given.', $this->taxLossOffsetCapPercent)
            );
        }

        if ($this->taxLossOneOffCapAmount !== null && $this->taxLossOneOffCapAmount->isNegative()) {
            throw new InvalidArgumentException('Tax loss one-off cap amount cannot be negative.');
        }

        $this->capacityRampUp = $capacityRampUp;
    }

    public static function createStandard(
        Money $annualRevenueBase,
        float $variableCostPercent = 40.0,
        ?Money $annualFixedCosts = null,
        ?Money $annualPayroll = null,
        array $capacityRampUp = [1 => 60.0, 2 => 85.0, 3 => 100.0],
        TaxLossSettlementMode $taxLossSettlementMode = TaxLossSettlementMode::STANDARD_LOSS_CAP,
        ?Money $taxLossOneOffCapAmount = null
    ): self {
        $currency = $annualRevenueBase->currency();

        return new self(
            annualRevenueBase: $annualRevenueBase,
            revenueGrowthRatePercent: 2.5,
            variableCostPercent: $variableCostPercent,
            annualFixedCostsBase: $annualFixedCosts ?? Money::zero($currency),
            fixedCostGrowthRatePercent: 2.5,
            annualPayrollBase: $annualPayroll ?? Money::zero($currency),
            payrollGrowthRatePercent: 3.0,
            capacityRampUp: $capacityRampUp,
            citRatePercent: 19.0,
            taxLossCarryForwardEnabled: true,
            taxLossOffsetCapPercent: 50.0,
            taxLossSettlementMode: $taxLossSettlementMode,
            taxLossOneOffCapAmount: $taxLossOneOffCapAmount
        );
    }

    public function annualRevenueBase(): Money
    {
        return $this->annualRevenueBase;
    }

    public function revenueGrowthRatePercent(): float
    {
        return $this->revenueGrowthRatePercent;
    }

    public function variableCostPercent(): float
    {
        return $this->variableCostPercent;
    }

    public function annualFixedCostsBase(): Money
    {
        return $this->annualFixedCostsBase;
    }

    public function fixedCostGrowthRatePercent(): float
    {
        return $this->fixedCostGrowthRatePercent;
    }

    public function annualPayrollBase(): Money
    {
        return $this->annualPayrollBase;
    }

    public function payrollGrowthRatePercent(): float
    {
        return $this->payrollGrowthRatePercent;
    }

    /**
     * @return array<int, float>
     */
    public function capacityRampUp(): array
    {
        return $this->capacityRampUp;
    }

    public function capacityUtilizationAtOperatingYear(int $operatingYear): float
    {
        if (isset($this->capacityRampUp[$operatingYear])) {
            return $this->capacityRampUp[$operatingYear];
        }

        if (empty($this->capacityRampUp)) {
            return 100.0;
        }

        $maxDefinedYear = max(array_keys($this->capacityRampUp));
        if ($operatingYear > $maxDefinedYear) {
            return $this->capacityRampUp[$maxDefinedYear];
        }

        return 100.0;
    }

    public function citRatePercent(): float
    {
        return $this->citRatePercent;
    }

    public function citRateDecimal(): float
    {
        return $this->citRatePercent / 100.0;
    }

    public function taxLossCarryForwardEnabled(): bool
    {
        return $this->taxLossCarryForwardEnabled;
    }

    public function taxLossOffsetCapPercent(): float
    {
        return $this->taxLossOffsetCapPercent;
    }

    public function taxLossSettlementMode(): TaxLossSettlementMode
    {
        return $this->taxLossSettlementMode;
    }

    public function taxLossOneOffCapAmount(): ?Money
    {
        return $this->taxLossOneOffCapAmount;
    }

    public function currency(): Currency
    {
        return $this->annualRevenueBase->currency();
    }

    /**
     * @param  self  $other
     */
    public function equals(ValueObject $other): bool
    {
        if (! $other instanceof self) {
            return false;
        }

        return $this->annualRevenueBase->equals($other->annualRevenueBase)
            && abs($this->revenueGrowthRatePercent - $other->revenueGrowthRatePercent) < 0.0001
            && abs($this->variableCostPercent - $other->variableCostPercent) < 0.0001
            && $this->annualFixedCostsBase->equals($other->annualFixedCostsBase)
            && $this->annualPayrollBase->equals($other->annualPayrollBase)
            && abs($this->citRatePercent - $other->citRatePercent) < 0.0001
            && $this->taxLossCarryForwardEnabled === $other->taxLossCarryForwardEnabled
            && $this->taxLossSettlementMode === $other->taxLossSettlementMode;
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public static function fromArray(array $data, ?Currency $fallbackCurrency = null): self
    {
        $currencyCode = $data['currency'] ?? ($fallbackCurrency ? $fallbackCurrency->value : 'PLN');
        $currency = Currency::tryFrom((string) $currencyCode) ?? Currency::PLN;

        $revenue = (string) ($data['annual_revenue_base'] ?? '0.0000');
        $fixedCosts = (string) ($data['annual_fixed_costs_base'] ?? '0.0000');
        $payroll = (string) ($data['annual_payroll_base'] ?? '0.0000');

        $rampUp = $data['capacity_ramp_up'] ?? [1 => 60.0, 2 => 85.0, 3 => 100.0];
        if (is_array($rampUp)) {
            $formattedRampUp = [];
            foreach ($rampUp as $year => $rate) {
                $formattedRampUp[(int) $year] = (float) $rate;
            }
            $rampUp = $formattedRampUp;
        } else {
            $rampUp = [];
        }

        $annualRevenueBase = Money::fromDecimal($revenue, $currency);
        $revenueGrowthRatePercent = (float) ($data['revenue_growth_rate_percent'] ?? 2.5);
        $variableCostPercent = (float) ($data['variable_cost_percent'] ?? 40.0);
        $annualFixedCostsBase = Money::fromDecimal($fixedCosts, $currency);
        $fixedCostGrowthRatePercent = (float) ($data['fixed_cost_growth_rate_percent'] ?? 2.5);
        $annualPayrollBase = Money::fromDecimal($payroll, $currency);
        $payrollGrowthRatePercent = (float) ($data['payroll_growth_rate_percent'] ?? 3.0);
        $citRatePercent = (float) ($data['cit_rate_percent'] ?? 19.0);
        $taxLossCarryForwardEnabled = (bool) ($data['tax_loss_carry_forward_enabled'] ?? true);
        $taxLossOffsetCapPercent = (float) ($data['tax_loss_offset_cap_percent'] ?? 50.0);
        $taxLossSettlementMode = TaxLossSettlementMode::fromOrDefault($data['tax_loss_settlement_mode'] ?? null);

        $taxLossOneOffCapAmount = null;
        if (isset($data['tax_loss_one_off_cap_amount']) && $data['tax_loss_one_off_cap_amount'] !== null && $data['tax_loss_one_off_cap_amount'] !== '') {
            $taxLossOneOffCapAmount = Money::fromDecimal((float) $data['tax_loss_one_off_cap_amount'], $currency);
        }

        return new self(
            $annualRevenueBase,
            $revenueGrowthRatePercent,
            $variableCostPercent,
            $annualFixedCostsBase,
            $fixedCostGrowthRatePercent,
            $annualPayrollBase,
            $payrollGrowthRatePercent,
            $rampUp,
            $citRatePercent,
            $taxLossCarryForwardEnabled,
            $taxLossOffsetCapPercent,
            $taxLossSettlementMode,
            $taxLossOneOffCapAmount
        );
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'annual_revenue_base' => $this->annualRevenueBase->amount(),
            'currency' => $this->currency()->value,
            'revenue_growth_rate_percent' => $this->revenueGrowthRatePercent,
            'variable_cost_percent' => $this->variableCostPercent,
            'annual_fixed_costs_base' => $this->annualFixedCostsBase->amount(),
            'fixed_cost_growth_rate_percent' => $this->fixedCostGrowthRatePercent,
            'annual_payroll_base' => $this->annualPayrollBase->amount(),
            'payroll_growth_rate_percent' => $this->payrollGrowthRatePercent,
            'capacity_ramp_up' => $this->capacityRampUp,
            'cit_rate_percent' => $this->citRatePercent,
            'tax_loss_carry_forward_enabled' => $this->taxLossCarryForwardEnabled,
            'tax_loss_offset_cap_percent' => $this->taxLossOffsetCapPercent,
            'tax_loss_settlement_mode' => $this->taxLossSettlementMode->value,
            'tax_loss_one_off_cap_amount' => $this->taxLossOneOffCapAmount?->amount(),
        ];
    }
}
