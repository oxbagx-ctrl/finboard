<?php

declare(strict_types=1);

namespace App\Contexts\Identity\Application\Exceptions;

use DomainException;

final class UnauthorizedInvitationException extends DomainException
{
    public static function actorInactive(string $userId): self
    {
        return new self(sprintf('Użytkownik inicjujący zaproszenie "%s" jest nieaktywny.', $userId));
    }

    public static function notAuthorized(string $userId): self
    {
        return new self(sprintf('Użytkownik "%s" nie posiada uprawnień do wystawiania zaproszeń.', $userId));
    }

    public static function cannotInviteRole(string $actorRole, string $targetRole): self
    {
        return new self(sprintf(
            'Użytkownik o roli "%s" nie ma uprawnień do zapraszania użytkowników na poziomie "%s".',
            $actorRole,
            $targetRole
        ));
    }

    public static function advisorNotAssignedToCompany(string $advisorId, string $companyId): self
    {
        return new self(sprintf(
            'Doradca "%s" nie jest przypisany do spółki "%s" i nie może zapraszać do niej użytkowników.',
            $advisorId,
            $companyId
        ));
    }
}
