<?php

declare(strict_types=1);

namespace App\Shared\Domain;

abstract class Entity
{
    /**
     * Get the entity identifier string.
     */
    abstract public function id(): string;

    /**
     * Check equality between two entities based on their class and identifier.
     */
    public function equals(?self $other): bool
    {
        if ($other === null) {
            return false;
        }

        return static::class === $other::class && $this->id() === $other->id();
    }
}
