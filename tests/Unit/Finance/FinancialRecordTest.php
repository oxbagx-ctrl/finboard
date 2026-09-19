<?php

declare(strict_types=1);

namespace Tests\Unit\Finance;

use App\Contexts\Finance\Domain\Entities\Category;
use App\Contexts\Finance\Domain\Events\FinancialRecordCreated;
use App\Contexts\Finance\Domain\Events\FinancialRecordUpdated;
use App\Contexts\Finance\Domain\Model\FinancialRecord;
use App\Contexts\Finance\Domain\ValueObjects\Currency;
use App\Contexts\Finance\Domain\ValueObjects\FinancialRecordId;
use App\Contexts\Finance\Domain\ValueObjects\Money;
use App\Contexts\Finance\Domain\ValueObjects\RecordType;
use DateTimeImmutable;
use InvalidArgumentException;
use PHPUnit\Framework\TestCase;

final class FinancialRecordTest extends TestCase
{
    private const COMPANY_ID = '22222222-2222-2222-2222-222222222222';

    public function test_financial_record_creation_records_event(): void
    {
        $id = FinancialRecordId::generate();
        $category = Category::revenue();
        $amount = Money::fromDecimal('15000.0000', Currency::PLN);
        $date = new DateTimeImmutable('2026-03-15');

        $record = FinancialRecord::create(
            id: $id,
            companyId: self::COMPANY_ID,
            category: $category,
            amount: $amount,
            recordDate: $date,
            description: 'Faktura sprzedaży usług IT',
            source: 'csv_import'
        );

        $this->assertSame($id->value(), $record->id());
        $this->assertSame(self::COMPANY_ID, $record->companyId());
        $this->assertSame($category, $record->category());
        $this->assertSame(RecordType::REVENUE, $record->recordType());
        $this->assertTrue($record->amount()->equals($amount));
        $this->assertSame('2026-03-15', $record->recordDate()->format('Y-m-d'));
        $this->assertSame('Faktura sprzedaży usług IT', $record->description());
        $this->assertSame('csv_import', $record->source());
        $this->assertTrue($record->isRevenue());
        $this->assertFalse($record->isExpense());

        $events = $record->releaseEvents();
        $this->assertCount(1, $events);
        $this->assertInstanceOf(FinancialRecordCreated::class, $events[0]);
        $this->assertSame($id->value(), $events[0]->aggregateId());
        $this->assertSame(self::COMPANY_ID, $events[0]->companyId());
    }

    public function test_empty_company_id_throws_exception(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('valid companyId');

        FinancialRecord::create(
            id: FinancialRecordId::generate(),
            companyId: '   ',
            category: Category::revenue(),
            amount: Money::fromDecimal('100.0000', Currency::PLN),
            recordDate: new DateTimeImmutable('2026-01-01'),
            description: 'Test'
        );
    }

    public function test_negative_amount_throws_exception(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('cannot be negative');

        FinancialRecord::create(
            id: FinancialRecordId::generate(),
            companyId: self::COMPANY_ID,
            category: Category::opex(),
            amount: Money::fromDecimal('-50.0000', Currency::PLN),
            recordDate: new DateTimeImmutable('2026-01-01'),
            description: 'Negative expense'
        );
    }

    public function test_update_amount_records_event(): void
    {
        $record = FinancialRecord::create(
            id: FinancialRecordId::generate(),
            companyId: self::COMPANY_ID,
            category: Category::cogs(),
            amount: Money::fromDecimal('2000.0000', Currency::PLN),
            recordDate: new DateTimeImmutable('2026-02-01'),
            description: 'Koszt materiałów'
        );

        $record->releaseEvents(); // clear created event

        $newAmount = Money::fromDecimal('2500.0000', Currency::PLN);
        $record->updateAmount($newAmount);

        $this->assertTrue($record->amount()->equals($newAmount));

        $events = $record->releaseEvents();
        $this->assertCount(1, $events);
        $this->assertInstanceOf(FinancialRecordUpdated::class, $events[0]);
    }

    public function test_category_classification_predicates(): void
    {
        $revRecord = $this->makeRecord(Category::revenue(), '100000.0000');
        $this->assertTrue($revRecord->isRevenue());
        $this->assertFalse($revRecord->isExpense());

        $cogsRecord = $this->makeRecord(Category::cogs(), '40000.0000');
        $this->assertTrue($cogsRecord->isExpense());
        $this->assertTrue($cogsRecord->isCogs());

        $opexRecord = $this->makeRecord(Category::opex(), '20000.0000');
        $this->assertTrue($opexRecord->isExpense());
        $this->assertTrue($opexRecord->isOpex());

        $finRecord = $this->makeRecord(Category::financialCost(), '5000.0000');
        $this->assertTrue($finRecord->isExpense());
        $this->assertTrue($finRecord->isFinancial());

        $taxRecord = $this->makeRecord(Category::tax(), '12000.0000');
        $this->assertTrue($taxRecord->isExpense());
        $this->assertTrue($taxRecord->isTax());

        $cashRecord = $this->makeRecord(Category::cash(), '50000.0000');
        $this->assertTrue($cashRecord->isAsset());
        $this->assertTrue($cashRecord->isCurrentAsset());
        $this->assertTrue($cashRecord->isQuickAsset());
        $this->assertFalse($cashRecord->isFixedAsset());
        $this->assertFalse($cashRecord->isDebt());

        $invRecord = $this->makeRecord(Category::inventory(), '30000.0000');
        $this->assertTrue($invRecord->isCurrentAsset());
        $this->assertFalse($invRecord->isQuickAsset()); // Inventory excluded from quick ratio!

        $fixedRecord = $this->makeRecord(Category::fixedAssets(), '150000.0000');
        $this->assertTrue($fixedRecord->isAsset());
        $this->assertTrue($fixedRecord->isFixedAsset());
        $this->assertFalse($fixedRecord->isCurrentAsset());

        $curLiabRecord = $this->makeRecord(Category::currentLiabilities(), '40000.0000');
        $this->assertTrue($curLiabRecord->isLiability());
        $this->assertTrue($curLiabRecord->isCurrentLiability());
        $this->assertTrue($curLiabRecord->isDebt());
        $this->assertFalse($curLiabRecord->isLongTermLiability());

        $ltLiabRecord = $this->makeRecord(Category::longTermLiabilities(), '60000.0000');
        $this->assertTrue($ltLiabRecord->isLiability());
        $this->assertTrue($ltLiabRecord->isLongTermLiability());
        $this->assertTrue($ltLiabRecord->isDebt());
        $this->assertFalse($ltLiabRecord->isCurrentLiability());

        $depRecord = $this->makeRecord(Category::depreciation(), '4000.0000');
        $this->assertTrue($depRecord->isExpense());
        $this->assertTrue($depRecord->isDepreciation());
    }

    public function test_calculate_profit_and_margins_domain_logic(): void
    {
        $revenue = Money::fromDecimal('500000.0000', Currency::PLN);
        $cogs = Money::fromDecimal('200000.0000', Currency::PLN);
        $opex = Money::fromDecimal('100000.0000', Currency::PLN);
        $depreciation = Money::fromDecimal('30000.0000', Currency::PLN);
        $finCosts = Money::fromDecimal('10000.0000', Currency::PLN);
        $tax = Money::fromDecimal('30000.0000', Currency::PLN);

        // Gross Profit: 500k - 200k = 300k
        $grossProfit = FinancialRecord::calculateGrossProfit($revenue, $cogs);
        $this->assertSame('300000.0000', $grossProfit->amount());
        $this->assertSame(0.6, FinancialRecord::calculateGrossMargin($grossProfit, $revenue));

        // EBIT: 300k - 100k - 30k = 170k
        $ebit = FinancialRecord::calculateEbit($grossProfit, $opex, $depreciation);
        $this->assertSame('170000.0000', $ebit->amount());
        $this->assertSame(0.34, FinancialRecord::calculateOperatingMargin($ebit, $revenue));
        $this->assertSame(0.34, FinancialRecord::calculateEbitMargin($ebit, $revenue));

        // EBITDA: 170k + 30k = 200k
        $ebitda = FinancialRecord::calculateEbitda($ebit, $depreciation);
        $this->assertSame('200000.0000', $ebitda->amount());
        $this->assertSame(0.4, FinancialRecord::calculateEbitdaMargin($ebitda, $revenue));

        // Net Profit: 170k - 10k - 30k = 130k
        $netProfit = FinancialRecord::calculateNetProfit($ebit, $finCosts, $tax);
        $this->assertSame('130000.0000', $netProfit->amount());
        $this->assertSame(0.26, FinancialRecord::calculateNetMargin($netProfit, $revenue));
    }

    public function test_negative_margins_when_loss_incurred(): void
    {
        $revenue = Money::fromDecimal('100000.0000', Currency::PLN);
        $cogs = Money::fromDecimal('120000.0000', Currency::PLN); // Gross loss of 20k

        $grossProfit = FinancialRecord::calculateGrossProfit($revenue, $cogs);
        $this->assertSame('-20000.0000', $grossProfit->amount());

        $grossMargin = FinancialRecord::calculateGrossMargin($grossProfit, $revenue);
        $this->assertSame(-0.2, $grossMargin);
    }

    public function test_zero_or_negative_revenue_returns_null_margin(): void
    {
        $profit = Money::fromDecimal('10000.0000', Currency::PLN);
        $zeroRevenue = Money::zero(Currency::PLN);

        $this->assertNull(FinancialRecord::calculateGrossMargin($profit, $zeroRevenue));
        $this->assertNull(FinancialRecord::calculateOperatingMargin($profit, $zeroRevenue));
        $this->assertNull(FinancialRecord::calculateEbitdaMargin($profit, $zeroRevenue));
        $this->assertNull(FinancialRecord::calculateNetMargin($profit, $zeroRevenue));
    }

    public function test_calculate_pnl_from_records_collection(): void
    {
        $records = [
            $this->makeRecord(Category::revenue(), '500000.0000'),
            $this->makeRecord(Category::cogs(), '200000.0000'),
            $this->makeRecord(Category::opex(), '100000.0000'),
            $this->makeRecord(Category::depreciation(), '30000.0000'),
            $this->makeRecord(Category::financialCost(), '10000.0000'),
            $this->makeRecord(Category::tax(), '30000.0000'),
        ];

        $pnl = FinancialRecord::calculatePnlFromRecords($records, Currency::PLN);

        $this->assertSame('500000.0000', $pnl['revenue']->amount());
        $this->assertSame('200000.0000', $pnl['cogs']->amount());
        $this->assertSame('300000.0000', $pnl['gross_profit']->amount());
        $this->assertSame(0.6, $pnl['gross_margin']);
        $this->assertSame('100000.0000', $pnl['opex']->amount());
        $this->assertSame('30000.0000', $pnl['depreciation']->amount());
        $this->assertSame('170000.0000', $pnl['ebit']->amount());
        $this->assertSame(0.34, $pnl['operating_margin']);
        $this->assertSame('200000.0000', $pnl['ebitda']->amount());
        $this->assertSame(0.4, $pnl['ebitda_margin']);
        $this->assertSame('130000.0000', $pnl['net_profit']->amount());
        $this->assertSame(0.26, $pnl['net_margin']);
    }

    public function test_calculate_current_ratio_domain_logic(): void
    {
        $currentAssets = Money::fromDecimal('200000.0000', Currency::PLN);
        $currentLiabilities = Money::fromDecimal('100000.0000', Currency::PLN);

        $ratio = FinancialRecord::calculateCurrentRatio($currentAssets, $currentLiabilities);
        $this->assertSame(2.0, $ratio);

        // Edge case: zero liabilities returns null (not error or division by zero)
        $this->assertNull(
            FinancialRecord::calculateCurrentRatio($currentAssets, Money::zero(Currency::PLN))
        );
    }

    public function test_calculate_quick_ratio_domain_logic(): void
    {
        $quickAssets = Money::fromDecimal('150000.0000', Currency::PLN);
        $currentLiabilities = Money::fromDecimal('100000.0000', Currency::PLN);

        $ratio = FinancialRecord::calculateQuickRatio($quickAssets, $currentLiabilities);
        $this->assertSame(1.5, $ratio);

        // Edge case: zero liabilities returns null
        $this->assertNull(
            FinancialRecord::calculateQuickRatio($quickAssets, Money::zero(Currency::PLN))
        );
    }

    public function test_calculate_debt_to_assets_domain_logic(): void
    {
        // Total Debt (100k) / Total Assets (400k) = 0.25
        $totalDebt = Money::fromDecimal('100000.0000', Currency::PLN);
        $totalAssets = Money::fromDecimal('400000.0000', Currency::PLN);

        $ratio = FinancialRecord::calculateDebtToAssets($totalDebt, $totalAssets);
        $this->assertSame(0.25, $ratio);

        // Edge case: zero assets returns null
        $this->assertNull(
            FinancialRecord::calculateDebtToAssets($totalDebt, Money::zero(Currency::PLN))
        );
    }

    public function test_calculate_balance_ratios_from_records_collection(): void
    {
        $records = [
            $this->makeRecord(Category::cash(), '50000.0000'),
            $this->makeRecord(Category::receivables(), '100000.0000'),
            $this->makeRecord(Category::inventory(), '50000.0000'),
            $this->makeRecord(Category::fixedAssets(), '200000.0000'),
            $this->makeRecord(Category::currentLiabilities(), '100000.0000'),
            $this->makeRecord(Category::longTermLiabilities(), '50000.0000'),
        ];

        $ratios = FinancialRecord::calculateBalanceRatiosFromRecords($records, Currency::PLN);

        // Current Assets: 50k + 100k + 50k = 200k
        $this->assertSame('200000.0000', $ratios['current_assets']->amount());
        // Quick Assets: 50k + 100k = 150k
        $this->assertSame('150000.0000', $ratios['quick_assets']->amount());
        // Current Liabilities: 100k
        $this->assertSame('100000.0000', $ratios['current_liabilities']->amount());
        // Total Assets: 200k + 200k = 400k
        $this->assertSame('400000.0000', $ratios['total_assets']->amount());
        // Total Debt: 100k + 50k = 150k
        $this->assertSame('150000.0000', $ratios['total_debt']->amount());

        // Current Ratio: 200k / 100k = 2.0
        $this->assertSame(2.0, $ratios['current_ratio']);
        // Quick Ratio: 150k / 100k = 1.5
        $this->assertSame(1.5, $ratios['quick_ratio']);
        // Debt to Assets: 150k / 400k = 0.375
        $this->assertSame(0.375, $ratios['debt_to_assets']);
    }

    public function test_empty_records_collection_returns_null_ratios(): void
    {
        $ratios = FinancialRecord::calculateBalanceRatiosFromRecords([], Currency::PLN);

        $this->assertNull($ratios['current_ratio']);
        $this->assertNull($ratios['quick_ratio']);
        $this->assertNull($ratios['debt_to_assets']);
        $this->assertSame('0.0000', $ratios['total_assets']->amount());
        $this->assertSame('0.0000', $ratios['total_debt']->amount());
    }

    private function makeRecord(Category $category, string $amount): FinancialRecord
    {
        return FinancialRecord::create(
            id: FinancialRecordId::generate(),
            companyId: self::COMPANY_ID,
            category: $category,
            amount: Money::fromDecimal($amount, Currency::PLN),
            recordDate: new DateTimeImmutable('2026-01-01'),
            description: 'Balance test record'
        );
    }
}
