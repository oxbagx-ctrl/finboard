<?php

declare(strict_types=1);

namespace App\Contexts\InvestmentProject\Domain\Entities;

use App\Contexts\Finance\Domain\ValueObjects\Money;
use App\Contexts\InvestmentProject\Domain\ValueObjects\CapexStageId;
use App\Contexts\InvestmentProject\Domain\ValueObjects\KstClassification;
use App\Shared\Domain\Entity;
use DateTimeImmutable;
use InvalidArgumentException;

final class CapexStage extends Entity
{
    private CapexStageId $id;
    private string $name;
    private Money $netAmount;
    private DateTimeImmutable $startDate;
    private int $durationMonths;
    private KstClassification $kst;
    private bool $isGrantEligible;
    private Money $grantEligibleAmount;
    private int $stageOrder;

    public function __construct(
        CapexStageId $id,
        string $name,
        Money $netAmount,
        DateTimeImmutable $startDate,
        int $durationMonths = 1,
        ?KstClassification $kst = null,
        bool $isGrantEligible = false,
        ?Money $grantEligibleAmount = null,
        int $stageOrder = 1
    ) {
        $trimmedName = trim($name);
        if ($trimmedName === '') {
            throw new InvalidArgumentException('CapexStage name cannot be empty.');
        }

        if ($netAmount->isNegative()) {
            throw new InvalidArgumentException('CapexStage net amount cannot be negative.');
        }

        if ($durationMonths < 1) {
            throw new InvalidArgumentException(
                sprintf('CapexStage duration must be at least 1 month, %d given.', $durationMonths)
            );
        }

        $currency = $netAmount->currency();
        $eligible = $grantEligibleAmount ?? ($isGrantEligible ? $netAmount : Money::zero($currency));

        if ($eligible->greaterThan($netAmount)) {
            throw new InvalidArgumentException('Grant eligible amount cannot exceed total net stage amount.');
        }

        $this->id = $id;
        $this->name = $trimmedName;
        $this->netAmount = $netAmount;
        $this->startDate = $startDate;
        $this->durationMonths = $durationMonths;
        $this->kst = $kst ?? KstClassification::fromCode('KST_1');
        $this->isGrantEligible = $isGrantEligible;
        $this->grantEligibleAmount = $eligible;
        $this->stageOrder = max(1, $stageOrder);
    }

    public static function create(
        CapexStageId $id,
        string $name,
        Money $netAmount,
        DateTimeImmutable $startDate,
        int $durationMonths = 1,
        ?KstClassification $kst = null,
        bool $isGrantEligible = false,
        ?Money $grantEligibleAmount = null,
        int $stageOrder = 1
    ): self {
        return new self(
            $id,
            $name,
            $netAmount,
            $startDate,
            $durationMonths,
            $kst,
            $isGrantEligible,
            $grantEligibleAmount,
            $stageOrder
        );
    }

    public function id(): string
    {
        return $this->id->value();
    }

    public function stageId(): CapexStageId
    {
        return $this->id;
    }

    public function name(): string
    {
        return $this->name;
    }

    public function netAmount(): Money
    {
        return $this->netAmount;
    }

    public function startDate(): DateTimeImmutable
    {
        return $this->startDate;
    }

    public function durationMonths(): int
    {
        return $this->durationMonths;
    }

    /**
     * Estimated completion date of this CAPEX stage.
     */
    public function completionDate(): DateTimeImmutable
    {
        return $this->startDate->modify(sprintf('+%d months', $this->durationMonths));
    }

    public function kst(): KstClassification
    {
        return $this->kst;
    }

    public function isGrantEligible(): bool
    {
        return $this->isGrantEligible;
    }

    public function grantEligibleAmount(): Money
    {
        return $this->grantEligibleAmount;
    }

    public function stageOrder(): int
    {
        return $this->stageOrder;
    }

    /**
     * Monthly CAPEX disbursement assuming linear expenditure during stage duration.
     */
    public function monthlyCapex(): Money
    {
        return $this->netAmount->divide($this->durationMonths);
    }

    /**
     * Annual linear depreciation based on statutory KST rate.
     */
    public function annualDepreciation(): Money
    {
        if (!$this->kst->isDepreciable()) {
            return Money::zero($this->netAmount->currency());
        }

        return $this->netAmount->multiply($this->kst->depreciationRateDecimal());
    }

    /**
     * Monthly linear depreciation after completion and capitalization.
     */
    public function monthlyDepreciation(): Money
    {
        return $this->annualDepreciation()->divide(12);
    }

    public function updateDetails(
        string $name,
        Money $netAmount,
        DateTimeImmutable $startDate,
        int $durationMonths,
        KstClassification $kst,
        bool $isGrantEligible,
        ?Money $grantEligibleAmount,
        int $stageOrder
    ): void {
        $trimmedName = trim($name);
        if ($trimmedName === '') {
            throw new InvalidArgumentException('CapexStage name cannot be empty.');
        }

        if ($netAmount->isNegative()) {
            throw new InvalidArgumentException('CapexStage net amount cannot be negative.');
        }

        if ($durationMonths < 1) {
            throw new InvalidArgumentException('CapexStage duration must be at least 1 month.');
        }

        $currency = $netAmount->currency();
        $eligible = $grantEligibleAmount ?? ($isGrantEligible ? $netAmount : Money::zero($currency));

        if ($eligible->greaterThan($netAmount)) {
            throw new InvalidArgumentException('Grant eligible amount cannot exceed total net stage amount.');
        }

        $this->name = $trimmedName;
        $this->netAmount = $netAmount;
        $this->startDate = $startDate;
        $this->durationMonths = $durationMonths;
        $this->kst = $kst;
        $this->isGrantEligible = $isGrantEligible;
        $this->grantEligibleAmount = $eligible;
        $this->stageOrder = max(1, $stageOrder);
    }
}
