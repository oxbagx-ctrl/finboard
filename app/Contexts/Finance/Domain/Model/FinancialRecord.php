<?php

declare(strict_types=1);

namespace App\Contexts\Finance\Domain\Model;

use App\Contexts\Finance\Domain\Entities\Category;
use App\Contexts\Finance\Domain\Events\FinancialRecordCreated;
use App\Contexts\Finance\Domain\Events\FinancialRecordUpdated;
use App\Contexts\Finance\Domain\ValueObjects\CategoryType;
use App\Contexts\Finance\Domain\ValueObjects\Currency;
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

    public function isFixedAsset(): bool
    {
        return $this->category->type()->isFixedAsset();
    }

    public function isCurrentLiability(): bool
    {
        return $this->category->type()->isCurrentLiability();
    }

    public function isLongTermLiability(): bool
    {
        return $this->category->type()->isLongTermLiability();
    }

    public function isDebt(): bool
    {
        return $this->category->type()->isDebt();
    }

    public function isDepreciation(): bool
    {
        return $this->category->type() === CategoryType::DEPRECIATION;
    }

    /**
     * Calculate Current Ratio: Current Assets / Current Liabilities.
     * Returns null if current liabilities <= 0 to prevent division by zero or nonsensical ratios.
     */
    public static function calculateCurrentRatio(Money $currentAssets, Money $currentLiabilities): ?float
    {
        if ($currentLiabilities->isZero() || $currentLiabilities->isNegative()) {
            return null;
        }

        $ratio = bcdiv($currentAssets->amount(), $currentLiabilities->amount(), 4);

        return (float) $ratio;
    }

    /**
     * Calculate Quick Ratio: Quick Assets (Current Assets - Inventory) / Current Liabilities.
     * Returns null if current liabilities <= 0.
     */
    public static function calculateQuickRatio(Money $quickAssets, Money $currentLiabilities): ?float
    {
        if ($currentLiabilities->isZero() || $currentLiabilities->isNegative()) {
            return null;
        }

        $ratio = bcdiv($quickAssets->amount(), $currentLiabilities->amount(), 4);

        return (float) $ratio;
    }

    /**
     * Calculate Debt-to-Assets Ratio: Total Debt / Total Assets.
     * Total Debt comprises short-term and long-term liabilities.
     * Total Assets comprises current assets and fixed assets.
     * Returns null if total assets <= 0.
     */
    public static function calculateDebtToAssets(Money $totalDebt, Money $totalAssets): ?float
    {
        if ($totalAssets->isZero() || $totalAssets->isNegative()) {
            return null;
        }

        $ratio = bcdiv($totalDebt->amount(), $totalAssets->amount(), 4);

        return (float) $ratio;
    }

    /**
     * Calculate Current, Quick, and Debt-to-Assets balance sheet ratios directly from a collection of records.
     *
     * @param array<FinancialRecord> $records
     * @return array{
     *     current_ratio: ?float,
     *     quick_ratio: ?float,
     *     debt_to_assets: ?float,
     *     current_assets: Money,
     *     quick_assets: Money,
     *     current_liabilities: Money,
     *     total_assets: Money,
     *     total_debt: Money
     * }
     */
    public static function calculateBalanceRatiosFromRecords(
        array $records,
        Currency $currency = Currency::PLN
    ): array {
        $currentAssets = Money::zero($currency);
        $quickAssets = Money::zero($currency);
        $fixedAssets = Money::zero($currency);
        $currentLiabilities = Money::zero($currency);
        $longTermLiabilities = Money::zero($currency);

        foreach ($records as $record) {
            if (!$record instanceof self) {
                continue;
            }

            $amount = $record->amount();

            if ($record->isCurrentAsset()) {
                $currentAssets = $currentAssets->add($amount);
            }

            if ($record->isQuickAsset()) {
                $quickAssets = $quickAssets->add($amount);
            }

            if ($record->isFixedAsset()) {
                $fixedAssets = $fixedAssets->add($amount);
            }

            if ($record->isCurrentLiability()) {
                $currentLiabilities = $currentLiabilities->add($amount);
            }

            if ($record->isLongTermLiability()) {
                $longTermLiabilities = $longTermLiabilities->add($amount);
            }
        }

        $totalAssets = $currentAssets->add($fixedAssets);
        $totalDebt = $currentLiabilities->add($longTermLiabilities);

        return [
            'current_ratio' => self::calculateCurrentRatio($currentAssets, $currentLiabilities),
            'quick_ratio' => self::calculateQuickRatio($quickAssets, $currentLiabilities),
            'debt_to_assets' => self::calculateDebtToAssets($totalDebt, $totalAssets),
            'current_assets' => $currentAssets,
            'quick_assets' => $quickAssets,
            'current_liabilities' => $currentLiabilities,
            'total_assets' => $totalAssets,
            'total_debt' => $totalDebt,
        ];
    }
}
