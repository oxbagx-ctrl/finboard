<?php

declare(strict_types=1);

namespace Tests\Unit\Finance;

use App\Contexts\Finance\Domain\Entities\Category;
use App\Contexts\Finance\Domain\Model\FinancialRecord;
use App\Contexts\Finance\Domain\Repositories\FinancialRecordRepositoryInterface;
use App\Contexts\Finance\Domain\ValueObjects\Currency;
use App\Contexts\Finance\Domain\ValueObjects\DateRange;
use App\Contexts\Finance\Domain\ValueObjects\FinancialRecordId;
use App\Contexts\Finance\Domain\ValueObjects\Money;
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
}
