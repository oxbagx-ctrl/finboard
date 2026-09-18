<?php

declare(strict_types=1);

namespace App\Contexts\Tenant\Domain\Entities;

use App\Contexts\Identity\Domain\ValueObjects\UserId;
use App\Contexts\Tenant\Domain\Events\AdvisorAssignedToCompany;
use App\Contexts\Tenant\Domain\Events\AdvisorRevokedFromCompany;
use App\Contexts\Tenant\Domain\ValueObjects\CompanyId;
use App\Shared\Domain\AggregateRoot;
use DateTimeImmutable;

final class CompanyAdvisorAssignment extends AggregateRoot
{
    public function __construct(
        private readonly CompanyId $companyId,
        private readonly UserId $advisorId,
        private readonly ?UserId $assignedBy = null,
        private readonly DateTimeImmutable $assignedAt = new DateTimeImmutable()
    ) {
    }

    public static function create(
        CompanyId $companyId,
        UserId $advisorId,
        ?UserId $assignedBy = null
    ): self {
        $assignment = new self(
            companyId: $companyId,
            advisorId: $advisorId,
            assignedBy: $assignedBy,
            assignedAt: new DateTimeImmutable()
        );

        $assignment->recordThat(new AdvisorAssignedToCompany(
            companyId: $companyId->value(),
            advisorId: $advisorId->value(),
            assignedBy: $assignedBy?->value(),
            assignedAt: $assignment->assignedAt
        ));

        return $assignment;
    }

    public function id(): string
    {
        return "{$this->companyId->value()}:{$this->advisorId->value()}";
    }

    public function recordRevocation(?UserId $revokedBy = null): void
    {
        $this->recordThat(new AdvisorRevokedFromCompany(
            companyId: $this->companyId->value(),
            advisorId: $this->advisorId->value(),
            revokedBy: $revokedBy?->value(),
            revokedAt: new DateTimeImmutable()
        ));
    }

    public function companyId(): CompanyId
    {
        return $this->companyId;
    }

    public function advisorId(): UserId
    {
        return $this->advisorId;
    }

    public function assignedBy(): ?UserId
    {
        return $this->assignedBy;
    }

    public function assignedAt(): DateTimeImmutable
    {
        return $this->assignedAt;
    }
}
