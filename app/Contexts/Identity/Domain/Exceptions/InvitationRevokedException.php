<?php

declare(strict_types=1);

namespace App\Contexts\Identity\Domain\Exceptions;

use DomainException;

final class InvitationRevokedException extends DomainException
{
    public function __construct(string $message = 'To zaproszenie zostało unieważnione przez administratora.')
    {
        parent::__construct($message);
    }
}
