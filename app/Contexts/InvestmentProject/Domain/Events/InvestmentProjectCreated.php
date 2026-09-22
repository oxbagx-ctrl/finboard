<?php

declare(strict_types=1);

namespace App\Contexts\InvestmentProject\Domain\Events;

use App\Contexts\InvestmentProject\Domain\ValueObjects\InvestmentProjectId;
use App\Shared\Domain\DomainEvent;
use DateTimeImmutable;

final class InvestmentProjectCreated implements DomainEvent
{
    private DateTimeImmutable $occurredAt;

    public function __construct(
        private readonly InvestmentProjectId $projectId,
        private readonly string $companyId,
        private readonly string $name,
        private readonly string $startDate,
        private readonly int $planningHorizonYears,
        ?DateTimeImmutable $occurredAt = null
    ) {
        $this->occurredAt = $occurredAt ?? new DateTimeImmutable();
    }

    public function occurredAt(): DateTimeImmutable
    {
        return $this->occurredAt;
    }

    public function aggregateId(): string
    {
        return $this->projectId->value();
    }

    public function projectId(): InvestmentProjectId
    {
        return $this->projectId;
    }

    public function companyId(): string
    {
        return $this->companyId;
    }

    public function name(): string
    {
        return $this->name;
    }

    public function startDate(): string
    {
        return $this->startDate;
    }

    public function planningHorizonYears(): int
    {
        return $this->planningHorizonYears;
    }

    public function toPayload(): array
    {
        return [
            'project_id' => $this->projectId->value(),
            'company_id' => $this->companyId,
            'name' => $this->name,
            'start_date' => $this->startDate,
            'planning_horizon_years' => $this->planningHorizonYears,
            'occurred_at' => $this->occurredAt->format(DateTimeImmutable::ATOM),
        ];
    }
}
