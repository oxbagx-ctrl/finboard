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
        $cashRecord = FinancialRecord::create(
            id: FinancialRecordId::generate(),
            companyId: self::COMPANY_ID,
            category: Category::cash(),
            amount: Money::fromDecimal('50000.0000', Currency::PLN),
            recordDate: new DateTimeImmutable('2026-01-01'),
            description: 'Rachunek bieżący'
        );

        $this->assertTrue($cashRecord->isAsset());
        $this->assertTrue($cashRecord->isCurrentAsset());
        $this->assertTrue($cashRecord->isQuickAsset());

        $invRecord = FinancialRecord::create(
            id: FinancialRecordId::generate(),
            companyId: self::COMPANY_ID,
            category: Category::inventory(),
            amount: Money::fromDecimal('30000.0000', Currency::PLN),
            recordDate: new DateTimeImmutable('2026-01-01'),
            description: 'Magazyn wyrobów gotowych'
        );

        $this->assertTrue($invRecord->isCurrentAsset());
        $this->assertFalse($invRecord->isQuickAsset()); // Inventory excluded from quick ratio!

        $depRecord = FinancialRecord::create(
            id: FinancialRecordId::generate(),
            companyId: self::COMPANY_ID,
            category: Category::depreciation(),
            amount: Money::fromDecimal('4000.0000', Currency::PLN),
            recordDate: new DateTimeImmutable('2026-01-01'),
            description: 'Odpis amortyzacyjny maszyny CNC'
        );

        $this->assertTrue($depRecord->isExpense());
        $this->assertTrue($depRecord->isDepreciation());
    }
}
