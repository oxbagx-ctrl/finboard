<?php

declare(strict_types=1);

namespace App\Contexts\Finance\Domain\Exceptions;

use DomainException;

final class CurrencyMismatchException extends DomainException
{
    public static function create(string $expected, string $actual): self
    {
        return new self(sprintf('Currency mismatch: cannot perform operation between "%s" and "%s".', $expected, $actual));
    }
}
