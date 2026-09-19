<?php

declare(strict_types=1);

namespace App\Contexts\Finance\Domain\Services;

use App\Contexts\Finance\Domain\Model\FinancialRecord;
use App\Contexts\Finance\Domain\ValueObjects\CategoryType;
use App\Contexts\Finance\Domain\ValueObjects\Currency;
use App\Contexts\Finance\Domain\ValueObjects\DateRange;
use App\Contexts\Finance\Domain\ValueObjects\FinancialMetrics;
use App\Contexts\Finance\Domain\ValueObjects\Money;

final class FinancialCalculator
{
    /**
     * Calculate comprehensive financial metrics (P&L and Liquidity ratios) from a collection of records.
     *
     * @param array<FinancialRecord> $records
     */
    public function calculateMetrics(
        array $records,
        Currency $currency = Currency::PLN,
        ?DateRange $period = null
    ): FinancialMetrics {
        $revenue = Money::zero($currency);
        $cogs = Money::zero($currency);
        $opex = Money::zero($currency);
        $depreciation = Money::zero($currency);
        $financialCosts = Money::zero($currency);
        $tax = Money::zero($currency);

        $currentAssets = Money::zero($currency);
        $inventory = Money::zero($currency);
        $fixedAssets = Money::zero($currency);
        $currentLiabilities = Money::zero($currency);
        $longTermLiabilities = Money::zero($currency);

        foreach ($records as $record) {
            // If period filter is specified, skip out-of-period records
            if ($period !== null && !$period->contains($record->recordDate())) {
                continue;
            }

            $amount = $record->amount();
            $categoryType = $record->category()->type();

            // P&L classifications
            match ($categoryType) {
                CategoryType::REVENUE => $revenue = $revenue->add($amount),
                CategoryType::COGS => $cogs = $cogs->add($amount),
                CategoryType::OPEX => $opex = $opex->add($amount),
                CategoryType::DEPRECIATION => $depreciation = $depreciation->add($amount),
                CategoryType::FINANCIAL => $financialCosts = $financialCosts->add($amount),
                CategoryType::TAX => $tax = $tax->add($amount),
                default => null,
            };

            // Balance sheet classifications
            if ($record->isCurrentAsset()) {
                $currentAssets = $currentAssets->add($amount);
            }

            if ($categoryType === CategoryType::INVENTORY) {
                $inventory = $inventory->add($amount);
            }

            if ($record->isFixedAsset()) {
                $fixedAssets = $fixedAssets->add($amount);
            }

            if ($record->isCurrentLiability()) {
                $currentLiabilities = $currentLiabilities->add($amount);
            }

            if ($record->isLongTermLiability()) {
                $longTermLiabilities = $longTermLiabilities->add($amount);
            }
        }

        // P&L core computations
        $grossProfit = $revenue->subtract($cogs);
        $grossMargin = $this->calculateMargin($grossProfit, $revenue);

        // EBIT = Gross Profit - OPEX - Depreciation
        $ebit = $grossProfit->subtract($opex)->subtract($depreciation);
        $operatingMargin = $this->calculateMargin($ebit, $revenue);

        // EBITDA = EBIT + Depreciation
        $ebitda = $ebit->add($depreciation);
        $ebitdaMargin = $this->calculateMargin($ebitda, $revenue);

        // Net Profit = EBIT - Financial Costs - Tax
        $netProfit = $ebit->subtract($financialCosts)->subtract($tax);
        $netMargin = $this->calculateMargin($netProfit, $revenue);

        // Liquidity and Solvency computations delegating to FinancialRecord domain logic
        $quickAssets = $currentAssets->subtract($inventory);
        $totalAssets = $currentAssets->add($fixedAssets);
        $totalDebt = $currentLiabilities->add($longTermLiabilities);

        $currentRatio = FinancialRecord::calculateCurrentRatio($currentAssets, $currentLiabilities);
        $quickRatio = FinancialRecord::calculateQuickRatio($quickAssets, $currentLiabilities);
        $debtToAssets = FinancialRecord::calculateDebtToAssets($totalDebt, $totalAssets);

        return new FinancialMetrics(
            revenue: $revenue,
            cogs: $cogs,
            grossProfit: $grossProfit,
            grossMargin: $grossMargin,
            opex: $opex,
            depreciation: $depreciation,
            ebit: $ebit,
            operatingMargin: $operatingMargin,
            ebitda: $ebitda,
            ebitdaMargin: $ebitdaMargin,
            financialCosts: $financialCosts,
            tax: $tax,
            netProfit: $netProfit,
            netMargin: $netMargin,
            currentAssets: $currentAssets,
            inventory: $inventory,
            quickAssets: $quickAssets,
            currentLiabilities: $currentLiabilities,
            currentRatio: $currentRatio,
            quickRatio: $quickRatio,
            period: $period,
            totalAssets: $totalAssets,
            totalDebt: $totalDebt,
            debtToAssets: $debtToAssets
        );
    }

    /**
     * Calculate EBITDA: Earnings Before Interest, Taxes, Depreciation, and Amortization.
     * EBITDA = EBIT + Depreciation
     */
    public function calculateEbitda(Money $ebit, Money $depreciation): Money
    {
        return $ebit->add($depreciation);
    }

    /**
     * Calculate Operating Margin percentage: EBIT / Revenue.
     */
    public function calculateOperatingMargin(Money $ebit, Money $revenue): float
    {
        return $this->calculateMargin($ebit, $revenue);
    }

    /**
     * Calculate Current Ratio: Current Assets / Current Liabilities.
     */
    public function calculateCurrentRatio(Money $currentAssets, Money $currentLiabilities): ?float
    {
        return FinancialRecord::calculateCurrentRatio($currentAssets, $currentLiabilities);
    }

    /**
     * Calculate Quick Ratio: (Current Assets - Inventory) / Current Liabilities.
     */
    public function calculateQuickRatio(Money $quickAssets, Money $currentLiabilities): ?float
    {
        return FinancialRecord::calculateQuickRatio($quickAssets, $currentLiabilities);
    }

    /**
     * Calculate Debt-to-Assets Ratio: Total Debt / Total Assets.
     */
    public function calculateDebtToAssets(Money $totalDebt, Money $totalAssets): ?float
    {
        return FinancialRecord::calculateDebtToAssets($totalDebt, $totalAssets);
    }

    private function calculateMargin(Money $numerator, Money $denominator): float
    {
        if ($denominator->isZero() || $denominator->isNegative()) {
            return 0.0;
        }

        $result = bcdiv($numerator->amount(), $denominator->amount(), 6);

        return (float) $result;
    }
}
