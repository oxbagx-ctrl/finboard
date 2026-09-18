<?php

declare(strict_types=1);

namespace App\Contexts\Identity\Domain\ValueObjects;

enum RoleType: string
{
    case SUPER_ADMIN = 'super_admin';
    case ADVISOR = 'advisor';
    case CLIENT = 'client';
    case ADMIN = 'admin'; // Legacy alias retained for backwards compatibility

    public function label(): string
    {
        return match ($this) {
            self::SUPER_ADMIN => 'Super Administrator (Partner)',
            self::ADVISOR => 'Doradca Transakcyjny (Advisor)',
            self::CLIENT => 'Użytkownik Klienta (Client)',
            self::ADMIN => 'Administrator (Legacy)',
        };
    }

    public function isSuperAdmin(): bool
    {
        return $this === self::SUPER_ADMIN || $this === self::ADMIN;
    }

    public function isAdvisor(): bool
    {
        return $this === self::ADVISOR;
    }

    public function isClient(): bool
    {
        return $this === self::CLIENT;
    }
}
