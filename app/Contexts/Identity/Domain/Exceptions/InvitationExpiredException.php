<?php

declare(strict_types=1);

namespace App\Contexts\Identity\Domain\Exceptions;

use DateTimeInterface;
use DomainException;

final class InvitationExpiredException extends DomainException
{
    public static function forDate(DateTimeInterface $expiredAt): self
    {
        return new self(sprintf(
            'Link aktywacyjny zaproszenia wygasł w dniu %s. Skontaktuj się z administratorem w celu ponownego wysłania zaproszenia.',
            $expiredAt->format('Y-m-d H:i:s')
        ));
    }
}
