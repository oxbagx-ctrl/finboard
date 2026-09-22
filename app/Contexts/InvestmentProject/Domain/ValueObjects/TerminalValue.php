<?php

declare(strict_types=1);

namespace App\Contexts\InvestmentProject\Domain\ValueObjects;

use App\Contexts\Finance\Domain\ValueObjects\Currency;
use App\Contexts\Finance\Domain\ValueObjects\Money;
use App\Shared\Domain\ValueObject;

final class TerminalValue implements ValueObject
{
    public function __construct(
        private readonly TerminalValueMethod $method,
        private readonly float $parameter,
        private readonly Money $enterpriseValue,
        private readonly Money $discountedEnterpriseValue,
        private readonly Money $equityValue,
        private readonly Money $discountedEquityValue
    ) {
    }

    public function method(): TerminalValueMethod
    {
        return $this->method;
    }

    public function parameter(): float
    {
        return $this->parameter;
    }

    public function enterpriseValue(): Money
    {
        return $this->enterpriseValue;
    }

    public function discountedEnterpriseValue(): Money
    {
        return $this->discountedEnterpriseValue;
    }

    public function equityValue(): Money
    {
        return $this->equityValue;
    }

    public function discountedEquityValue(): Money
    {
        return $this->discountedEquityValue;
    }

    public function currency(): Currency
    {
        return $this->enterpriseValue->currency();
    }

    public function equals(ValueObject $other): bool
    {
        if (!$other instanceof self) {
            return false;
        }

        return $this->method === $other->method
            && abs($this->parameter - $other->parameter) < 0.0001
            && $this->enterpriseValue->equals($other->enterpriseValue)
            && $this->discountedEnterpriseValue->equals($other->discountedEnterpriseValue)
            && $this->equityValue->equals($other->equityValue)
            && $this->discountedEquityValue->equals($other->discountedEquityValue);
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'method' => $this->method->value,
            'method_label' => $this->method->label(),
            'parameter' => $this->parameter,
            'enterprise_value' => $this->enterpriseValue->amount(),
            'discounted_enterprise_value' => $this->discountedEnterpriseValue->amount(),
            'equity_value' => $this->equityValue->amount(),
            'discounted_equity_value' => $this->discountedEquityValue->amount(),
            'currency' => $this->currency()->value,
        ];
    }
}
