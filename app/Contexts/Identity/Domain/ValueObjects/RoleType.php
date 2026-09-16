<?php

declare(strict_types=1);

namespace App\Contexts\Identity\Domain\ValueObjects;

enum RoleType: string
{
    case ADMIN = 'admin';
    case CLIENT = 'client';

    public function label(): string
    {
        return match ($this) {
            self::ADMIN => 'Analityk / Administrator',
            self::CLIENT => 'Klient',
        };
    }
}
