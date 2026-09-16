<?php

declare(strict_types=1);

namespace App\Contexts\Identity\Domain\ValueObjects;

use App\Contexts\Identity\Domain\Exceptions\InvalidEmailException;
use App\Shared\Domain\ValueObject;

final class Email implements ValueObject
{
    private string $value;

    public function __construct(string $value)
    {
        $trimmed = trim($value);
        if (!filter_var($trimmed, FILTER_VALIDATE_EMAIL)) {
            throw InvalidEmailException::forValue($value);
        }

        $this->value = strtolower($trimmed);
    }

    public static function fromString(string $value): self
    {
        return new self($value);
    }

    public function value(): string
    {
        return $this->value;
    }

    public function domain(): string
    {
        $parts = explode('@', $this->value);

        return $parts[1] ?? '';
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
