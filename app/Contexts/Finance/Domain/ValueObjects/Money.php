<?php

declare(strict_types=1);

namespace App\Contexts\Finance\Domain\ValueObjects;

use App\Contexts\Finance\Domain\Exceptions\CurrencyMismatchException;
use App\Shared\Domain\ValueObject;
use InvalidArgumentException;

final class Money implements ValueObject
{
    public const SCALE = 4;

    private string $amount;
    private Currency $currency;

    public function __construct(string|int|float $amount, Currency|string $currency = Currency::PLN)
    {
        $this->currency = is_string($currency) ? Currency::from($currency) : $currency;
        $this->amount = $this->normalizeAmount($amount);
    }

    public static function fromDecimal(string|int|float $amount, Currency|string $currency = Currency::PLN): self
    {
        return new self($amount, $currency);
    }

    public static function fromCents(int $cents, Currency|string $currency = Currency::PLN): self
    {
        $amount = bcdiv((string) $cents, '100', self::SCALE);

        return new self($amount, $currency);
    }

    public static function zero(Currency|string $currency = Currency::PLN): self
    {
        return new self('0.0000', $currency);
    }

    public function amount(): string
    {
        return $this->amount;
    }

    public function toDecimal(): float
    {
        return (float) $this->amount;
    }

    public function toCents(): int
    {
        $cents = bcmul($this->amount, '100', 0);

        return (int) $cents;
    }

    public function currency(): Currency
    {
        return $this->currency;
    }

    public function add(self $other): self
    {
        $this->assertSameCurrency($other);

        $newAmount = bcadd($this->amount, $other->amount, self::SCALE);

        return new self($newAmount, $this->currency);
    }

    public function subtract(self $other): self
    {
        $this->assertSameCurrency($other);

        $newAmount = bcsub($this->amount, $other->amount, self::SCALE);

        return new self($newAmount, $this->currency);
    }

    public function multiply(string|int|float $multiplier, int $scale = self::SCALE): self
    {
        $normalizedMultiplier = is_float($multiplier) ? sprintf('%.8f', $multiplier) : (string) $multiplier;
        $newAmount = bcmul($this->amount, $normalizedMultiplier, $scale);

        return new self($newAmount, $this->currency);
    }

    public function divide(string|int|float $divisor, int $scale = self::SCALE): self
    {
        $normalizedDivisor = is_float($divisor) ? sprintf('%.8f', $divisor) : (string) $divisor;

        if (bccomp($normalizedDivisor, '0', 8) === 0) {
            throw new InvalidArgumentException('Division by zero is not allowed in Money calculations.');
        }

        $newAmount = bcdiv($this->amount, $normalizedDivisor, $scale);

        return new self($newAmount, $this->currency);
    }

    public function equals(ValueObject $other): bool
    {
        if (!$other instanceof self) {
            return false;
        }

        return $this->currency === $other->currency
            && bccomp($this->amount, $other->amount, self::SCALE) === 0;
    }

    public function greaterThan(self $other): bool
    {
        $this->assertSameCurrency($other);

        return bccomp($this->amount, $other->amount, self::SCALE) === 1;
    }

    public function greaterThanOrEqual(self $other): bool
    {
        $this->assertSameCurrency($other);

        return bccomp($this->amount, $other->amount, self::SCALE) >= 0;
    }

    public function lessThan(self $other): bool
    {
        $this->assertSameCurrency($other);

        return bccomp($this->amount, $other->amount, self::SCALE) === -1;
    }

    public function lessThanOrEqual(self $other): bool
    {
        $this->assertSameCurrency($other);

        return bccomp($this->amount, $other->amount, self::SCALE) <= 0;
    }

    public function isZero(): bool
    {
        return bccomp($this->amount, '0', self::SCALE) === 0;
    }

    public function isPositive(): bool
    {
        return bccomp($this->amount, '0', self::SCALE) === 1;
    }

    public function isNegative(): bool
    {
        return bccomp($this->amount, '0', self::SCALE) === -1;
    }

    public function format(int $decimals = 2, string $decPoint = ',', string $thousandsSep = ' '): string
    {
        return number_format((float) $this->amount, $decimals, $decPoint, $thousandsSep) . ' ' . $this->currency->value;
    }

    public function __toString(): string
    {
        return sprintf('%s %s', $this->amount, $this->currency->value);
    }

    private function assertSameCurrency(self $other): void
    {
        if ($this->currency !== $other->currency) {
            throw CurrencyMismatchException::create($this->currency->value, $other->currency->value);
        }
    }

    private function normalizeAmount(string|int|float $amount): string
    {
        if (is_float($amount)) {
            $formatted = sprintf('%.8f', $amount);
        } else {
            $formatted = trim((string) $amount);
        }

        if (!is_numeric($formatted)) {
            throw new InvalidArgumentException(sprintf('Invalid monetary amount provided: "%s".', $amount));
        }

        // Standardize to SCALE decimals via bcadd with 0
        return bcadd($formatted, '0', self::SCALE);
    }
}
