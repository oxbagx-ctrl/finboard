<?php

declare(strict_types=1);

namespace App\Contexts\Identity\Domain\Exceptions;

use DomainException;

final class InvitationAlreadyAcceptedException extends DomainException
{
    public function __construct(string $message = 'To zaproszenie zostało już wcześniej zaakceptowane, a konto aktywowane.')
    {
        parent::__construct($message);
    }
}
