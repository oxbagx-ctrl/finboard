<?php

declare(strict_types=1);

namespace App\Contexts\Finance\Domain\ValueObjects;

enum BenchmarkMetricType: string
{
    case CURRENT_RATIO = 'CURRENT_RATIO';
    case QUICK_RATIO = 'QUICK_RATIO';
    case DEBT_TO_ASSETS = 'DEBT_TO_ASSETS';
    case GROSS_MARGIN = 'GROSS_MARGIN';
    case EBITDA_MARGIN = 'EBITDA_MARGIN';
    case OPERATING_MARGIN = 'OPERATING_MARGIN';
    case NET_MARGIN = 'NET_MARGIN';
    case REVENUE_GROWTH = 'REVENUE_GROWTH';

    /**
     * Whether higher values are desirable for this metric.
     * True for liquidity, margins, growth. False for debt ratios.
     */
    public function higherIsBetter(): bool
    {
        return match ($this) {
            self::DEBT_TO_ASSETS => false,
            default => true,
        };
    }

    public function defaultTarget(): float
    {
        return match ($this) {
            self::CURRENT_RATIO => 1.5,
            self::QUICK_RATIO => 1.0,
            self::DEBT_TO_ASSETS => 0.50,
            self::GROSS_MARGIN => 0.35,
            self::EBITDA_MARGIN => 0.18,
            self::OPERATING_MARGIN => 0.12,
            self::NET_MARGIN => 0.08,
            self::REVENUE_GROWTH => 10.0,
        };
    }

    public function defaultWarning(): float
    {
        return match ($this) {
            self::CURRENT_RATIO => 1.2,
            self::QUICK_RATIO => 0.8,
            self::DEBT_TO_ASSETS => 0.65,
            self::GROSS_MARGIN => 0.25,
            self::EBITDA_MARGIN => 0.10,
            self::OPERATING_MARGIN => 0.05,
            self::NET_MARGIN => 0.03,
            self::REVENUE_GROWTH => 0.0,
        };
    }

    public function defaultCritical(): float
    {
        return match ($this) {
            self::CURRENT_RATIO => 1.0,
            self::QUICK_RATIO => 0.6,
            self::DEBT_TO_ASSETS => 0.80,
            self::GROSS_MARGIN => 0.15,
            self::EBITDA_MARGIN => 0.05,
            self::OPERATING_MARGIN => 0.0,
            self::NET_MARGIN => 0.0,
            self::REVENUE_GROWTH => -10.0,
        };
    }

    public function label(): string
    {
        return match ($this) {
            self::CURRENT_RATIO => 'Wskaźnik płynności bieżącej (Current Ratio)',
            self::QUICK_RATIO => 'Wskaźnik płynności szybkiej (Quick Ratio)',
            self::DEBT_TO_ASSETS => 'Wskaźnik ogólnego zadłużenia (Debt to Assets)',
            self::GROSS_MARGIN => 'Marża brutto na sprzedaży (Gross Margin)',
            self::EBITDA_MARGIN => 'Marża EBITDA (EBITDA Margin)',
            self::OPERATING_MARGIN => 'Marża operacyjna (EBIT Margin)',
            self::NET_MARGIN => 'Marża zysku netto (Net Margin)',
            self::REVENUE_GROWTH => 'Dynamika przychodów r/r (YoY Revenue Growth)',
        };
    }

    public function unit(): string
    {
        return match ($this) {
            self::CURRENT_RATIO, self::QUICK_RATIO => 'x',
            self::DEBT_TO_ASSETS, self::GROSS_MARGIN, self::EBITDA_MARGIN, self::OPERATING_MARGIN, self::NET_MARGIN, self::REVENUE_GROWTH => '%',
        };
    }
}
