<?php

declare(strict_types=1);

namespace App\Contexts\InvestmentProject\Domain\ValueObjects;

enum AmortizationType: string
{
    /**
     * Raty równe uśrednione (kapitałowo-odsetkowe) - Annuity schedule.
     */
    case ANNUITY = 'annuity';

    /**
     * Raty malejące (stała część kapitałowa, odsetki od malejącego salda) - Equal principal schedule.
     */
    case EQUAL_PRINCIPAL = 'equal_principal';

    public function label(): string
    {
        return match ($this) {
            self::ANNUITY => 'Raty równe (annuitetowe)',
            self::EQUAL_PRINCIPAL => 'Raty malejące (stały kapitał)',
        };
    }
}
