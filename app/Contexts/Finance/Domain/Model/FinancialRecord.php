<?php

declare(strict_types=1);

namespace App\Contexts\Finance\Domain\Model;

use App\Contexts\Finance\Domain\Entities\Category;
use App\Contexts\Finance\Domain\Events\FinancialRecordCreated;
use App\Contexts\Finance\Domain\Events\FinancialRecordUpdated;
use App\Contexts\Finance\Domain\ValueObjects\FinancialRecordId;
use App\Contexts\Finance\Domain\ValueObjects\Money;
use App\Contexts\Finance\Domain\ValueObjects\RecordType;
use App\Shared\Domain\AggregateRoot;
use DateTimeImmutable;
use InvalidArgumentException;

final class FinancialRecord extends AggregateRoot
{
    public function __construct(
        private readonly FinancialRecordId $id,
        private readonly string $companyId,
        private Category $category,
        private Money $amount,
        private DateTimeImmutable $recordDate,
        private string $description,
        private readonly string $source = 'manual',
        private readonly DateTimeImmutable $createdAt = new DateTimeImmutable(),
        private ?DateTimeImmutable $updatedAt = null
    ) {
        if (trim($this->companyId) === '') {
            throw new InvalidArgumentException('FinancialRecord must be associated with a valid companyId.');
        }

        if ($this->amount->isNegative()) {
            throw new InvalidArgumentException('FinancialRecord amount cannot be negative.');
        }
    }

    public static function create(
        FinancialRecordId $id,
        string $companyId,
        Category $category,
        Money $amount,
        DateTimeImmutable $recordDate,
        string $description,
        string $source = 'manual'
    ): self {
        $record = new self(
            id: $id,
            companyId: trim($companyId),
            category: $category,
            amount: $amount,
            recordDate: $recordDate,
            description: trim($description),
            source: trim($source),
            createdAt: new DateTimeImmutable()
        );

        $record->recordThat(new FinancialRecordCreated(
            recordId: $id,
            companyId: $record->companyId,
            categoryId: $category->id(),
            amount: $amount->amount(),
            currency: $amount->currency()->value,
            recordDate: $recordDate->format('Y-m-d'),
            source: $record->source
        ));

        return $record;
    }

    public function id(): string
    {
        return $this->id->value();
    }

    public function recordId(): FinancialRecordId
    {
        return $this->id;
    }

    public function companyId(): string
    {
        return $this->companyId;
    }

    public function category(): Category
    {
        return $this->category;
    }

    public function recordType(): RecordType
    {
        return $this->category->recordType();
    }

    public function amount(): Money
    {
        return $this->amount;
    }

    public function recordDate(): DateTimeImmutable
    {
        return $this->recordDate;
    }

    public function description(): string
    {
        return $this->description;
    }

    public function source(): string
    {
        return $this->source;
    }

    public function createdAt(): DateTimeImmutable
    {
        return $this->createdAt;
    }

    public function updatedAt(): ?DateTimeImmutable
    {
        return $this->updatedAt;
    }

    public function updateAmount(Money $newAmount): void
    {
        if ($this->amount->equals($newAmount)) {
            return;
        }

        if ($newAmount->isNegative()) {
            throw new InvalidArgumentException('FinancialRecord amount cannot be negative.');
        }

        $previousAmount = $this->amount->amount();
        $this->amount = $newAmount;
        $this->updatedAt = new DateTimeImmutable();

        $this->recordThat(new FinancialRecordUpdated(
            recordId: $this->id,
            previousAmount: $previousAmount,
            newAmount: $newAmount->amount(),
            currency: $newAmount->currency()->value
        ));
    }

    public function updateDetails(string $description, DateTimeImmutable $recordDate, Category $category): void
    {
        $this->description = trim($description);
        $this->recordDate = $recordDate;
        $this->category = $category;
        $this->updatedAt = new DateTimeImmutable();
    }

    public function isRevenue(): bool
    {
        return $this->category->recordType() === RecordType::REVENUE;
    }

    public function isExpense(): bool
    {
        return $this->category->recordType() === RecordType::EXPENSE;
    }

    public function isAsset(): bool
    {
        return $this->category->recordType() === RecordType::ASSET;
    }

    public function isLiability(): bool
    {
        return $this->category->recordType() === RecordType::LIABILITY;
    }

    public function isCurrentAsset(): bool
    {
        return $this->category->type()->isCurrentAsset();
    }

    public function isQuickAsset(): bool
    {
        return $this->category->type()->isQuickAsset();
    }

    public function isCurrentLiability(): bool
    {
        return $this->category->type()->isCurrentLiability();
    }

    public function isDepreciation(): bool
    {
        return $this->category->type() === \App\Contexts\Finance\Domain\ValueObjects\CategoryType::DEPRECIATION;
    }
}
