<?php

declare(strict_types=1);

namespace App\Contexts\Finance\Application\Exceptions;

use RuntimeException;

final class CategoryNotFoundException extends RuntimeException
{
    public static function withId(string $id): self
    {
        return new self(sprintf('Financial category with ID "%s" does not exist.', $id));
    }
}
