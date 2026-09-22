<?php

declare(strict_types=1);

namespace App\Contexts\InvestmentProject\Domain\Entities;

use App\Contexts\Finance\Domain\ValueObjects\Money;
use App\Contexts\InvestmentProject\Domain\ValueObjects\AmortizationType;
use App\Contexts\InvestmentProject\Domain\ValueObjects\DebtFacilityId;
use App\Contexts\InvestmentProject\Domain\ValueObjects\InterestMargin;
use App\Contexts\InvestmentProject\Domain\ValueObjects\LoanTenor;
use App\Shared\Domain\Entity;
use DateTimeImmutable;
use InvalidArgumentException;

final class DebtFacility extends Entity
{
    private DebtFacilityId $id;
    private string $name;
    private Money $committedAmount;
    private InterestMargin $margin;
    private float $baseRate;
    private LoanTenor $tenor;
    private AmortizationType $amortizationType;
    private float $upfrontFeeRate;
    private DateTimeImmutable $drawdownDate;

    public function __construct(
        DebtFacilityId $id,
        string $name,
        Money $committedAmount,
        InterestMargin $margin,
        float $baseRate,
        LoanTenor $tenor,
        AmortizationType $amortizationType = AmortizationType::ANNUITY,
        float $upfrontFeeRate = 0.0,
        ?DateTimeImmutable $drawdownDate = null
    ) {
        $trimmedName = trim($name);
        if ($trimmedName === '') {
            throw new InvalidArgumentException('DebtFacility name cannot be empty.');
        }

        if ($committedAmount->isNegative()) {
            throw new InvalidArgumentException('Committed debt amount cannot be negative.');
        }

        if ($baseRate < 0.0 || $baseRate > 50.0) {
            throw new InvalidArgumentException(
                sprintf('Base interest rate must be between 0.0%% and 50.0%%, %.2f%% given.', $baseRate)
            );
        }

        if ($upfrontFeeRate < 0.0 || $upfrontFeeRate > 10.0) {
            throw new InvalidArgumentException(
                sprintf('Upfront arrangement fee must be between 0.0%% and 10.0%%, %.2f%% given.', $upfrontFeeRate)
            );
        }

        $this->id = $id;
        $this->name = $trimmedName;
        $this->committedAmount = $committedAmount;
        $this->margin = $margin;
        $this->baseRate = round($baseRate, 4);
        $this->tenor = $tenor;
        $this->amortizationType = $amortizationType;
        $this->upfrontFeeRate = round($upfrontFeeRate, 2);
        $this->drawdownDate = $drawdownDate ?? new DateTimeImmutable();
    }

    public static function create(
        DebtFacilityId $id,
        string $name,
        Money $committedAmount,
        InterestMargin $margin,
        float $baseRate,
        LoanTenor $tenor,
        AmortizationType $amortizationType = AmortizationType::ANNUITY,
        float $upfrontFeeRate = 0.0,
        ?DateTimeImmutable $drawdownDate = null
    ): self {
        return new self(
            $id,
            $name,
            $committedAmount,
            $margin,
            $baseRate,
            $tenor,
            $amortizationType,
            $upfrontFeeRate,
            $drawdownDate
        );
    }

    public function id(): string
    {
        return $this->id->value();
    }

    public function facilityId(): DebtFacilityId
    {
        return $this->id;
    }

    public function name(): string
    {
        return $this->name;
    }

    public function committedAmount(): Money
    {
        return $this->committedAmount;
    }

    public function margin(): InterestMargin
    {
        return $this->margin;
    }

    public function baseRate(): float
    {
        return $this->baseRate;
    }

    public function tenor(): LoanTenor
    {
        return $this->tenor;
    }

    public function amortizationType(): AmortizationType
    {
        return $this->amortizationType;
    }

    public function upfrontFeeRate(): float
    {
        return $this->upfrontFeeRate;
    }

    public function drawdownDate(): DateTimeImmutable
    {
        return $this->drawdownDate;
    }

    /**
     * Combined nominal annual interest rate: Base Rate (e.g. WIBOR) + Bank Margin.
     */
    public function nominalAnnualRate(): float
    {
        return $this->margin->combinedRate($this->baseRate);
    }

    /**
     * Monthly nominal interest rate.
     */
    public function monthlyRate(): float
    {
        return $this->margin->monthlyRate($this->baseRate);
    }

    /**
     * Bank upfront arrangement commission amount.
     */
    public function upfrontFeeAmount(): Money
    {
        return $this->committedAmount->multiply($this->upfrontFeeRate / 100.0);
    }

    public function repaymentMonths(): int
    {
        return $this->tenor->repaymentMonths();
    }

    public function gracePeriodMonths(): int
    {
        return $this->tenor->gracePeriodMonths();
    }

    public function updateParameters(
        string $name,
        Money $committedAmount,
        InterestMargin $margin,
        float $baseRate,
        LoanTenor $tenor,
        AmortizationType $amortizationType,
        float $upfrontFeeRate,
        DateTimeImmutable $drawdownDate
    ): void {
        $trimmedName = trim($name);
        if ($trimmedName === '') {
            throw new InvalidArgumentException('DebtFacility name cannot be empty.');
        }

        if ($committedAmount->isNegative()) {
            throw new InvalidArgumentException('Committed debt amount cannot be negative.');
        }

        if ($baseRate < 0.0 || $baseRate > 50.0) {
            throw new InvalidArgumentException('Base interest rate must be between 0.0% and 50.0%.');
        }

        if ($upfrontFeeRate < 0.0 || $upfrontFeeRate > 10.0) {
            throw new InvalidArgumentException('Upfront arrangement fee must be between 0.0% and 10.0%.');
        }

        $this->name = $trimmedName;
        $this->committedAmount = $committedAmount;
        $this->margin = $margin;
        $this->baseRate = round($baseRate, 4);
        $this->tenor = $tenor;
        $this->amortizationType = $amortizationType;
        $this->upfrontFeeRate = round($upfrontFeeRate, 2);
        $this->drawdownDate = $drawdownDate;
    }
}
