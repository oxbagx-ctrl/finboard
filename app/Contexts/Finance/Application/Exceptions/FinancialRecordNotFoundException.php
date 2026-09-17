<?php

declare(strict_types=1);

namespace App\Contexts\Finance\Application\Exceptions;

use RuntimeException;

final class FinancialRecordNotFoundException extends RuntimeException
{
    public static function withId(string $id): self
    {
        return new self(sprintf('Financial record with ID "%s" was not found.', $id));
    }
}
