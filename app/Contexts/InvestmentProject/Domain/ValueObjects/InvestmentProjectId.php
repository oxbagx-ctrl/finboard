<?php

declare(strict_types=1);

namespace App\Contexts\InvestmentProject\Domain\ValueObjects;

use App\Shared\Domain\ValueObject;
use InvalidArgumentException;
use Ramsey\Uuid\Uuid;

final class InvestmentProjectId implements ValueObject
{
    private string $value;

    public function __construct(string $value)
    {
        $trimmed = trim($value);
        if ($trimmed === '' || !Uuid::isValid($trimmed)) {
            throw new InvalidArgumentException(sprintf('Invalid InvestmentProjectId UUID provided: "%s".', $value));
        }

        $this->value = strtolower($trimmed);
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

    public function equals(ValueObject $other): bool
    {
        return $other instanceof self && $this->value === $other->value;
    }

    public function __toString(): string
    {
        return $this->value;
    }
}
