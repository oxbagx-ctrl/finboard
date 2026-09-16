<?php

declare(strict_types=1);

namespace App\Shared\Domain;

interface ValueObject
{
    /**
     * Compare this value object with another for equality based on its internal values.
     */
    public function equals(self $other): bool;
}
