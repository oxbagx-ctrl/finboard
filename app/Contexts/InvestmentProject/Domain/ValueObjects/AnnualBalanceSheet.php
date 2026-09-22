<?php

declare(strict_types=1);

namespace App\Contexts\InvestmentProject\Domain\ValueObjects;

use App\Contexts\Finance\Domain\ValueObjects\Currency;
use App\Contexts\Finance\Domain\ValueObjects\Money;
use App\Shared\Domain\ValueObject;
use InvalidArgumentException;

final class AnnualBalanceSheet implements ValueObject
{
    public function __construct(
        private readonly int $year,
        // Non-current Assets
        private readonly Money $netBookValue,
        private readonly Money $constructionInProgress,
        private readonly Money $totalFixedAssets,
        // Current Assets
        private readonly Money $tradeReceivables,
        private readonly Money $inventories,
        private readonly Money $vatReceivable,
        private readonly Money $cashAndEquivalents,
        private readonly Money $totalCurrentAssets,
        private readonly Money $totalAssets,
        // Equity
        private readonly Money $shareCapital,
        private readonly Money $retainedEarnings,
        private readonly Money $currentPeriodNetIncome,
        private readonly Money $totalEquity,
        // Liabilities & Deferred Items
        private readonly Money $longTermDebt,
        private readonly Money $shortTermDebt,
        private readonly Money $vatBridgeLoan,
        private readonly Money $tradePayables,
        private readonly Money $deferredGrantRevenue,
        private readonly Money $totalLiabilities,
        private readonly Money $totalEquityAndLiabilities,
        // Verification
        private readonly Money $variance,
        private readonly bool $isBalanced
    ) {
        if ($this->year < 1) {
            throw new InvalidArgumentException(
                sprintf('Year must be >= 1, %d given.', $this->year)
            );
        }
    }

    public function year(): int
    {
        return $this->year;
    }

    public function netBookValue(): Money
    {
        return $this->netBookValue;
    }

    public function constructionInProgress(): Money
    {
        return $this->constructionInProgress;
    }

    public function totalFixedAssets(): Money
    {
        return $this->totalFixedAssets;
    }

    public function tradeReceivables(): Money
    {
        return $this->tradeReceivables;
    }

    public function inventories(): Money
    {
        return $this->inventories;
    }

    public function vatReceivable(): Money
    {
        return $this->vatReceivable;
    }

    public function cashAndEquivalents(): Money
    {
        return $this->cashAndEquivalents;
    }

    public function totalCurrentAssets(): Money
    {
        return $this->totalCurrentAssets;
    }

    public function totalAssets(): Money
    {
        return $this->totalAssets;
    }

    public function shareCapital(): Money
    {
        return $this->shareCapital;
    }

    public function retainedEarnings(): Money
    {
        return $this->retainedEarnings;
    }

    public function currentPeriodNetIncome(): Money
    {
        return $this->currentPeriodNetIncome;
    }

    public function totalEquity(): Money
    {
        return $this->totalEquity;
    }

    public function longTermDebt(): Money
    {
        return $this->longTermDebt;
    }

    public function shortTermDebt(): Money
    {
        return $this->shortTermDebt;
    }

    public function vatBridgeLoan(): Money
    {
        return $this->vatBridgeLoan;
    }

    public function tradePayables(): Money
    {
        return $this->tradePayables;
    }

    public function deferredGrantRevenue(): Money
    {
        return $this->deferredGrantRevenue;
    }

    public function totalLiabilities(): Money
    {
        return $this->totalLiabilities;
    }

    public function totalEquityAndLiabilities(): Money
    {
        return $this->totalEquityAndLiabilities;
    }

    public function variance(): Money
    {
        return $this->variance;
    }

    public function isBalanced(): bool
    {
        return $this->isBalanced;
    }

    public function currency(): Currency
    {
        return $this->totalAssets->currency();
    }

    public function equals(ValueObject $other): bool
    {
        if (!$other instanceof self) {
            return false;
        }

        return $this->year === $other->year
            && $this->totalAssets->equals($other->totalAssets)
            && $this->totalEquityAndLiabilities->equals($other->totalEquityAndLiabilities)
            && $this->isBalanced === $other->isBalanced;
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'year' => $this->year,
            // Assets
            'net_book_value' => $this->netBookValue->amount(),
            'construction_in_progress' => $this->constructionInProgress->amount(),
            'total_fixed_assets' => $this->totalFixedAssets->amount(),
            'trade_receivables' => $this->tradeReceivables->amount(),
            'inventories' => $this->inventories->amount(),
            'vat_receivable' => $this->vatReceivable->amount(),
            'cash_and_equivalents' => $this->cashAndEquivalents->amount(),
            'total_current_assets' => $this->totalCurrentAssets->amount(),
            'total_assets' => $this->totalAssets->amount(),
            // Equity & Liabilities
            'share_capital' => $this->shareCapital->amount(),
            'retained_earnings' => $this->retainedEarnings->amount(),
            'current_period_net_income' => $this->currentPeriodNetIncome->amount(),
            'total_equity' => $this->totalEquity->amount(),
            'long_term_debt' => $this->longTermDebt->amount(),
            'short_term_debt' => $this->shortTermDebt->amount(),
            'vat_bridge_loan' => $this->vatBridgeLoan->amount(),
            'trade_payables' => $this->tradePayables->amount(),
            'deferred_grant_revenue' => $this->deferredGrantRevenue->amount(),
            'total_liabilities' => $this->totalLiabilities->amount(),
            'total_equity_and_liabilities' => $this->totalEquityAndLiabilities->amount(),
            // Verification
            'variance' => $this->variance->amount(),
            'is_balanced' => $this->isBalanced,
            'currency' => $this->currency()->value,
        ];
    }
}
