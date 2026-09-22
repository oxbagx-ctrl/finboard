<?php

declare(strict_types=1);

namespace App\Contexts\InvestmentProject\Domain\Events;

use App\Contexts\InvestmentProject\Domain\ValueObjects\CapexStageId;
use App\Contexts\InvestmentProject\Domain\ValueObjects\InvestmentProjectId;
use App\Shared\Domain\DomainEvent;
use DateTimeImmutable;

final class CapexStageRemoved implements DomainEvent
{
    private DateTimeImmutable $occurredAt;

    public function __construct(
        private readonly InvestmentProjectId $projectId,
        private readonly CapexStageId $stageId,
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

    public function stageId(): CapexStageId
    {
        return $this->stageId;
    }

    public function toPayload(): array
    {
        return [
            'project_id' => $this->projectId->value(),
            'stage_id' => $this->stageId->value(),
            'occurred_at' => $this->occurredAt->format(DateTimeImmutable::ATOM),
        ];
    }
}
