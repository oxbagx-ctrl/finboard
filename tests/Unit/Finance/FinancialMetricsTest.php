<?php

declare(strict_types=1);

namespace Tests\Unit\Finance;

use App\Contexts\Finance\Domain\ValueObjects\Currency;
use App\Contexts\Finance\Domain\ValueObjects\DateRange;
use App\Contexts\Finance\Domain\ValueObjects\FinancialMetrics;
use App\Contexts\Finance\Domain\ValueObjects\Money;
use PHPUnit\Framework\TestCase;

final class FinancialMetricsTest extends TestCase
{
    private Currency $currency;

    protected function setUp(): void
    {
        parent::setUp();
        $this->currency = Currency::PLN;
    }

    public function test_full_metrics_serialization_and_unified_structures(): void
    {
        $period = DateRange::forMonth(2026, 6);

        $metrics = new FinancialMetrics(
            revenue: Money::fromDecimal('1000000.0000', $this->currency),
            cogs: Money::fromDecimal('400000.0000', $this->currency),
            grossProfit: Money::fromDecimal('600000.0000', $this->currency),
            grossMargin: 0.60,
            opex: Money::fromDecimal('200000.0000', $this->currency),
            depreciation: Money::fromDecimal('50000.0000', $this->currency),
            ebit: Money::fromDecimal('350000.0000', $this->currency),
            operatingMargin: 0.35,
            ebitda: Money::fromDecimal('400000.0000', $this->currency),
            ebitdaMargin: 0.40,
            financialCosts: Money::fromDecimal('20000.0000', $this->currency),
            tax: Money::fromDecimal('60000.0000', $this->currency),
            netProfit: Money::fromDecimal('270000.0000', $this->currency),
            netMargin: 0.27,
            currentAssets: Money::fromDecimal('500000.0000', $this->currency),
            inventory: Money::fromDecimal('100000.0000', $this->currency),
            quickAssets: Money::fromDecimal('400000.0000', $this->currency),
            currentLiabilities: Money::fromDecimal('250000.0000', $this->currency),
            currentRatio: 2.0,
            quickRatio: 1.6,
            period: $period,
            totalAssets: Money::fromDecimal('1200000.0000', $this->currency),
            totalDebt: Money::fromDecimal('450000.0000', $this->currency),
            debtToAssets: 0.375
        );

        // Verify dedicated liquidity structure
        $liquidity = $metrics->liquidity();
        $this->assertSame(2.0, $liquidity['current_ratio']);
        $this->assertSame(1.6, $liquidity['quick_ratio']);
        $this->assertSame(500000.0, $liquidity['current_assets']['amount']);
        $this->assertSame('500 000,00 PLN', $liquidity['current_assets']['formatted']);
        $this->assertSame(250000.0, $liquidity['current_liabilities']['amount']);
        $this->assertSame(400000.0, $liquidity['quick_assets']['amount']);
        $this->assertSame(100000.0, $liquidity['inventory']['amount']);

        // Verify dedicated solvency structure
        $solvency = $metrics->solvency();
        $this->assertSame(0.375, $solvency['debt_to_assets']);
        $this->assertNotNull($solvency['total_assets']);
        $this->assertSame(1200000.0, $solvency['total_assets']['amount']);
        $this->assertNotNull($solvency['total_debt']);
        $this->assertSame(450000.0, $solvency['total_debt']['amount']);

        // Verify unified ratios structure
        $ratios = $metrics->ratios();
        $this->assertSame(2.0, $ratios['current_ratio']);
        $this->assertSame(1.6, $ratios['quick_ratio']);
        $this->assertSame(0.375, $ratios['debt_to_assets']);
        $this->assertSame(0.60, $ratios['gross_margin']);
        $this->assertSame(60.0, $ratios['gross_margin_pct']);
        $this->assertSame(0.35, $ratios['operating_margin']);
        $this->assertSame(35.0, $ratios['operating_margin_pct']);
        $this->assertSame(0.40, $ratios['ebitda_margin']);
        $this->assertSame(40.0, $ratios['ebitda_margin_pct']);
        $this->assertSame(0.27, $ratios['net_margin']);
        $this->assertSame(27.0, $ratios['net_margin_pct']);

        // Verify toArray() contains all top-level keys
        $array = $metrics->toArray();
        $this->assertArrayHasKey('pnl', $array);
        $this->assertArrayHasKey('balance_sheet', $array);
        $this->assertArrayHasKey('ratios', $array);
        $this->assertArrayHasKey('liquidity', $array);
        $this->assertArrayHasKey('solvency', $array);
        $this->assertArrayHasKey('period', $array);

        $this->assertSame($liquidity, $array['liquidity']);
        $this->assertSame($solvency, $array['solvency']);
        $this->assertSame($ratios, $array['ratios']);
        $this->assertSame('2026-06-01', $array['period']['start']);
        $this->assertSame('2026-06-30', $array['period']['end']);
    }

    public function test_edge_case_null_and_zero_balance_sheet_serialization(): void
    {
        // Case: company with P&L records only (no balance sheet or zero balance entries)
        $metrics = new FinancialMetrics(
            revenue: Money::fromDecimal('500000.0000', $this->currency),
            cogs: Money::fromDecimal('200000.0000', $this->currency),
            grossProfit: Money::fromDecimal('300000.0000', $this->currency),
            grossMargin: 0.60,
            opex: Money::fromDecimal('100000.0000', $this->currency),
            depreciation: Money::zero($this->currency),
            ebit: Money::fromDecimal('200000.0000', $this->currency),
            operatingMargin: 0.40,
            ebitda: Money::fromDecimal('200000.0000', $this->currency),
            ebitdaMargin: 0.40,
            financialCosts: Money::zero($this->currency),
            tax: Money::fromDecimal('38000.0000', $this->currency),
            netProfit: Money::fromDecimal('162000.0000', $this->currency),
            netMargin: 0.324,
            currentAssets: Money::zero($this->currency),
            inventory: Money::zero($this->currency),
            quickAssets: Money::zero($this->currency),
            currentLiabilities: Money::zero($this->currency),
            currentRatio: null,
            quickRatio: null,
            period: null,
            totalAssets: null,
            totalDebt: null,
            debtToAssets: null
        );

        $liquidity = $metrics->liquidity();
        $this->assertNull($liquidity['current_ratio']);
        $this->assertNull($liquidity['quick_ratio']);
        $this->assertSame(0.0, $liquidity['current_assets']['amount']);
        $this->assertSame(0.0, $liquidity['current_liabilities']['amount']);

        $solvency = $metrics->solvency();
        $this->assertNull($solvency['debt_to_assets']);
        $this->assertNull($solvency['total_assets']);
        $this->assertNull($solvency['total_debt']);

        $ratios = $metrics->ratios();
        $this->assertNull($ratios['current_ratio']);
        $this->assertNull($ratios['quick_ratio']);
        $this->assertNull($ratios['debt_to_assets']);
        $this->assertSame(60.0, $ratios['gross_margin_pct']);
        $this->assertSame(40.0, $ratios['ebitda_margin_pct']);

        $array = $metrics->toArray();
        $this->assertNull($array['ratios']['current_ratio']);
        $this->assertNull($array['ratios']['quick_ratio']);
        $this->assertNull($array['ratios']['debt_to_assets']);
        $this->assertNull($array['liquidity']['current_ratio']);
        $this->assertNull($array['liquidity']['quick_ratio']);
        $this->assertNull($array['solvency']['debt_to_assets']);
        $this->assertNull($array['solvency']['total_assets']);
        $this->assertNull($array['period']);
    }

    public function test_edge_case_zero_revenue_margins(): void
    {
        $metrics = new FinancialMetrics(
            revenue: Money::zero($this->currency),
            cogs: Money::zero($this->currency),
            grossProfit: Money::zero($this->currency),
            grossMargin: 0.0,
            opex: Money::fromDecimal('50000.0000', $this->currency),
            depreciation: Money::zero($this->currency),
            ebit: Money::fromDecimal('-50000.0000', $this->currency),
            operatingMargin: 0.0,
            ebitda: Money::fromDecimal('-50000.0000', $this->currency),
            ebitdaMargin: 0.0,
            financialCosts: Money::zero($this->currency),
            tax: Money::zero($this->currency),
            netProfit: Money::fromDecimal('-50000.0000', $this->currency),
            netMargin: 0.0,
            currentAssets: Money::fromDecimal('100000.0000', $this->currency),
            inventory: Money::zero($this->currency),
            quickAssets: Money::fromDecimal('100000.0000', $this->currency),
            currentLiabilities: Money::fromDecimal('50000.0000', $this->currency),
            currentRatio: 2.0,
            quickRatio: 2.0,
            period: null,
            totalAssets: Money::fromDecimal('100000.0000', $this->currency),
            totalDebt: Money::fromDecimal('50000.0000', $this->currency),
            debtToAssets: 0.5
        );

        $ratios = $metrics->ratios();
        $this->assertSame(0.0, $ratios['gross_margin']);
        $this->assertSame(0.0, $ratios['gross_margin_pct']);
        $this->assertSame(0.0, $ratios['ebitda_margin']);
        $this->assertSame(0.0, $ratios['ebitda_margin_pct']);
        $this->assertSame(2.0, $ratios['current_ratio']);
        $this->assertSame(0.5, $ratios['debt_to_assets']);
    }

    public function test_metrics_value_object_equality(): void
    {
        $m1 = new FinancialMetrics(
            revenue: Money::fromDecimal('100000.0000', $this->currency),
            cogs: Money::fromDecimal('50000.0000', $this->currency),
            grossProfit: Money::fromDecimal('50000.0000', $this->currency),
            grossMargin: 0.50,
            opex: Money::fromDecimal('20000.0000', $this->currency),
            depreciation: Money::zero($this->currency),
            ebit: Money::fromDecimal('30000.0000', $this->currency),
            operatingMargin: 0.30,
            ebitda: Money::fromDecimal('30000.0000', $this->currency),
            ebitdaMargin: 0.30,
            financialCosts: Money::zero($this->currency),
            tax: Money::zero($this->currency),
            netProfit: Money::fromDecimal('30000.0000', $this->currency),
            netMargin: 0.30,
            currentAssets: Money::fromDecimal('60000.0000', $this->currency),
            inventory: Money::zero($this->currency),
            quickAssets: Money::fromDecimal('60000.0000', $this->currency),
            currentLiabilities: Money::fromDecimal('30000.0000', $this->currency),
            currentRatio: 2.0,
            quickRatio: 2.0
        );

        $m2 = new FinancialMetrics(
            revenue: Money::fromDecimal('100000.0000', $this->currency),
            cogs: Money::fromDecimal('50000.0000', $this->currency),
            grossProfit: Money::fromDecimal('50000.0000', $this->currency),
            grossMargin: 0.50,
            opex: Money::fromDecimal('20000.0000', $this->currency),
            depreciation: Money::zero($this->currency),
            ebit: Money::fromDecimal('30000.0000', $this->currency),
            operatingMargin: 0.30,
            ebitda: Money::fromDecimal('30000.0000', $this->currency),
            ebitdaMargin: 0.30,
            financialCosts: Money::zero($this->currency),
            tax: Money::zero($this->currency),
            netProfit: Money::fromDecimal('30000.0000', $this->currency),
            netMargin: 0.30,
            currentAssets: Money::fromDecimal('60000.0000', $this->currency),
            inventory: Money::zero($this->currency),
            quickAssets: Money::fromDecimal('60000.0000', $this->currency),
            currentLiabilities: Money::fromDecimal('30000.0000', $this->currency),
            currentRatio: 2.0,
            quickRatio: 2.0
        );

        $this->assertTrue($m1->equals($m2));

        $m3 = new FinancialMetrics(
            revenue: Money::fromDecimal('200000.0000', $this->currency),
            cogs: Money::fromDecimal('50000.0000', $this->currency),
            grossProfit: Money::fromDecimal('150000.0000', $this->currency),
            grossMargin: 0.75,
            opex: Money::fromDecimal('20000.0000', $this->currency),
            depreciation: Money::zero($this->currency),
            ebit: Money::fromDecimal('130000.0000', $this->currency),
            operatingMargin: 0.65,
            ebitda: Money::fromDecimal('130000.0000', $this->currency),
            ebitdaMargin: 0.65,
            financialCosts: Money::zero($this->currency),
            tax: Money::zero($this->currency),
            netProfit: Money::fromDecimal('130000.0000', $this->currency),
            netMargin: 0.65,
            currentAssets: Money::fromDecimal('60000.0000', $this->currency),
            inventory: Money::zero($this->currency),
            quickAssets: Money::fromDecimal('60000.0000', $this->currency),
            currentLiabilities: Money::fromDecimal('30000.0000', $this->currency),
            currentRatio: 2.0,
            quickRatio: 2.0
        );

        $this->assertFalse($m1->equals($m3));
    }
}
