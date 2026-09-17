<?php

declare(strict_types=1);

namespace App\Contexts\Finance\Domain\Exceptions;

use DateTimeInterface;
use DomainException;

final class InvalidDateRangeException extends DomainException
{
    public static function startAfterEnd(DateTimeInterface $start, DateTimeInterface $end): self
    {
        return new self(sprintf(
            'Invalid date range: start date "%s" must be before or equal to end date "%s".',
            $start->format('Y-m-d'),
            $end->format('Y-m-d')
        ));
    }
}
