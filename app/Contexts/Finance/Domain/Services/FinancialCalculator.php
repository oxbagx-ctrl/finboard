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

        $multiplier = 1.0;
        if ($currency !== Currency::PLN) {
            $multiplier = \App\Models\ExchangeRate::getMultiplierFor($currency->value);
        }

        foreach ($records as $record) {
            // If period filter is specified, skip out-of-period records
            if ($period !== null && !$period->contains($record->recordDate())) {
                continue;
            }

            $amount = $record->amount();
            if ($amount->currency() !== $currency) {
                $convertedAmount = round($amount->toDecimal() * $multiplier, 4);
                $amount = new Money($convertedAmount, $currency);
            }

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

        // P&L core computations delegated to FinancialRecord domain logic
        $grossProfit = FinancialRecord::calculateGrossProfit($revenue, $cogs);
        $grossMargin = FinancialRecord::calculateGrossMargin($grossProfit, $revenue) ?? 0.0;

        $ebit = FinancialRecord::calculateEbit($grossProfit, $opex, $depreciation);
        $operatingMargin = FinancialRecord::calculateOperatingMargin($ebit, $revenue) ?? 0.0;

        $ebitda = FinancialRecord::calculateEbitda($ebit, $depreciation);
        $ebitdaMargin = FinancialRecord::calculateEbitdaMargin($ebitda, $revenue) ?? 0.0;

        $netProfit = FinancialRecord::calculateNetProfit($ebit, $financialCosts, $tax);
        $netMargin = FinancialRecord::calculateNetMargin($netProfit, $revenue) ?? 0.0;

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
     * Calculate Gross Profit: Revenue - COGS
     */
    public function calculateGrossProfit(Money $revenue, Money $cogs): Money
    {
        return FinancialRecord::calculateGrossProfit($revenue, $cogs);
    }

    /**
     * Calculate Gross Margin percentage: Gross Profit / Revenue.
     */
    public function calculateGrossMargin(Money $grossProfit, Money $revenue): float
    {
        return FinancialRecord::calculateGrossMargin($grossProfit, $revenue) ?? 0.0;
    }

    /**
     * Calculate EBIT (Operating Profit): Gross Profit - OPEX - Depreciation
     */
    public function calculateEbit(Money $grossProfit, Money $opex, Money $depreciation): Money
    {
        return FinancialRecord::calculateEbit($grossProfit, $opex, $depreciation);
    }

    /**
     * Calculate Operating Margin percentage: EBIT / Revenue.
     */
    public function calculateOperatingMargin(Money $ebit, Money $revenue): float
    {
        return FinancialRecord::calculateOperatingMargin($ebit, $revenue) ?? 0.0;
    }

    /**
     * Calculate EBIT Margin percentage (alias of Operating Margin): EBIT / Revenue.
     */
    public function calculateEbitMargin(Money $ebit, Money $revenue): float
    {
        return FinancialRecord::calculateEbitMargin($ebit, $revenue) ?? 0.0;
    }

    /**
     * Calculate EBITDA: Earnings Before Interest, Taxes, Depreciation, and Amortization.
     * EBITDA = EBIT + Depreciation
     */
    public function calculateEbitda(Money $ebit, Money $depreciation): Money
    {
        return FinancialRecord::calculateEbitda($ebit, $depreciation);
    }

    /**
     * Calculate EBITDA Margin percentage: EBITDA / Revenue.
     */
    public function calculateEbitdaMargin(Money $ebitda, Money $revenue): float
    {
        return FinancialRecord::calculateEbitdaMargin($ebitda, $revenue) ?? 0.0;
    }

    /**
     * Calculate Net Profit: EBIT - Financial Costs - Tax.
     */
    public function calculateNetProfit(Money $ebit, Money $financialCosts, Money $tax): Money
    {
        return FinancialRecord::calculateNetProfit($ebit, $financialCosts, $tax);
    }

    /**
     * Calculate Net Margin percentage: Net Profit / Revenue.
     */
    public function calculateNetMargin(Money $netProfit, Money $revenue): float
    {
        return FinancialRecord::calculateNetMargin($netProfit, $revenue) ?? 0.0;
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
}
