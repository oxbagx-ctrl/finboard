<?php

declare(strict_types=1);

namespace App\Contexts\InvestmentProject\Domain\ValueObjects;

use App\Contexts\Finance\Domain\ValueObjects\Money;
use App\Shared\Domain\ValueObject;
use InvalidArgumentException;

final class WorkingCapitalDays implements ValueObject
{
    private int $dso;
    private int $dpo;
    private int $dio;

    public function __construct(int $dso = 30, int $dpo = 30, int $dio = 0)
    {
        $this->assertValidDays($dso, 'DSO (Days Sales Outstanding)');
        $this->assertValidDays($dpo, 'DPO (Days Payable Outstanding)');
        $this->assertValidDays($dio, 'DIO (Days Inventory Outstanding)');

        $this->dso = $dso;
        $this->dpo = $dpo;
        $this->dio = $dio;
    }

    public static function fromParams(int $dso = 30, int $dpo = 30, int $dio = 0): self
    {
        return new self($dso, $dpo, $dio);
    }

    public function dso(): int
    {
        return $this->dso;
    }

    public function dpo(): int
    {
        return $this->dpo;
    }

    public function dio(): int
    {
        return $this->dio;
    }

    /**
     * Cash Conversion Cycle (Cykl konwersji gotówki): DIO + DSO - DPO
     */
    public function cashConversionCycle(): int
    {
        return $this->dio + $this->dso - $this->dpo;
    }

    /**
     * Calculate required trade receivables balance based on annual revenue.
     */
    public function calculateReceivables(Money $annualRevenue): Money
    {
        if ($this->dso === 0) {
            return Money::zero($annualRevenue->currency());
        }

        return $annualRevenue->multiply($this->dso)->divide(365);
    }

    /**
     * Calculate trade payables balance based on annual operating expenses.
     */
    public function calculatePayables(Money $annualOpex): Money
    {
        if ($this->dpo === 0) {
            return Money::zero($annualOpex->currency());
        }

        return $annualOpex->multiply($this->dpo)->divide(365);
    }

    /**
     * Calculate inventory balance based on annual cost of goods sold (COGS).
     */
    public function calculateInventory(Money $annualCogs): Money
    {
        if ($this->dio === 0) {
            return Money::zero($annualCogs->currency());
        }

        return $annualCogs->multiply($this->dio)->divide(365);
    }

    /**
     * Calculate Net Working Capital requirement: Receivables + Inventory - Payables.
     */
    public function calculateNetWorkingCapital(Money $annualRevenue, Money $annualOpex, Money $annualCogs): Money
    {
        $receivables = $this->calculateReceivables($annualRevenue);
        $inventory = $this->calculateInventory($annualCogs);
        $payables = $this->calculatePayables($annualOpex);

        return $receivables->add($inventory)->subtract($payables);
    }

    public function equals(ValueObject $other): bool
    {
        return $other instanceof self
            && $this->dso === $other->dso
            && $this->dpo === $other->dpo
            && $this->dio === $other->dio;
    }

    private function assertValidDays(int $days, string $paramName): void
    {
        if ($days < 0 || $days > 365) {
            throw new InvalidArgumentException(
                sprintf('%s must be between 0 and 365 days, %d given.', $paramName, $days)
            );
        }
    }

    public function __toString(): string
    {
        return sprintf('DSO: %dd, DPO: %dd, DIO: %dd (CCC: %dd)', $this->dso, $this->dpo, $this->dio, $this->cashConversionCycle());
    }
}
