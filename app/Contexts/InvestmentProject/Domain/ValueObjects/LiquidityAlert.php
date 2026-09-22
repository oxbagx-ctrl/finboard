<?php

declare(strict_types=1);

namespace App\Contexts\InvestmentProject\Domain\ValueObjects;

use App\Contexts\Finance\Domain\ValueObjects\Money;
use App\Shared\Domain\ValueObject;
use DateTimeImmutable;
use InvalidArgumentException;

final class LiquidityAlert implements ValueObject
{
    public const SEVERITY_INFO = 'INFO';
    public const SEVERITY_WARNING = 'WARNING';
    public const SEVERITY_CRITICAL = 'CRITICAL';

    public function __construct(
        private readonly int $periodNumber,
        private readonly int $year,
        private readonly DateTimeImmutable $date,
        private readonly string $severity,
        private readonly string $code,
        private readonly string $message,
        private readonly Money $deficitAmount,
        private readonly Money $facilityLimit,
        private readonly Money $facilityBalance
    ) {
        if ($this->periodNumber < 1) {
            throw new InvalidArgumentException(
                sprintf('Period number must be >= 1, %d given.', $this->periodNumber)
            );
        }

        if (!in_array($this->severity, [self::SEVERITY_INFO, self::SEVERITY_WARNING, self::SEVERITY_CRITICAL], true)) {
            throw new InvalidArgumentException(
                sprintf('Invalid severity "%s". Expected INFO, WARNING, or CRITICAL.', $this->severity)
            );
        }

        if (trim($this->code) === '') {
            throw new InvalidArgumentException('Alert code cannot be empty.');
        }

        if (trim($this->message) === '') {
            throw new InvalidArgumentException('Alert message cannot be empty.');
        }
    }

    public function periodNumber(): int
    {
        return $this->periodNumber;
    }

    public function year(): int
    {
        return $this->year;
    }

    public function date(): DateTimeImmutable
    {
        return $this->date;
    }

    public function severity(): string
    {
        return $this->severity;
    }

    public function code(): string
    {
        return $this->code;
    }

    public function message(): string
    {
        return $this->message;
    }

    public function deficitAmount(): Money
    {
        return $this->deficitAmount;
    }

    public function facilityLimit(): Money
    {
        return $this->facilityLimit;
    }

    public function facilityBalance(): Money
    {
        return $this->facilityBalance;
    }

    public function isCritical(): bool
    {
        return $this->severity === self::SEVERITY_CRITICAL;
    }

    public function isWarning(): bool
    {
        return $this->severity === self::SEVERITY_WARNING;
    }

    public function isInfo(): bool
    {
        return $this->severity === self::SEVERITY_INFO;
    }

    public function equals(ValueObject $other): bool
    {
        if (!$other instanceof self) {
            return false;
        }

        return $this->periodNumber === $other->periodNumber
            && $this->year === $other->year
            && $this->severity === $other->severity
            && $this->code === $other->code
            && $this->deficitAmount->equals($other->deficitAmount)
            && $this->facilityBalance->equals($other->facilityBalance);
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'period_number' => $this->periodNumber,
            'year' => $this->year,
            'date' => $this->date->format('Y-m-d'),
            'severity' => $this->severity,
            'code' => $this->code,
            'message' => $this->message,
            'deficit_amount' => $this->deficitAmount->amount(),
            'facility_limit' => $this->facilityLimit->amount(),
            'facility_balance' => $this->facilityBalance->amount(),
            'currency' => $this->deficitAmount->currency()->value,
        ];
    }
}
