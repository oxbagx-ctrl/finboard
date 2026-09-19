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
            currency: $newAmount->currency()->value,
            companyId: $this->companyId
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

    public function isCogs(): bool
    {
        return $this->category->type()->isCogs();
    }

    public function isOpex(): bool
    {
        return $this->category->type()->isOpex();
    }

    public function isDepreciation(): bool
    {
        return $this->category->type()->isDepreciation();
    }

    public function isFinancial(): bool
    {
        return $this->category->type()->isFinancial();
    }

    public function isTax(): bool
    {
        return $this->category->type()->isTax();
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

    // ==========================================
    // P&L Core Profit & Margin Calculations
    // ==========================================

    /**
     * Calculate Gross Profit: Revenue - COGS
     */
    public static function calculateGrossProfit(Money $revenue, Money $cogs): Money
    {
        return $revenue->subtract($cogs);
    }

    /**
     * Calculate Gross Margin: Gross Profit / Revenue.
     * Returns null if revenue <= 0 to prevent division by zero or nonsensical margins.
     */
    public static function calculateGrossMargin(Money $grossProfit, Money $revenue): ?float
    {
        return self::calculateMargin($grossProfit, $revenue);
    }

    /**
     * Calculate EBIT (Operating Profit): Gross Profit - OPEX - Depreciation
     */
    public static function calculateEbit(Money $grossProfit, Money $opex, Money $depreciation): Money
    {
        return $grossProfit->subtract($opex)->subtract($depreciation);
    }

    /**
     * Calculate Operating Margin (EBIT Margin): EBIT / Revenue.
     * Returns null if revenue <= 0.
     */
    public static function calculateOperatingMargin(Money $ebit, Money $revenue): ?float
    {
        return self::calculateMargin($ebit, $revenue);
    }

    /**
     * Calculate EBIT Margin alias.
     */
    public static function calculateEbitMargin(Money $ebit, Money $revenue): ?float
    {
        return self::calculateOperatingMargin($ebit, $revenue);
    }

    /**
     * Calculate EBITDA: EBIT + Depreciation
     */
    public static function calculateEbitda(Money $ebit, Money $depreciation): Money
    {
        return $ebit->add($depreciation);
    }

    /**
     * Calculate EBITDA Margin: EBITDA / Revenue.
     * Returns null if revenue <= 0.
     */
    public static function calculateEbitdaMargin(Money $ebitda, Money $revenue): ?float
    {
        return self::calculateMargin($ebitda, $revenue);
    }

    /**
     * Calculate Net Profit: EBIT - Financial Costs - Tax
     */
    public static function calculateNetProfit(Money $ebit, Money $financialCosts, Money $tax): Money
    {
        return $ebit->subtract($financialCosts)->subtract($tax);
    }

    /**
     * Calculate Net Margin: Net Profit / Revenue.
     * Returns null if revenue <= 0.
     */
    public static function calculateNetMargin(Money $netProfit, Money $revenue): ?float
    {
        return self::calculateMargin($netProfit, $revenue);
    }

    /**
     * Calculate generic financial margin: Numerator / Denominator (Revenue).
     * Returns null if denominator is zero or negative.
     */
    public static function calculateMargin(Money $numerator, Money $denominator): ?float
    {
        if ($denominator->isZero() || $denominator->isNegative()) {
            return null;
        }

        $result = bcdiv($numerator->amount(), $denominator->amount(), 6);

        return (float) $result;
    }

    /**
     * Calculate P&L metrics directly from a collection of records.
     *
     * @param array<FinancialRecord> $records
     * @return array{
     *     revenue: Money,
     *     cogs: Money,
     *     gross_profit: Money,
     *     gross_margin: ?float,
     *     opex: Money,
     *     depreciation: Money,
     *     ebit: Money,
     *     operating_margin: ?float,
     *     ebitda: Money,
     *     ebitda_margin: ?float,
     *     financial_costs: Money,
     *     tax: Money,
     *     net_profit: Money,
     *     net_margin: ?float
     * }
     */
    public static function calculatePnlFromRecords(
        array $records,
        Currency $currency = Currency::PLN
    ): array {
        $revenue = Money::zero($currency);
        $cogs = Money::zero($currency);
        $opex = Money::zero($currency);
        $depreciation = Money::zero($currency);
        $financialCosts = Money::zero($currency);
        $tax = Money::zero($currency);

        foreach ($records as $record) {
            if (!$record instanceof self) {
                continue;
            }

            $amount = $record->amount();
            $categoryType = $record->category()->type();

            match ($categoryType) {
                CategoryType::REVENUE => $revenue = $revenue->add($amount),
                CategoryType::COGS => $cogs = $cogs->add($amount),
                CategoryType::OPEX => $opex = $opex->add($amount),
                CategoryType::DEPRECIATION => $depreciation = $depreciation->add($amount),
                CategoryType::FINANCIAL => $financialCosts = $financialCosts->add($amount),
                CategoryType::TAX => $tax = $tax->add($amount),
                default => null,
            };
        }

        $grossProfit = self::calculateGrossProfit($revenue, $cogs);
        $grossMargin = self::calculateGrossMargin($grossProfit, $revenue);

        $ebit = self::calculateEbit($grossProfit, $opex, $depreciation);
        $operatingMargin = self::calculateOperatingMargin($ebit, $revenue);

        $ebitda = self::calculateEbitda($ebit, $depreciation);
        $ebitdaMargin = self::calculateEbitdaMargin($ebitda, $revenue);

        $netProfit = self::calculateNetProfit($ebit, $financialCosts, $tax);
        $netMargin = self::calculateNetMargin($netProfit, $revenue);

        return [
            'revenue' => $revenue,
            'cogs' => $cogs,
            'gross_profit' => $grossProfit,
            'gross_margin' => $grossMargin,
            'opex' => $opex,
            'depreciation' => $depreciation,
            'ebit' => $ebit,
            'operating_margin' => $operatingMargin,
            'ebitda' => $ebitda,
            'ebitda_margin' => $ebitdaMargin,
            'financial_costs' => $financialCosts,
            'tax' => $tax,
            'net_profit' => $netProfit,
            'net_margin' => $netMargin,
        ];
    }

    // ==========================================
    // Balance Sheet & Liquidity Calculations
    // ==========================================

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
