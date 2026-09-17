<?php

declare(strict_types=1);

namespace Tests\Unit\Finance;

use App\Contexts\Finance\Domain\Entities\Category;
use App\Contexts\Finance\Domain\Model\FinancialRecord;
use App\Contexts\Finance\Domain\Services\FinancialCalculator;
use App\Contexts\Finance\Domain\ValueObjects\Currency;
use App\Contexts\Finance\Domain\ValueObjects\DateRange;
use App\Contexts\Finance\Domain\ValueObjects\FinancialRecordId;
use App\Contexts\Finance\Domain\ValueObjects\Money;
use DateTimeImmutable;
use PHPUnit\Framework\TestCase;

final class FinancialCalculatorTest extends TestCase
{
    private const COMPANY_ID = '22222222-2222-2222-2222-222222222222';
    private FinancialCalculator $calculator;

    protected function setUp(): void
    {
        parent::setUp();
        $this->calculator = new FinancialCalculator();
    }

    public function test_comprehensive_financial_metrics_calculation(): void
    {
        $records = [
            // P&L records
            $this->createRecord(Category::revenue(), '500000.0000'),
            $this->createRecord(Category::cogs(), '200000.0000'),
            $this->createRecord(Category::opex(), '100000.0000'),
            $this->createRecord(Category::depreciation(), '30000.0000'),
            $this->createRecord(Category::financialCost(), '10000.0000'),
            $this->createRecord(Category::tax(), '30000.0000'),

            // Balance sheet records
            $this->createRecord(Category::cash(), '50000.0000'),
            $this->createRecord(Category::receivables(), '100000.0000'),
            $this->createRecord(Category::inventory(), '50000.0000'),
            $this->createRecord(Category::currentLiabilities(), '100000.0000'),
        ];

        $period = DateRange::forQuarter(2026, 1);
        $metrics = $this->calculator->calculateMetrics($records, Currency::PLN, $period);

        // P&L Assertions
        $this->assertSame('500000.0000', $metrics->revenue()->amount());
        $this->assertSame('200000.0000', $metrics->cogs()->amount());
        $this->assertSame('300000.0000', $metrics->grossProfit()->amount());
        $this->assertSame(0.60, round($metrics->grossMargin(), 2));

        $this->assertSame('100000.0000', $metrics->opex()->amount());
        $this->assertSame('30000.0000', $metrics->depreciation()->amount());
        $this->assertSame('170000.0000', $metrics->ebit()->amount());
        $this->assertSame(0.34, round($metrics->operatingMargin(), 2));

        // EBITDA: EBIT (170k) + Depreciation (30k) = 200k
        $this->assertSame('200000.0000', $metrics->ebitda()->amount());
        $this->assertSame(0.40, round($metrics->ebitdaMargin(), 2));

        // Net profit: 170k - 10k - 30k = 130k
        $this->assertSame('130000.0000', $metrics->netProfit()->amount());
        $this->assertSame(0.26, round($metrics->netMargin(), 2));

        // Liquidity Ratios Assertions
        // Current Assets: Cash (50k) + Receivables (100k) + Inventory (50k) = 200k
        $this->assertSame('200000.0000', $metrics->currentAssets()->amount());
        $this->assertSame('50000.0000', $metrics->inventory()->amount());
        // Quick Assets: 200k - 50k = 150k
        $this->assertSame('150000.0000', $metrics->quickAssets()->amount());
        $this->assertSame('100000.0000', $metrics->currentLiabilities()->amount());

        // Current Ratio = 200k / 100k = 2.0
        $this->assertSame(2.0, $metrics->currentRatio());

        // Quick Ratio = 150k / 100k = 1.5
        $this->assertSame(1.5, $metrics->quickRatio());

        // Serialization structure check
        $array = $metrics->toArray();
        $this->assertSame(60.0, $array['pnl']['gross_margin_pct']);
        $this->assertSame(40.0, $array['pnl']['ebitda_margin_pct']);
        $this->assertSame(26.0, $array['pnl']['net_margin_pct']);
        $this->assertSame(2.0, $array['ratios']['current_ratio']);
        $this->assertSame(1.5, $array['ratios']['quick_ratio']);
    }

    public function test_zero_liabilities_handles_liquidity_gracefully(): void
    {
        $records = [
            $this->createRecord(Category::cash(), '50000.0000'),
        ];

        $metrics = $this->calculator->calculateMetrics($records);

        $this->assertNull($metrics->currentRatio());
        $this->assertNull($metrics->quickRatio());
    }

    public function test_individual_ratio_calculator_methods(): void
    {
        $ebit = Money::fromDecimal('100000.0000', Currency::PLN);
        $dep = Money::fromDecimal('25000.0000', Currency::PLN);
        $revenue = Money::fromDecimal('400000.0000', Currency::PLN);

        $ebitda = $this->calculator->calculateEbitda($ebit, $dep);
        $this->assertSame('125000.0000', $ebitda->amount());

        $margin = $this->calculator->calculateOperatingMargin($ebit, $revenue);
        $this->assertSame(0.25, round($margin, 2));

        $curAssets = Money::fromDecimal('250000.0000', Currency::PLN);
        $quickAssets = Money::fromDecimal('180000.0000', Currency::PLN);
        $liabilities = Money::fromDecimal('100000.0000', Currency::PLN);

        $this->assertSame(2.5, $this->calculator->calculateCurrentRatio($curAssets, $liabilities));
        $this->assertSame(1.8, $this->calculator->calculateQuickRatio($quickAssets, $liabilities));
    }

    private function createRecord(Category $category, string $amount): FinancialRecord
    {
        return FinancialRecord::create(
            id: FinancialRecordId::generate(),
            companyId: self::COMPANY_ID,
            category: $category,
            amount: Money::fromDecimal($amount, Currency::PLN),
            recordDate: new DateTimeImmutable('2026-02-15'),
            description: 'Automated test entry'
        );
    }
}
