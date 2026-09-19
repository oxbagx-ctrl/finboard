<?php

declare(strict_types=1);

namespace App\Contexts\Finance\Domain\ValueObjects;

enum BenchmarkStatus: string
{
    case OPTIMAL = 'OPT';
    case WARNING = 'WARN';
    case CRITICAL = 'CRIT';
    case UNKNOWN = 'UNKNOWN';

    public function isOptimal(): bool
    {
        return $this === self::OPTIMAL;
    }

    public function isWarning(): bool
    {
        return $this === self::WARNING;
    }

    public function isCritical(): bool
    {
        return $this === self::CRITICAL;
    }

    public function isUnknown(): bool
    {
        return $this === self::UNKNOWN;
    }

    public function label(): string
    {
        return match ($this) {
            self::OPTIMAL => 'Optymalny',
            self::WARNING => 'Ostrzeżenie',
            self::CRITICAL => 'Krytyczny',
            self::UNKNOWN => 'Brak danych',
        };
    }

    public function color(): string
    {
        return match ($this) {
            self::OPTIMAL => 'emerald',
            self::WARNING => 'amber',
            self::CRITICAL => 'rose',
            self::UNKNOWN => 'zinc',
        };
    }
}
