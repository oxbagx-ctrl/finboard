<?php

declare(strict_types=1);

namespace App\Contexts\InvestmentProject\Domain\ValueObjects;

use App\Contexts\Finance\Domain\ValueObjects\Money;
use App\Shared\Domain\ValueObject;
use InvalidArgumentException;

final class ProjectBudget implements ValueObject
{
    private Money $netCapex;
    private Money $equityContribution;
    private Money $bankLoanAmount;
    private Money $grantAmount;
    private Money $vatBridgeLoan;

    public function __construct(
        Money $netCapex,
        Money $equityContribution,
        Money $bankLoanAmount,
        ?Money $grantAmount = null,
        ?Money $vatBridgeLoan = null
    ) {
        $currency = $netCapex->currency();

        $this->grantAmount = $grantAmount ?? Money::zero($currency);
        $this->vatBridgeLoan = $vatBridgeLoan ?? Money::zero($currency);

        if ($netCapex->isNegative()) {
            throw new InvalidArgumentException('Net CAPEX cannot be negative.');
        }

        if ($equityContribution->isNegative()) {
            throw new InvalidArgumentException('Equity contribution cannot be negative.');
        }

        if ($bankLoanAmount->isNegative()) {
            throw new InvalidArgumentException('Bank loan amount cannot be negative.');
        }

        if ($this->grantAmount->isNegative()) {
            throw new InvalidArgumentException('Grant amount cannot be negative.');
        }

        if ($this->vatBridgeLoan->isNegative()) {
            throw new InvalidArgumentException('VAT bridge loan cannot be negative.');
        }

        $this->netCapex = $netCapex;
        $this->equityContribution = $equityContribution;
        $this->bankLoanAmount = $bankLoanAmount;
    }

    public static function create(
        Money $netCapex,
        Money $equityContribution,
        Money $bankLoanAmount,
        ?Money $grantAmount = null,
        ?Money $vatBridgeLoan = null
    ): self {
        return new self($netCapex, $equityContribution, $bankLoanAmount, $grantAmount, $vatBridgeLoan);
    }

    public function netCapex(): Money
    {
        return $this->netCapex;
    }

    public function equityContribution(): Money
    {
        return $this->equityContribution;
    }

    public function bankLoanAmount(): Money
    {
        return $this->bankLoanAmount;
    }

    public function grantAmount(): Money
    {
        return $this->grantAmount;
    }

    public function vatBridgeLoan(): Money
    {
        return $this->vatBridgeLoan;
    }

    /**
     * Total Net Financing arranged: Equity + Bank Loan + Grant.
     */
    public function totalFinancing(): Money
    {
        return $this->equityContribution
            ->add($this->bankLoanAmount)
            ->add($this->grantAmount);
    }

    /**
     * Funding gap between Net CAPEX and Total Financing.
     * Returns zero if fully funded or positive if underfunded.
     */
    public function fundingGap(): Money
    {
        $total = $this->totalFinancing();

        if ($total->greaterThanOrEqual($this->netCapex)) {
            return Money::zero($this->netCapex->currency());
        }

        return $this->netCapex->subtract($total);
    }

    public function isFullyFunded(): bool
    {
        return $this->totalFinancing()->greaterThanOrEqual($this->netCapex);
    }

    /**
     * Equity Ratio (Wskaźnik wkładu własnego): Equity / Net CAPEX in %.
     */
    public function equityRatio(): float
    {
        if ($this->netCapex->isZero()) {
            return 0.0;
        }

        return round(($this->equityContribution->toDecimal() / $this->netCapex->toDecimal()) * 100.0, 2);
    }

    /**
     * Leverage Ratio (Udział kredytu bankowego): Bank Loan / Net CAPEX in %.
     */
    public function leverageRatio(): float
    {
        if ($this->netCapex->isZero()) {
            return 0.0;
        }

        return round(($this->bankLoanAmount->toDecimal() / $this->netCapex->toDecimal()) * 100.0, 2);
    }

    /**
     * Grant Co-Financing Ratio (Udział dotacji): Grant / Net CAPEX in %.
     */
    public function grantRatio(): float
    {
        if ($this->netCapex->isZero()) {
            return 0.0;
        }

        return round(($this->grantAmount->toDecimal() / $this->netCapex->toDecimal()) * 100.0, 2);
    }

    /**
     * Total Gross CAPEX including VAT tax.
     */
    public function totalGrossCapex(VatRate $vatRate): Money
    {
        return $vatRate->calculateGross($this->netCapex);
    }

    /**
     * Total VAT tax required for construction/procurement.
     */
    public function totalVatRequired(VatRate $vatRate): Money
    {
        return $vatRate->calculateVat($this->netCapex);
    }

    public function equals(ValueObject $other): bool
    {
        return $other instanceof self
            && $this->netCapex->equals($other->netCapex)
            && $this->equityContribution->equals($other->equityContribution)
            && $this->bankLoanAmount->equals($other->bankLoanAmount)
            && $this->grantAmount->equals($other->grantAmount)
            && $this->vatBridgeLoan->equals($other->vatBridgeLoan);
    }
}
