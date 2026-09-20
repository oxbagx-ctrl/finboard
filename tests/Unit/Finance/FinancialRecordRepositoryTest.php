<?php

declare(strict_types=1);

namespace Tests\Unit\Finance;

use App\Contexts\Finance\Domain\Entities\Category;
use App\Contexts\Finance\Domain\Model\FinancialRecord;
use App\Contexts\Finance\Domain\Repositories\FinancialRecordRepositoryInterface;
use App\Contexts\Finance\Domain\ValueObjects\CategoryType;
use App\Contexts\Finance\Domain\ValueObjects\Currency;
use App\Contexts\Finance\Domain\ValueObjects\DateRange;
use App\Contexts\Finance\Domain\ValueObjects\FinancialRecordId;
use App\Contexts\Finance\Domain\ValueObjects\Money;
use App\Contexts\Finance\Domain\ValueObjects\RecordType;
use DateTimeImmutable;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

final class FinancialRecordRepositoryTest extends TestCase
{
    use DatabaseTransactions;

    private const COMPANY_ID = '22222222-2222-2222-2222-222222222222';
    private FinancialRecordRepositoryInterface $repository;

        protected function setUp(): void
    {
        parent::setUp();
        $this->repository = $this->app->make(FinancialRecordRepositoryInterface::class);
    }

    public function test_repository_can_save_and_retrieve_record(): void
    {
        $id = FinancialRecordId::generate();
        $record = FinancialRecord::create(
            id: $id,
            companyId: self::COMPANY_ID,
            category: Category::revenue(),
            amount: Money::fromDecimal('75000.0000', Currency::PLN),
            recordDate: new DateTimeImmutable('2026-05-15'),
            description: 'Przychody ze sprzedaży maj 2026',
            source: 'manual'
        );

        $this->repository->save($record);

        $retrieved = $this->repository->findById($id);
        $this->assertNotNull($retrieved);
        $this->assertSame($id->value(), $retrieved->id());
        $this->assertSame(self::COMPANY_ID, $retrieved->companyId());
        $this->assertSame('75000.0000', $retrieved->amount()->amount());
        $this->assertSame('2026-05-15', $retrieved->recordDate()->format('Y-m-d'));
        $this->assertSame('cat-revenue', $retrieved->category()->id());
    }

    public function test_repository_filters_by_company_and_period(): void
    {
        $recordsQ1 = $this->repository->findByCompanyId(
            self::COMPANY_ID,
            DateRange::forQuarter(2026, 1)
        );

        $this->assertNotEmpty($recordsQ1);
        foreach ($recordsQ1 as $record) {
            $this->assertSame(self::COMPANY_ID, $record->companyId());
            $this->assertTrue(
                DateRange::forQuarter(2026, 1)->contains($record->recordDate()),
                sprintf('Record date %s must be within Q1 2026', $record->recordDate()->format('Y-m-d'))
            );
        }
    }

    public function test_repository_filters_by_record_type(): void
    {
        $expenseRecords = $this->repository->findByCompanyId(
            self::COMPANY_ID,
            DateRange::forQuarter(2026, 1),
            RecordType::EXPENSE
        );

        $this->assertNotEmpty($expenseRecords);
        foreach ($expenseRecords as $record) {
            $this->assertSame(RecordType::EXPENSE, $record->recordType());
        }

        $revenueRecords = $this->repository->findByCompanyId(
            self::COMPANY_ID,
            DateRange::forQuarter(2026, 1),
            RecordType::REVENUE
        );

        $this->assertNotEmpty($revenueRecords);
        foreach ($revenueRecords as $record) {
            $this->assertSame(RecordType::REVENUE, $record->recordType());
        }
    }

    public function test_repository_filters_by_category_types(): void
    {
        $opexRecords = $this->repository->findByCompanyId(
            self::COMPANY_ID,
            DateRange::forQuarter(2026, 1),
            RecordType::EXPENSE,
            [CategoryType::OPEX]
        );

        $this->assertNotEmpty($opexRecords);
        foreach ($opexRecords as $record) {
            $this->assertSame(RecordType::EXPENSE, $record->recordType());
            $this->assertSame(CategoryType::OPEX, $record->category()->type());
        }
    }

    public function test_repository_can_extract_available_fiscal_years_ordered_descending(): void
    {
        $years = $this->repository->getAvailableFiscalYears(self::COMPANY_ID);

        $this->assertNotEmpty($years);
        $this->assertContains(2026, $years);

        // Verify descending order
        $sorted = $years;
        rsort($sorted, SORT_NUMERIC);
        $this->assertSame($sorted, $years);
    }

    public function test_repository_returns_empty_array_when_no_records_exist_for_company(): void
    {
        $emptyCompanyId = '99999999-9999-9999-9999-999999999999';
        $years = $this->repository->getAvailableFiscalYears($emptyCompanyId);

        $this->assertSame([], $years);
    }

    public function test_repository_can_find_and_delete_many_records_by_ids_with_tenant_isolation(): void
    {
        $foreignCompany = \App\Models\Company::firstOrCreate(
            ['code' => 'FOREIGN_TEST'],
            ['name' => 'Foreign Corp', 'tax_id' => 'PL9999999999']
        );
        $foreignCompanyId = $foreignCompany->id;


        $id1 = FinancialRecordId::generate();
        $record1 = FinancialRecord::create(
            id: $id1,
            companyId: self::COMPANY_ID,
            category: Category::revenue(),
            amount: Money::fromDecimal('1000.0000', Currency::PLN),
            recordDate: new DateTimeImmutable('2026-06-01'),
            description: 'Transakcja 1',
            source: 'manual'
        );

        $id2 = FinancialRecordId::generate();
        $record2 = FinancialRecord::create(
            id: $id2,
            companyId: self::COMPANY_ID,
            category: Category::revenue(),
            amount: Money::fromDecimal('2000.0000', Currency::PLN),
            recordDate: new DateTimeImmutable('2026-06-02'),
            description: 'Transakcja 2',
            source: 'manual'
        );

        $foreignId = FinancialRecordId::generate();
        $foreignRecord = FinancialRecord::create(
            id: $foreignId,
            companyId: $foreignCompanyId,
            category: Category::revenue(),
            amount: Money::fromDecimal('5000.0000', Currency::PLN),
            recordDate: new DateTimeImmutable('2026-06-03'),
            description: 'Obca transakcja',
            source: 'manual'
        );

        $this->repository->saveMany([$record1, $record2, $foreignRecord]);

        // Verify findByIds isolates by company
        $found = $this->repository->findByIds(self::COMPANY_ID, [$id1->value(), $id2->value(), $foreignId->value()]);
        $this->assertCount(2, $found);
        $foundIds = array_map(fn (FinancialRecord $r) => $r->id(), $found);
        $this->assertContains($id1->value(), $foundIds);
        $this->assertContains($id2->value(), $foundIds);
        $this->assertNotContains($foreignId->value(), $foundIds);

        // Verify deleteManyByIds strictly deletes only tenant records
        $deletedCount = $this->repository->deleteManyByIds(self::COMPANY_ID, [$id1->value(), $id2->value(), $foreignId->value()]);
        $this->assertSame(2, $deletedCount);

        // Verify tenant records are deleted
        $this->assertNull($this->repository->findById($id1));
        $this->assertNull($this->repository->findById($id2));

        // Verify foreign company record was preserved
        $this->assertNotNull($this->repository->findById($foreignId));

        // Test empty input edge cases
        $this->assertSame([], $this->repository->findByIds(self::COMPANY_ID, []));
        $this->assertSame(0, $this->repository->deleteManyByIds(self::COMPANY_ID, []));
    }
}

