<?php

declare(strict_types=1);

namespace App\Contexts\InvestmentProject\Domain\Services;

use App\Contexts\Finance\Domain\ValueObjects\Money;
use App\Contexts\InvestmentProject\Domain\Model\InvestmentProject;
use App\Contexts\InvestmentProject\Domain\ValueObjects\BalanceSheet;
use App\Contexts\InvestmentProject\Domain\ValueObjects\DynamicWaccSchedule;
use App\Contexts\InvestmentProject\Domain\ValueObjects\WaccParameters;
use App\Contexts\InvestmentProject\Domain\ValueObjects\WaccResult;
use InvalidArgumentException;

final class WaccCalculatorService
{
    public function __construct() {}

    /**
     * Factory helper to instantiate standard Polish WACC parameters with customizable debt cost and CIT rate.
     */
    public static function defaultForPoland(?float $preTaxCostOfDebt = null, ?float $taxRatePercent = null): WaccParameters
    {
        return WaccParameters::defaultForPoland($preTaxCostOfDebt, $taxRatePercent);
    }

    /**
     * Calculate static Weighted Average Cost of Capital (WACC) for a given capital structure.
     */
    public function calculateStaticWacc(
        WaccParameters $params,
        Money $equity,
        Money $debt
    ): WaccResult {
        if ($equity->currency() !== $debt->currency()) {
            throw new InvalidArgumentException(
                sprintf(
                    'Equity currency %s does not match debt currency %s.',
                    $equity->currency()->value,
                    $debt->currency()->value
                )
            );
        }

        if ($equity->isNegative()) {
            throw new InvalidArgumentException('Equity amount cannot be negative for WACC weighting.');
        }

        if ($debt->isNegative()) {
            throw new InvalidArgumentException('Debt amount cannot be negative for WACC weighting.');
        }

        $currency = $equity->currency();
        $totalCapital = $equity->add($debt);
        $totalCapitalFloat = (float) $totalCapital->amount();

        if ($totalCapitalFloat <= 0.0) {
            // Default to 100% equity if total capital is zero
            $equityWeight = 100.0;
            $debtWeight = 0.0;
        } else {
            $equityWeight = round(((float) $equity->amount() / $totalCapitalFloat) * 100.0, 4);
            $debtWeight = round(((float) $debt->amount() / $totalCapitalFloat) * 100.0, 4);
        }

        $ke = $params->costOfEquityPercent();
        $kdPreTax = $params->preTaxCostOfDebtPercent() ?? 0.0;
        $taxShield = $params->taxShieldMultiplier();
        $kdAfterTax = round($kdPreTax * $taxShield, 4);

        // Nominal WACC = (we * Ke) + (wd * Kd * (1 - T))
        $nominalWacc = round((($equityWeight / 100.0) * $ke) + (($debtWeight / 100.0) * $kdAfterTax), 4);

        // Real WACC via Fisher Equation: (1 + WACC_nom) = (1 + WACC_real) * (1 + inflation)
        // WACC_real = ((1 + WACC_nom) / (1 + inflation)) - 1
        $inflationDecimal = $params->inflationRatePercent() / 100.0;
        $nominalWaccDecimal = $nominalWacc / 100.0;

        $realWaccDecimal = ((1.0 + $nominalWaccDecimal) / (1.0 + $inflationDecimal)) - 1.0;
        $realWacc = round($realWaccDecimal * 100.0, 4);

        return new WaccResult(
            equityWeightPercent: $equityWeight,
            debtWeightPercent: $debtWeight,
            costOfEquityPercent: $ke,
            preTaxCostOfDebtPercent: $kdPreTax,
            afterTaxCostOfDebtPercent: $kdAfterTax,
            nominalWaccPercent: $nominalWacc,
            realWaccPercent: $realWacc,
            taxShieldPercent: $params->taxRatePercent(),
            inflationRatePercent: $params->inflationRatePercent(),
            equityValue: $equity,
            debtValue: $debt
        );
    }

    /**
     * Calculate static WACC directly from an InvestmentProject aggregate.
     */
    public function calculateFromProject(
        InvestmentProject $project,
        ?WaccParameters $customParams = null
    ): WaccResult {
        $equity = $project->financingStructure()->totalEquity();
        $debt = $project->debtFacility()->committedAmount();
        $preTaxCostOfDebt = $project->debtFacility()->nominalAnnualRate();

        $params = $customParams ?? WaccParameters::defaultForPoland($preTaxCostOfDebt);

        if ($params->preTaxCostOfDebtPercent() === null) {
            $params = $params->withPreTaxCostOfDebt($preTaxCostOfDebt);
        }

        return $this->calculateStaticWacc($params, $equity, $debt);
    }

    /**
     * Calculate dynamic multi-year WACC trajectory across the 15-year horizon based on Balance Sheet roll-forward.
     */
    public function calculateDynamicSchedule(
        InvestmentProject $project,
        BalanceSheet $balanceSheet,
        ?WaccParameters $customParams = null,
        bool $releverBeta = false
    ): DynamicWaccSchedule {
        $preTaxCostOfDebt = $project->debtFacility()->nominalAnnualRate();
        $baseParams = $customParams ?? WaccParameters::defaultForPoland($preTaxCostOfDebt);

        if ($baseParams->preTaxCostOfDebtPercent() === null) {
            $baseParams = $baseParams->withPreTaxCostOfDebt($preTaxCostOfDebt);
        }

        $unleveredBeta = $baseParams->unleveredBeta() ?? $baseParams->beta();
        $taxRate = $baseParams->taxRatePercent();
        $currency = $balanceSheet->currency();

        $annualWacc = [];
        $horizonYears = $balanceSheet->horizonYears();

        for ($year = 1; $year <= $horizonYears; $year++) {
            $annualStatement = $balanceSheet->annualStatement($year);
            if ($annualStatement === null) {
                continue;
            }

            // Equity is the total book equity from Balance Sheet (floored at zero)
            $equity = $annualStatement->totalEquity()->isNegative()
                ? Money::zero($currency)
                : $annualStatement->totalEquity();

            // Total Senior Debt is the sum of short-term and long-term bank debt
            $debt = $annualStatement->shortTermDebt()->add($annualStatement->longTermDebt());

            $currentParams = $baseParams;

            if ($releverBeta && $equity->isPositive()) {
                $debtEquityRatio = (float) $debt->amount() / (float) $equity->amount();
                $leveredBeta = $this->releverBeta($unleveredBeta, $debtEquityRatio, $taxRate);
                $currentParams = $baseParams->withBeta($leveredBeta);
            }

            $annualWacc[$year] = $this->calculateStaticWacc($currentParams, $equity, $debt);
        }

        return new DynamicWaccSchedule($annualWacc);
    }

    /**
     * Re-lever beta using Hamada's equation:
     * Beta_L = Beta_U * [ 1 + (1 - T) * (D / E) ]
     */
    public function releverBeta(
        float $unleveredBeta,
        float $debtEquityRatio,
        float $taxRatePercent
    ): float {
        if ($unleveredBeta <= 0.0) {
            throw new InvalidArgumentException('Unlevered beta must be positive.');
        }

        if ($debtEquityRatio < 0.0) {
            throw new InvalidArgumentException('Debt/Equity ratio cannot be negative.');
        }

        $taxDecimal = $taxRatePercent / 100.0;
        $levered = $unleveredBeta * (1.0 + ((1.0 - $taxDecimal) * $debtEquityRatio));

        return round($levered, 4);
    }

    /**
     * Un-lever beta using Hamada's equation:
     * Beta_U = Beta_L / [ 1 + (1 - T) * (D / E) ]
     */
    public function unleverBeta(
        float $leveredBeta,
        float $debtEquityRatio,
        float $taxRatePercent
    ): float {
        if ($leveredBeta <= 0.0) {
            throw new InvalidArgumentException('Levered beta must be positive.');
        }

        if ($debtEquityRatio < 0.0) {
            throw new InvalidArgumentException('Debt/Equity ratio cannot be negative.');
        }

        $taxDecimal = $taxRatePercent / 100.0;
        $unlevered = $leveredBeta / (1.0 + ((1.0 - $taxDecimal) * $debtEquityRatio));

        return round($unlevered, 4);
    }
}
