<?php

declare(strict_types=1);

namespace Tests\Unit\Finance;

use App\Contexts\Finance\Application\Commands\BatchDeleteFinancialRecords\BatchDeleteFinancialRecordsCommand;
use App\Contexts\Finance\Application\Commands\BatchDeleteFinancialRecords\BatchDeleteFinancialRecordsHandler;
use App\Contexts\Finance\Application\Commands\BatchIngestFinancialRecords\BatchIngestFinancialRecordsCommand;
use App\Contexts\Finance\Application\Commands\BatchIngestFinancialRecords\BatchIngestFinancialRecordsHandler;
use App\Contexts\Finance\Application\Commands\CreateFinancialRecord\CreateFinancialRecordCommand;

use App\Contexts\Finance\Application\Commands\CreateFinancialRecord\CreateFinancialRecordHandler;
use App\Contexts\Finance\Application\Commands\DeleteFinancialRecord\DeleteFinancialRecordCommand;
use App\Contexts\Finance\Application\Commands\DeleteFinancialRecord\DeleteFinancialRecordHandler;
use App\Contexts\Finance\Application\Commands\UpdateFinancialRecord\UpdateFinancialRecordCommand;
use App\Contexts\Finance\Application\Commands\UpdateFinancialRecord\UpdateFinancialRecordHandler;
use App\Contexts\Finance\Application\Exceptions\CategoryNotFoundException;
use App\Contexts\Finance\Application\Exceptions\FinancialRecordNotFoundException;
use App\Contexts\Finance\Domain\Repositories\CategoryRepositoryInterface;
use App\Contexts\Finance\Domain\Repositories\FinancialRecordRepositoryInterface;
use App\Contexts\Finance\Domain\ValueObjects\FinancialRecordId;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

final class CommandsTest extends TestCase
{
    use DatabaseTransactions;

    private const COMPANY_ID = '22222222-2222-2222-2222-222222222222';
    private FinancialRecordRepositoryInterface $recordRepo;
    private CategoryRepositoryInterface $categoryRepo;

    protected function setUp(): void
    {
        parent::setUp();
        $this->recordRepo = $this->app->make(FinancialRecordRepositoryInterface::class);
        $this->categoryRepo = $this->app->make(CategoryRepositoryInterface::class);
    }

    public function test_create_financial_record_handler_persists_record(): void
    {
        $handler = new CreateFinancialRecordHandler($this->recordRepo, $this->categoryRepo);

        $command = new CreateFinancialRecordCommand(
            companyId: self::COMPANY_ID,
            categoryId: 'cat-revenue',
            amount: '12345.6700',
            currency: 'PLN',
            recordDate: '2026-06-01',
            description: 'Sprzedaż licencji czerwiec',
            source: 'manual'
        );

        $recordId = $handler->handle($command);
        $this->assertNotEmpty($recordId);

        $record = $this->recordRepo->findById(FinancialRecordId::fromString($recordId));
        $this->assertNotNull($record);
        $this->assertSame('12345.6700', $record->amount()->amount());
        $this->assertSame('Sprzedaż licencji czerwiec', $record->description());
        $this->assertSame('cat-revenue', $record->category()->id());
    }

    public function test_create_financial_record_with_invalid_category_throws_exception(): void
    {
        $handler = new CreateFinancialRecordHandler($this->recordRepo, $this->categoryRepo);

        $this->expectException(CategoryNotFoundException::class);

        $command = new CreateFinancialRecordCommand(
            companyId: self::COMPANY_ID,
            categoryId: 'non-existent-cat-id',
            amount: '100.0000',
            currency: 'PLN',
            recordDate: '2026-06-01',
            description: 'Invalid'
        );

        $handler->handle($command);
    }

    public function test_batch_ingest_financial_records_handler(): void
    {
        $handler = new BatchIngestFinancialRecordsHandler($this->recordRepo, $this->categoryRepo);

        $command = new BatchIngestFinancialRecordsCommand(
            companyId: self::COMPANY_ID,
            recordsData: [
                [
                    'category_id' => 'cat-revenue',
                    'amount' => '50000.0000',
                    'record_date' => '2026-06-01',
                    'description' => 'Przychody transza A',
                ],
                [
                    'category_id' => 'COGS', // Tested matching by code as well
                    'amount' => '22000.0000',
                    'record_date' => '2026-06-01',
                    'description' => 'Koszty bezpośrednie transza A',
                ],
            ]
        );

        $ids = $handler->handle($command);
        $this->assertCount(2, $ids);

        foreach ($ids as $id) {
            $record = $this->recordRepo->findById(FinancialRecordId::fromString($id));
            $this->assertNotNull($record);
            $this->assertSame(self::COMPANY_ID, $record->companyId());
        }
    }

    public function test_update_financial_record_handler(): void
    {
        $createHandler = new CreateFinancialRecordHandler($this->recordRepo, $this->categoryRepo);
        $recordId = $createHandler->handle(new CreateFinancialRecordCommand(
            companyId: self::COMPANY_ID,
            categoryId: 'cat-opex',
            amount: '5000.0000',
            currency: 'PLN',
            recordDate: '2026-06-10',
            description: 'Koszty biurowe wstępne'
        ));

        $updateHandler = new UpdateFinancialRecordHandler($this->recordRepo, $this->categoryRepo);
        $updateHandler->handle(new UpdateFinancialRecordCommand(
            recordId: $recordId,
            amount: '6200.0000',
            currency: 'PLN',
            recordDate: '2026-06-12',
            description: 'Koszty biurowe skorygowane',
            categoryId: 'cat-opex'
        ));

        $updated = $this->recordRepo->findById(FinancialRecordId::fromString($recordId));
        $this->assertNotNull($updated);
        $this->assertSame('6200.0000', $updated->amount()->amount());
        $this->assertSame('Koszty biurowe skorygowane', $updated->description());
        $this->assertSame('2026-06-12', $updated->recordDate()->format('Y-m-d'));
    }

    public function test_delete_financial_record_handler(): void
    {
        $createHandler = new CreateFinancialRecordHandler($this->recordRepo, $this->categoryRepo);
        $recordId = $createHandler->handle(new CreateFinancialRecordCommand(
            companyId: self::COMPANY_ID,
            categoryId: 'cat-cash',
            amount: '10000.0000',
            currency: 'PLN',
            recordDate: '2026-06-15',
            description: 'Wpis do usunięcia'
        ));

        $deleteHandler = new DeleteFinancialRecordHandler($this->recordRepo);
        $deleteHandler->handle(new DeleteFinancialRecordCommand($recordId));

        $this->assertNull($this->recordRepo->findById(FinancialRecordId::fromString($recordId)));
    }

    public function test_updating_non_existent_record_throws_exception(): void
    {
        $updateHandler = new UpdateFinancialRecordHandler($this->recordRepo, $this->categoryRepo);

        $this->expectException(FinancialRecordNotFoundException::class);

        $updateHandler->handle(new UpdateFinancialRecordCommand(
            recordId: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
            amount: '100.0000',
            currency: 'PLN',
            recordDate: '2026-06-01',
            description: 'Nieistniejący wpis',
            categoryId: 'cat-revenue'
        ));
    }

    public function test_batch_delete_financial_records_handler_deletes_records_atomically(): void
    {
        $createHandler = new CreateFinancialRecordHandler($this->recordRepo, $this->categoryRepo);

        $id1 = $createHandler->handle(new CreateFinancialRecordCommand(
            companyId: self::COMPANY_ID,
            categoryId: 'cat-revenue',
            amount: '3500.0000',
            currency: 'PLN',
            recordDate: '2026-06-01',
            description: 'Przychód 1'
        ));

        $id2 = $createHandler->handle(new CreateFinancialRecordCommand(
            companyId: self::COMPANY_ID,
            categoryId: 'cat-revenue',
            amount: '1500.0000',
            currency: 'PLN',
            recordDate: '2026-06-02',
            description: 'Przychód 2'
        ));

        $handler = new BatchDeleteFinancialRecordsHandler($this->recordRepo);
        $result = $handler->handle(new BatchDeleteFinancialRecordsCommand(
            companyId: self::COMPANY_ID,
            recordIds: [$id1, $id2],
            userId: '00000000-0000-0000-0000-000000000001',
            ipAddress: '127.0.0.1'
        ));

        $this->assertSame(2, $result->deletedCount);
        $this->assertEquals(5000.0, $result->totalAmount);
        $this->assertContains($id1, $result->deletedRecordIds);
        $this->assertContains($id2, $result->deletedRecordIds);

        $this->assertNull($this->recordRepo->findById(FinancialRecordId::fromString($id1)));
        $this->assertNull($this->recordRepo->findById(FinancialRecordId::fromString($id2)));
    }

    public function test_batch_delete_financial_records_handler_with_empty_or_whitespace_ids(): void
    {
        $handler = new BatchDeleteFinancialRecordsHandler($this->recordRepo);
        $result = $handler->handle(new BatchDeleteFinancialRecordsCommand(
            companyId: self::COMPANY_ID,
            recordIds: ['', '   ', '']
        ));

        $this->assertSame(0, $result->deletedCount);
        $this->assertSame(0.0, $result->totalAmount);
        $this->assertSame([], $result->deletedRecordIds);
    }

    public function test_batch_delete_financial_records_handler_enforces_company_isolation(): void
    {
        $foreignCompany = \App\Models\Company::firstOrCreate(
            ['code' => 'FOREIGN_ISOL'],
            ['name' => 'Foreign Isol Corp', 'tax_id' => 'PL8888888888']
        );

        $createHandler = new CreateFinancialRecordHandler($this->recordRepo, $this->categoryRepo);

        $targetId = $createHandler->handle(new CreateFinancialRecordCommand(
            companyId: self::COMPANY_ID,
            categoryId: 'cat-revenue',
            amount: '4000.0000',
            currency: 'PLN',
            recordDate: '2026-06-03',
            description: 'Nasz rekord'
        ));

        $foreignId = $createHandler->handle(new CreateFinancialRecordCommand(
            companyId: $foreignCompany->id,
            categoryId: 'cat-revenue',
            amount: '8000.0000',
            currency: 'PLN',
            recordDate: '2026-06-03',
            description: 'Obcy rekord'
        ));

        $handler = new BatchDeleteFinancialRecordsHandler($this->recordRepo);
        $result = $handler->handle(new BatchDeleteFinancialRecordsCommand(
            companyId: self::COMPANY_ID,
            recordIds: [$targetId, $foreignId]
        ));

        $this->assertSame(1, $result->deletedCount);
        $this->assertEquals(4000.0, $result->totalAmount);
        $this->assertSame([$targetId], $result->deletedRecordIds);

        // Target record deleted
        $this->assertNull($this->recordRepo->findById(FinancialRecordId::fromString($targetId)));

        // Foreign record intact
        $this->assertNotNull($this->recordRepo->findById(FinancialRecordId::fromString($foreignId)));
    }
}

