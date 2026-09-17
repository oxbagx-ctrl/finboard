<?php

declare(strict_types=1);

namespace App\Contexts\Finance\Domain\ValueObjects;

enum Currency: string
{
    case PLN = 'PLN';
    case EUR = 'EUR';
    case USD = 'USD';
    case GBP = 'GBP';

    public function symbol(): string
    {
        return match ($this) {
            self::PLN => 'zł',
            self::EUR => '€',
            self::USD => '$',
            self::GBP => '£',
        };
    }
}
