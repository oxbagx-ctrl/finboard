<?php

declare(strict_types=1);

namespace App\Contexts\Identity\Application\Commands;

final class InviteUserCommand
{
    /**
     * @param array<string> $assignedCompanyIds Array of Company UUID strings (relevant for Advisor role)
     */
    public function __construct(
        public readonly string $invitedById,
        public readonly string $email,
        public readonly string $role,
        public readonly ?string $companyId = null,
        public readonly array $assignedCompanyIds = [],
        public readonly ?int $validityHours = 48
    ) {
    }
}
