<?php

declare(strict_types=1);

namespace App\Contexts\Finance\Application\Commands\UpdateFinancialRecord;

use App\Contexts\Finance\Application\Exceptions\CategoryNotFoundException;
use App\Contexts\Finance\Application\Exceptions\FinancialRecordNotFoundException;
use App\Contexts\Finance\Domain\Repositories\CategoryRepositoryInterface;
use App\Contexts\Finance\Domain\Repositories\FinancialRecordRepositoryInterface;
use App\Contexts\Finance\Domain\ValueObjects\Currency;
use App\Contexts\Finance\Domain\ValueObjects\FinancialRecordId;
use App\Contexts\Finance\Domain\ValueObjects\Money;
use App\Contexts\Finance\Domain\ValueObjects\RecordType;
use DateTimeImmutable;
use DomainException;

final class UpdateFinancialRecordHandler
{
    public function __construct(
        private readonly FinancialRecordRepositoryInterface $recordRepository,
        private readonly CategoryRepositoryInterface $categoryRepository
    ) {
    }

    public function handle(UpdateFinancialRecordCommand $command): void
    {
        $id = FinancialRecordId::fromString($command->recordId);
        $record = $this->recordRepository->findById($id);

        if ($record === null) {
            throw FinancialRecordNotFoundException::withId($command->recordId);
        }

        $category = $this->categoryRepository->findById($command->categoryId);
        if ($category === null) {
            throw CategoryNotFoundException::withId($command->categoryId);
        }

        $recordType = $category->recordType();
        if (RecordType::tryFrom($recordType->value) === null) {
            throw new DomainException("Category [{$command->categoryId}] does not resolve to a canonical RecordType.");
        }

        $currency = Currency::from($command->currency);
        $amount = Money::fromDecimal($command->amount, $currency);
        $recordDate = new DateTimeImmutable($command->recordDate);

        $record->updateAmount($amount);
        $record->updateDetails($command->description, $recordDate, $category);

        $this->recordRepository->save($record);
    }
}
