<?php

declare(strict_types=1);

namespace App\Contexts\Finance\Domain\ValueObjects;

use App\Shared\Domain\ValueObject;

final class FinancialMetrics implements ValueObject
{
    public function __construct(
        private readonly Money $revenue,
        private readonly Money $cogs,
        private readonly Money $grossProfit,
        private readonly float $grossMargin,
        private readonly Money $opex,
        private readonly Money $depreciation,
        private readonly Money $ebit,
        private readonly float $operatingMargin,
        private readonly Money $ebitda,
        private readonly float $ebitdaMargin,
        private readonly Money $financialCosts,
        private readonly Money $tax,
        private readonly Money $netProfit,
        private readonly float $netMargin,
        private readonly Money $currentAssets,
        private readonly Money $inventory,
        private readonly Money $quickAssets,
        private readonly Money $currentLiabilities,
        private readonly ?float $currentRatio,
        private readonly ?float $quickRatio,
        private readonly ?DateRange $period = null,
        private readonly ?Money $totalAssets = null,
        private readonly ?Money $totalDebt = null,
        private readonly ?float $debtToAssets = null
    ) {
    }

    public function revenue(): Money
    {
        return $this->revenue;
    }

    public function cogs(): Money
    {
        return $this->cogs;
    }

    public function grossProfit(): Money
    {
        return $this->grossProfit;
    }

    public function grossMargin(): float
    {
        return $this->grossMargin;
    }

    public function opex(): Money
    {
        return $this->opex;
    }

    public function depreciation(): Money
    {
        return $this->depreciation;
    }

    public function ebit(): Money
    {
        return $this->ebit;
    }

    public function operatingMargin(): float
    {
        return $this->operatingMargin;
    }

    public function ebitda(): Money
    {
        return $this->ebitda;
    }

    public function ebitdaMargin(): float
    {
        return $this->ebitdaMargin;
    }

    public function financialCosts(): Money
    {
        return $this->financialCosts;
    }

    public function tax(): Money
    {
        return $this->tax;
    }

    public function netProfit(): Money
    {
        return $this->netProfit;
    }

    public function netMargin(): float
    {
        return $this->netMargin;
    }

    public function currentAssets(): Money
    {
        return $this->currentAssets;
    }

    public function inventory(): Money
    {
        return $this->inventory;
    }

    public function quickAssets(): Money
    {
        return $this->quickAssets;
    }

    public function currentLiabilities(): Money
    {
        return $this->currentLiabilities;
    }

    public function currentRatio(): ?float
    {
        return $this->currentRatio;
    }

    public function quickRatio(): ?float
    {
        return $this->quickRatio;
    }

    public function totalAssets(): ?Money
    {
        return $this->totalAssets;
    }

    public function totalDebt(): ?Money
    {
        return $this->totalDebt;
    }

    public function debtToAssets(): ?float
    {
        return $this->debtToAssets;
    }

    public function period(): ?DateRange
    {
        return $this->period;
    }

    /**
     * Structure of liquidity ratios and balance components.
     *
     * @return array{
     *     current_ratio: ?float,
     *     quick_ratio: ?float,
     *     current_assets: array{amount: float, formatted: string},
     *     current_liabilities: array{amount: float, formatted: string},
     *     quick_assets: array{amount: float, formatted: string},
     *     inventory: array{amount: float, formatted: string}
     * }
     */
    public function liquidity(): array
    {
        return [
            'current_ratio' => $this->currentRatio !== null ? round($this->currentRatio, 2) : null,
            'quick_ratio' => $this->quickRatio !== null ? round($this->quickRatio, 2) : null,
            'current_assets' => [
                'amount' => $this->currentAssets->toDecimal(),
                'formatted' => $this->currentAssets->format(),
            ],
            'current_liabilities' => [
                'amount' => $this->currentLiabilities->toDecimal(),
                'formatted' => $this->currentLiabilities->format(),
            ],
            'quick_assets' => [
                'amount' => $this->quickAssets->toDecimal(),
                'formatted' => $this->quickAssets->format(),
            ],
            'inventory' => [
                'amount' => $this->inventory->toDecimal(),
                'formatted' => $this->inventory->format(),
            ],
        ];
    }

    /**
     * Structure of solvency and leverage metrics.
     *
     * @return array{
     *     debt_to_assets: ?float,
     *     total_assets: ?array{amount: float, formatted: string},
     *     total_debt: ?array{amount: float, formatted: string}
     * }
     */
    public function solvency(): array
    {
        return [
            'debt_to_assets' => $this->debtToAssets !== null ? round($this->debtToAssets, 4) : null,
            'total_assets' => $this->totalAssets ? [
                'amount' => $this->totalAssets->toDecimal(),
                'formatted' => $this->totalAssets->format(),
            ] : null,
            'total_debt' => $this->totalDebt ? [
                'amount' => $this->totalDebt->toDecimal(),
                'formatted' => $this->totalDebt->format(),
            ] : null,
        ];
    }

    /**
     * Unified ratios combining liquidity, solvency, and profitability margins.
     *
     * @return array<string, mixed>
     */
    public function ratios(): array
    {
        return [
            'current_ratio' => $this->currentRatio !== null ? round($this->currentRatio, 2) : null,
            'quick_ratio' => $this->quickRatio !== null ? round($this->quickRatio, 2) : null,
            'debt_to_assets' => $this->debtToAssets !== null ? round($this->debtToAssets, 4) : null,
            'gross_margin' => round($this->grossMargin, 4),
            'gross_margin_pct' => round($this->grossMargin * 100, 2),
            'operating_margin' => round($this->operatingMargin, 4),
            'operating_margin_pct' => round($this->operatingMargin * 100, 2),
            'ebitda_margin' => round($this->ebitdaMargin, 4),
            'ebitda_margin_pct' => round($this->ebitdaMargin * 100, 2),
            'net_margin' => round($this->netMargin, 4),
            'net_margin_pct' => round($this->netMargin * 100, 2),
        ];
    }

    public function equals(ValueObject $other): bool
    {
        if (!$other instanceof self) {
            return false;
        }

        return $this->revenue->equals($other->revenue)
            && $this->netProfit->equals($other->netProfit)
            && $this->ebitda->equals($other->ebitda)
            && $this->currentRatio === $other->currentRatio
            && $this->quickRatio === $other->quickRatio
            && $this->debtToAssets === $other->debtToAssets;
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'period' => $this->period ? [
                'start' => $this->period->startDate()->format('Y-m-d'),
                'end' => $this->period->endDate()->format('Y-m-d'),
                'label' => $this->period->toPeriodString(),
            ] : null,
            'pnl' => [
                'revenue' => [
                    'amount' => $this->revenue->toDecimal(),
                    'formatted' => $this->revenue->format(),
                ],
                'cogs' => [
                    'amount' => $this->cogs->toDecimal(),
                    'formatted' => $this->cogs->format(),
                ],
                'gross_profit' => [
                    'amount' => $this->grossProfit->toDecimal(),
                    'formatted' => $this->grossProfit->format(),
                ],
                'gross_margin_pct' => round($this->grossMargin * 100, 2),
                'opex' => [
                    'amount' => $this->opex->toDecimal(),
                    'formatted' => $this->opex->format(),
                ],
                'depreciation' => [
                    'amount' => $this->depreciation->toDecimal(),
                    'formatted' => $this->depreciation->format(),
                ],
                'ebit' => [
                    'amount' => $this->ebit->toDecimal(),
                    'formatted' => $this->ebit->format(),
                ],
                'operating_margin_pct' => round($this->operatingMargin * 100, 2),
                'ebitda' => [
                    'amount' => $this->ebitda->toDecimal(),
                    'formatted' => $this->ebitda->format(),
                ],
                'ebitda_margin_pct' => round($this->ebitdaMargin * 100, 2),
                'financial_costs' => [
                    'amount' => $this->financialCosts->toDecimal(),
                    'formatted' => $this->financialCosts->format(),
                ],
                'tax' => [
                    'amount' => $this->tax->toDecimal(),
                    'formatted' => $this->tax->format(),
                ],
                'net_profit' => [
                    'amount' => $this->netProfit->toDecimal(),
                    'formatted' => $this->netProfit->format(),
                ],
                'net_margin_pct' => round($this->netMargin * 100, 2),
            ],
            'balance_sheet' => [
                'current_assets' => [
                    'amount' => $this->currentAssets->toDecimal(),
                    'formatted' => $this->currentAssets->format(),
                ],
                'inventory' => [
                    'amount' => $this->inventory->toDecimal(),
                    'formatted' => $this->inventory->format(),
                ],
                'quick_assets' => [
                    'amount' => $this->quickAssets->toDecimal(),
                    'formatted' => $this->quickAssets->format(),
                ],
                'current_liabilities' => [
                    'amount' => $this->currentLiabilities->toDecimal(),
                    'formatted' => $this->currentLiabilities->format(),
                ],
                'total_assets' => $this->totalAssets ? [
                    'amount' => $this->totalAssets->toDecimal(),
                    'formatted' => $this->totalAssets->format(),
                ] : null,
                'total_debt' => $this->totalDebt ? [
                    'amount' => $this->totalDebt->toDecimal(),
                    'formatted' => $this->totalDebt->format(),
                ] : null,
            ],
            'ratios' => $this->ratios(),
            'liquidity' => $this->liquidity(),
            'solvency' => $this->solvency(),
        ];
    }
}
