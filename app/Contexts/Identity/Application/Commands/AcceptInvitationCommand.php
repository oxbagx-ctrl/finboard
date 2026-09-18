<?php

declare(strict_types=1);

namespace App\Contexts\Identity\Application\Commands;

final class AcceptInvitationCommand
{
    public function __construct(
        public readonly string $token,
        public readonly string $name,
        public readonly string $password,
        public readonly ?string $passwordConfirmation = null
    ) {
    }
}
