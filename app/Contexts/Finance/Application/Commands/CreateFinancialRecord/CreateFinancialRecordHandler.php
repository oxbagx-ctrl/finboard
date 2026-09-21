<?php

declare(strict_types=1);

namespace App\Contexts\Finance\Application\Commands\CreateFinancialRecord;

use App\Contexts\Finance\Application\Exceptions\CategoryNotFoundException;
use App\Contexts\Finance\Domain\Model\FinancialRecord;
use App\Contexts\Finance\Domain\Repositories\CategoryRepositoryInterface;
use App\Contexts\Finance\Domain\Repositories\FinancialRecordRepositoryInterface;
use App\Contexts\Finance\Domain\ValueObjects\Currency;
use App\Contexts\Finance\Domain\ValueObjects\FinancialRecordId;
use App\Contexts\Finance\Domain\ValueObjects\Money;
use App\Contexts\Finance\Domain\ValueObjects\RecordType;
use DateTimeImmutable;
use DomainException;

final class CreateFinancialRecordHandler
{
    public function __construct(
        private readonly FinancialRecordRepositoryInterface $recordRepository,
        private readonly CategoryRepositoryInterface $categoryRepository
    ) {
    }

    public function handle(CreateFinancialRecordCommand $command): string
    {
        $category = $this->categoryRepository->findById($command->categoryId);
        if ($category === null) {
            throw CategoryNotFoundException::withId($command->categoryId);
        }

        $recordType = $category->recordType();
        if (RecordType::tryFrom($recordType->value) === null) {
            throw new DomainException("Category [{$command->categoryId}] does not resolve to a canonical RecordType.");
        }

        $recordId = FinancialRecordId::generate();
        $currency = Currency::from($command->currency);
        $amount = Money::fromDecimal($command->amount, $currency);
        $recordDate = new DateTimeImmutable($command->recordDate);

        $record = FinancialRecord::create(
            id: $recordId,
            companyId: $command->companyId,
            category: $category,
            amount: $amount,
            recordDate: $recordDate,
            description: $command->description,
            source: $command->source
        );

        $this->recordRepository->save($record);

        return $record->id();
    }
}
