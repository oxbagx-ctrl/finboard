<?php

declare(strict_types=1);

namespace App\Contexts\Identity\Domain\ValueObjects;

enum InvitationStatus: string
{
    case PENDING = 'pending';
    case ACCEPTED = 'accepted';
    case REVOKED = 'revoked';
    case EXPIRED = 'expired';

    public function label(): string
    {
        return match ($this) {
            self::PENDING => 'Oczekujące',
            self::ACCEPTED => 'Zaakceptowane',
            self::REVOKED => 'Odwołane',
            self::EXPIRED => 'Wygasłe',
        };
    }

    public function isPending(): bool
    {
        return $this === self::PENDING;
    }

    public function isAccepted(): bool
    {
        return $this === self::ACCEPTED;
    }

    public function isRevoked(): bool
    {
        return $this === self::REVOKED;
    }

    public function isExpired(): bool
    {
        return $this === self::EXPIRED;
    }
}
