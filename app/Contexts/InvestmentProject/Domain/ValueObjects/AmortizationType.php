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
     * Raty malejące (stała część kapitałowa, odsetki od malejącego salda) - Equal principal / linear schedule.
     */
    case LINEAR = 'linear';
    case EQUAL_PRINCIPAL = 'equal_principal';

    /**
     * Spłata jednorazowa na koniec okresu (balonowa) - Bullet payment.
     */
    case BULLET = 'bullet';

    public function isAnnuity(): bool
    {
        return $this === self::ANNUITY;
    }

    public function isLinear(): bool
    {
        return $this === self::LINEAR || $this === self::EQUAL_PRINCIPAL;
    }

    public function isBullet(): bool
    {
        return $this === self::BULLET;
    }

    public function label(): string
    {
        return match ($this) {
            self::ANNUITY => 'Raty równe (annuitetowe)',
            self::LINEAR, self::EQUAL_PRINCIPAL => 'Raty malejące (stały kapitał)',
            self::BULLET => 'Spłata balonowa (jednorazowa)',
        };
    }
}
