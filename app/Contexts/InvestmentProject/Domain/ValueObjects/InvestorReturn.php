<?php

declare(strict_types=1);

namespace App\Contexts\InvestmentProject\Domain\ValueObjects;

use App\Contexts\Finance\Domain\ValueObjects\Currency;
use App\Contexts\Finance\Domain\ValueObjects\Money;
use App\Shared\Domain\ValueObject;
use InvalidArgumentException;

final class InvestorReturn implements ValueObject
{
    /** @var array<int, Money> */
    private array $annualDistributions;

    /**
     * @param array<int, Money> $annualDistributions Year => Distributed Money
     */
    public function __construct(
        private readonly int $investorIndex,
        private readonly string $investorName,
        private readonly Money $initialEquity,
        private readonly float $equitySharePercent,
        array $annualDistributions,
        private readonly Money $exitDistribution,
        private readonly Money $totalDistributions,
        private readonly Money $netProfit,
        private readonly float $moic,
        private readonly ?float $irr,
        private readonly Money $npv,
        private readonly ?float $simplePaybackYears,
        private readonly ?float $discountedPaybackYears
    ) {
        if ($this->investorIndex < 1 || $this->investorIndex > 2) {
            throw new InvalidArgumentException(
                sprintf('Investor index must be 1 or 2, %d given.', $this->investorIndex)
            );
        }

        $this->annualDistributions = $annualDistributions;
    }

    public function investorIndex(): int
    {
        return $this->investorIndex;
    }

    public function investorName(): string
    {
        return $this->investorName;
    }

    public function initialEquity(): Money
    {
        return $this->initialEquity;
    }

    public function equitySharePercent(): float
    {
        return $this->equitySharePercent;
    }

    /**
     * @return array<int, Money>
     */
    public function annualDistributions(): array
    {
        return $this->annualDistributions;
    }

    public function annualDistribution(int $year): Money
    {
        return $this->annualDistributions[$year] ?? Money::zero($this->initialEquity->currency());
    }

    public function exitDistribution(): Money
    {
        return $this->exitDistribution;
    }

    public function totalDistributions(): Money
    {
        return $this->totalDistributions;
    }

    public function netProfit(): Money
    {
        return $this->netProfit;
    }

    public function moic(): float
    {
        return $this->moic;
    }

    public function irr(): ?float
    {
        return $this->irr;
    }

    public function npv(): Money
    {
        return $this->npv;
    }

    public function simplePaybackYears(): ?float
    {
        return $this->simplePaybackYears;
    }

    public function discountedPaybackYears(): ?float
    {
        return $this->discountedPaybackYears;
    }

    public function currency(): Currency
    {
        return $this->initialEquity->currency();
    }

    public function isProfitable(): bool
    {
        return $this->netProfit->isPositive();
    }

    public function equals(ValueObject $other): bool
    {
        if (!$other instanceof self) {
            return false;
        }

        return $this->investorIndex === $other->investorIndex
            && $this->initialEquity->equals($other->initialEquity)
            && $this->totalDistributions->equals($other->totalDistributions)
            && abs($this->moic - $other->moic) < 0.001
            && abs(($this->irr ?? -1.0) - ($other->irr ?? -1.0)) < 0.001;
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        $annual = [];
        foreach ($this->annualDistributions as $year => $money) {
            $annual[$year] = $money->amount();
        }

        return [
            'investor_index' => $this->investorIndex,
            'investor_name' => $this->investorName,
            'initial_equity' => $this->initialEquity->amount(),
            'equity_share_percent' => $this->equitySharePercent,
            'annual_distributions' => $annual,
            'exit_distribution' => $this->exitDistribution->amount(),
            'total_distributions' => $this->totalDistributions->amount(),
            'net_profit' => $this->netProfit->amount(),
            'moic' => $this->moic,
            'irr_percent' => $this->irr,
            'npv' => $this->npv->amount(),
            'simple_payback_years' => $this->simplePaybackYears,
            'discounted_payback_years' => $this->discountedPaybackYears,
            'is_profitable' => $this->isProfitable(),
            'currency' => $this->currency()->value,
        ];
    }
}
