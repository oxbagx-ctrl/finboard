<?php

declare(strict_types=1);

namespace App\Contexts\Finance\Domain\ValueObjects;

use App\Shared\Domain\ValueObject;
use InvalidArgumentException;
use Ramsey\Uuid\Uuid;

final class FinancialRecordId implements ValueObject
{
    private string $value;

    public function __construct(string $value)
    {
        if (!Uuid::isValid($value)) {
            throw new InvalidArgumentException(sprintf('"%s" is not a valid UUID for FinancialRecordId.', $value));
        }

        $this->value = strtolower($value);
    }

    public static function generate(): self
    {
        return new self(Uuid::uuid4()->toString());
    }

    public static function fromString(string $value): self
    {
        return new self($value);
    }

    public function value(): string
    {
        return $this->value;
    }

    public function __toString(): string
    {
        return $this->value;
    }

    public function equals(ValueObject $other): bool
    {
        return $other instanceof self && $this->value === $other->value;
    }
}
