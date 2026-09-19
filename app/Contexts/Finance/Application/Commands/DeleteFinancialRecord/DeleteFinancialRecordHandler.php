<?php

declare(strict_types=1);

namespace App\Contexts\Finance\Application\Commands\DeleteFinancialRecord;

use App\Contexts\Finance\Application\Exceptions\FinancialRecordNotFoundException;
use App\Contexts\Finance\Domain\Events\FinancialRecordDeleted;
use App\Contexts\Finance\Domain\Repositories\FinancialRecordRepositoryInterface;
use App\Contexts\Finance\Domain\ValueObjects\FinancialRecordId;
use Illuminate\Contracts\Events\Dispatcher;

final class DeleteFinancialRecordHandler
{
    public function __construct(
        private readonly FinancialRecordRepositoryInterface $recordRepository,
        private readonly ?Dispatcher $dispatcher = null
    ) {
    }

    public function handle(DeleteFinancialRecordCommand $command): void
    {
        $id = FinancialRecordId::fromString($command->recordId);
        $record = $this->recordRepository->findById($id);

        if ($record === null) {
            throw FinancialRecordNotFoundException::withId($command->recordId);
        }

        $this->dispatcher?->dispatch(new FinancialRecordDeleted(
            recordId: $id,
            companyId: $record->companyId(),
            deletedBy: auth()->id() !== null ? (string) auth()->id() : null,
            payload: [
                'amount' => $record->amount()->amount(),
                'currency' => $record->amount()->currency()->value,
                'category_id' => $record->category()->id(),
                'record_date' => $record->recordDate()->format('Y-m-d'),
                'description' => $record->description(),
            ]
        ));

        $this->recordRepository->delete($id);
    }
}
