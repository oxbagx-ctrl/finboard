<?php

declare(strict_types=1);

namespace App\Contexts\InvestmentProject\Domain\ValueObjects;

enum GrantTrancheType: string
{
    case ADVANCE = 'advance';
    case INTERIM = 'interim';
    case FINAL = 'final';

    public function label(): string
    {
        return match ($this) {
            self::ADVANCE => 'Zaliczka',
            self::INTERIM => 'Refundacja pośrednia',
            self::FINAL => 'Płatność końcowa (rozliczenie)',
        };
    }

    public function isAdvance(): bool
    {
        return $this === self::ADVANCE;
    }

    public function isInterim(): bool
    {
        return $this === self::INTERIM;
    }

    public function isFinal(): bool
    {
        return $this === self::FINAL;
    }
}
