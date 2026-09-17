<?php

declare(strict_types=1);

namespace App\Contexts\Finance\Application\Commands\DeleteFinancialRecord;

use App\Contexts\Finance\Application\Exceptions\FinancialRecordNotFoundException;
use App\Contexts\Finance\Domain\Repositories\FinancialRecordRepositoryInterface;
use App\Contexts\Finance\Domain\ValueObjects\FinancialRecordId;

final class DeleteFinancialRecordHandler
{
    public function __construct(
        private readonly FinancialRecordRepositoryInterface $recordRepository
    ) {
    }

    public function handle(DeleteFinancialRecordCommand $command): void
    {
        $id = FinancialRecordId::fromString($command->recordId);
        $record = $this->recordRepository->findById($id);

        if ($record === null) {
            throw FinancialRecordNotFoundException::withId($command->recordId);
        }

        $this->recordRepository->delete($id);
    }
}
