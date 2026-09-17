<?php

declare(strict_types=1);

namespace Tests\Unit\Finance;

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
}
