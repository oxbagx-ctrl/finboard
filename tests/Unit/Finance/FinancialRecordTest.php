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
