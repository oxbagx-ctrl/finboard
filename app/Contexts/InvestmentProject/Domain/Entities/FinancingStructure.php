<?php

declare(strict_types=1);

namespace App\Contexts\InvestmentProject\Domain\Entities;

use App\Contexts\Finance\Domain\ValueObjects\Money;
use App\Shared\Domain\Entity;
use InvalidArgumentException;
use Ramsey\Uuid\Uuid;

final class FinancingStructure extends Entity
{
    private string $id;
    private Money $investor1Equity;
    private Money $investor2Equity;
    private Money $grantAmount;
    private float $grantIntensityPercent;
    private Money $vatBridgeLoanAmount;

    public function __construct(
        string $id,
        Money $investor1Equity,
        ?Money $investor2Equity = null,
        ?Money $grantAmount = null,
        float $grantIntensityPercent = 0.0,
        ?Money $vatBridgeLoanAmount = null
    ) {
        $currency = $investor1Equity->currency();

        $inv2 = $investor2Equity ?? Money::zero($currency);
        $grant = $grantAmount ?? Money::zero($currency);
        $vatLoan = $vatBridgeLoanAmount ?? Money::zero($currency);

        if ($investor1Equity->isNegative() || $inv2->isNegative()) {
            throw new InvalidArgumentException('Equity contribution cannot be negative.');
        }

        if ($grant->isNegative()) {
            throw new InvalidArgumentException('Grant amount cannot be negative.');
        }

        if ($vatLoan->isNegative()) {
            throw new InvalidArgumentException('VAT bridge loan amount cannot be negative.');
        }

        if ($grantIntensityPercent < 0.0 || $grantIntensityPercent > 100.0) {
            throw new InvalidArgumentException(
                sprintf('Grant co-financing intensity must be between 0.0%% and 100.0%%, %.2f%% given.', $grantIntensityPercent)
            );
        }

        $this->id = $id;
        $this->investor1Equity = $investor1Equity;
        $this->investor2Equity = $inv2;
        $this->grantAmount = $grant;
        $this->grantIntensityPercent = round($grantIntensityPercent, 2);
        $this->vatBridgeLoanAmount = $vatLoan;
    }

    public static function create(
        Money $investor1Equity,
        ?Money $investor2Equity = null,
        ?Money $grantAmount = null,
        float $grantIntensityPercent = 0.0,
        ?Money $vatBridgeLoanAmount = null,
        ?string $id = null
    ): self {
        return new self(
            $id ?? Uuid::uuid4()->toString(),
            $investor1Equity,
            $investor2Equity,
            $grantAmount,
            $grantIntensityPercent,
            $vatBridgeLoanAmount
        );
    }

    public function id(): string
    {
        return $this->id;
    }

    public function investor1Equity(): Money
    {
        return $this->investor1Equity;
    }

    public function investor2Equity(): Money
    {
        return $this->investor2Equity;
    }

    /**
     * Total Equity injected by all investors: Investor 1 + Investor 2.
     */
    public function totalEquity(): Money
    {
        return $this->investor1Equity->add($this->investor2Equity);
    }

    /**
     * Investor 1 equity share in %.
     */
    public function investor1Share(): float
    {
        $total = $this->totalEquity();
        if ($total->isZero()) {
            return 100.0;
        }

        return round(($this->investor1Equity->toDecimal() / $total->toDecimal()) * 100.0, 2);
    }

    /**
     * Investor 2 equity share in %.
     */
    public function investor2Share(): float
    {
        $total = $this->totalEquity();
        if ($total->isZero()) {
            return 0.0;
        }

        return round(($this->investor2Equity->toDecimal() / $total->toDecimal()) * 100.0, 2);
    }

    public function grantAmount(): Money
    {
        return $this->grantAmount;
    }

    public function grantIntensityPercent(): float
    {
        return $this->grantIntensityPercent;
    }

    public function vatBridgeLoanAmount(): Money
    {
        return $this->vatBridgeLoanAmount;
    }

    public function update(
        Money $investor1Equity,
        Money $investor2Equity,
        Money $grantAmount,
        float $grantIntensityPercent,
        Money $vatBridgeLoanAmount
    ): void {
        if ($investor1Equity->isNegative() || $investor2Equity->isNegative()) {
            throw new InvalidArgumentException('Equity contribution cannot be negative.');
        }

        if ($grantAmount->isNegative()) {
            throw new InvalidArgumentException('Grant amount cannot be negative.');
        }

        if ($vatBridgeLoanAmount->isNegative()) {
            throw new InvalidArgumentException('VAT bridge loan amount cannot be negative.');
        }

        if ($grantIntensityPercent < 0.0 || $grantIntensityPercent > 100.0) {
            throw new InvalidArgumentException('Grant intensity must be between 0.0% and 100.0%.');
        }

        $this->investor1Equity = $investor1Equity;
        $this->investor2Equity = $investor2Equity;
        $this->grantAmount = $grantAmount;
        $this->grantIntensityPercent = round($grantIntensityPercent, 2);
        $this->vatBridgeLoanAmount = $vatBridgeLoanAmount;
    }
}
