<?php

declare(strict_types=1);

namespace App\Contexts\DocumentManagement\Domain\ValueObjects;

use App\Shared\Domain\ValueObject;
use InvalidArgumentException;
use Ramsey\Uuid\Uuid;

final class VdrPermissionId implements ValueObject
{
    private function __construct(
        private readonly string $value
    ) {
        if (!Uuid::isValid($value)) {
            throw new InvalidArgumentException(sprintf('Invalid UUID format for VdrPermissionId: "%s".', $value));
        }
    }

    public static function generate(): self
    {
        return new self(Uuid::uuid4()->toString());
    }

    public static function fromString(string $id): self
    {
        return new self($id);
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
