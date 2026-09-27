<?php

declare(strict_types=1);

namespace App\Contexts\DocumentManagement\Domain\ValueObjects;

use App\Contexts\Identity\Domain\ValueObjects\RoleType;
use App\Shared\Domain\ValueObject;
use InvalidArgumentException;

final class AccessSubject implements ValueObject
{
    public const TYPE_ROLE = 'role';
    public const TYPE_USER = 'user';

    private function __construct(
        private readonly string $type,
        private readonly string $id
    ) {
        if (!in_array($this->type, [self::TYPE_ROLE, self::TYPE_USER], true)) {
            throw new InvalidArgumentException(sprintf('Invalid access subject type: "%s". Must be "role" or "user".', $this->type));
        }

        if (trim($this->id) === '') {
            throw new InvalidArgumentException('Access subject ID cannot be empty.');
        }
    }

    public static function forRole(string|RoleType $role): self
    {
        $roleStr = $role instanceof RoleType ? $role->value : strtolower(trim($role));
        if ($roleStr === '') {
            throw new InvalidArgumentException('Role identifier cannot be empty.');
        }

        return new self(self::TYPE_ROLE, $roleStr);
    }

    public static function forUser(string $userId): self
    {
        $cleaned = trim($userId);
        if ($cleaned === '') {
            throw new InvalidArgumentException('User ID cannot be empty.');
        }

        return new self(self::TYPE_USER, $cleaned);
    }

    public static function fromTypeAndId(string $type, string $id): self
    {
        return new self(strtolower(trim($type)), trim($id));
    }

    public function type(): string
    {
        return $this->type;
    }

    public function id(): string
    {
        return $this->id;
    }

    public function isRole(): bool
    {
        return $this->type === self::TYPE_ROLE;
    }

    public function isUser(): bool
    {
        return $this->type === self::TYPE_USER;
    }

    public function matchesRole(string $role): bool
    {
        return $this->isRole() && strtolower($this->id) === strtolower(trim($role));
    }

    public function matchesUser(string $userId): bool
    {
        return $this->isUser() && $this->id === trim($userId);
    }

    public function identifier(): string
    {
        return sprintf('%s:%s', $this->type, $this->id);
    }

    public function equals(ValueObject $other): bool
    {
        return $other instanceof self
            && $this->type === $other->type
            && $this->id === $other->id;
    }

    public function __toString(): string
    {
        return $this->identifier();
    }
}
