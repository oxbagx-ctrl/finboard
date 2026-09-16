<?php

declare(strict_types=1);

namespace App\Contexts\Identity\Domain\ValueObjects;

use App\Shared\Domain\ValueObject;
use InvalidArgumentException;

final class HashedPassword implements ValueObject
{
    private string $hash;

    public function __construct(string $hash)
    {
        if (trim($hash) === '') {
            throw new InvalidArgumentException('Hashed password cannot be empty.');
        }

        $this->hash = $hash;
    }

    public static function fromHash(string $hash): self
    {
        return new self($hash);
    }

    public static function fromPlainText(string $plainText): self
    {
        if (strlen($plainText) < 8) {
            throw new InvalidArgumentException('Password must be at least 8 characters long.');
        }

        return new self(password_hash($plainText, PASSWORD_BCRYPT));
    }

    public function verify(string $plainText): bool
    {
        return password_verify($plainText, $this->hash);
    }

    public function value(): string
    {
        return $this->hash;
    }

    public function __toString(): string
    {
        return $this->hash;
    }

    public function equals(ValueObject $other): bool
    {
        return $other instanceof self && $this->hash === $other->hash;
    }
}
