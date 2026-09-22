<?php

declare(strict_types=1);

namespace App\Contexts\InvestmentProject\Domain\Events;

use App\Contexts\InvestmentProject\Domain\ValueObjects\CapexStageId;
use App\Contexts\InvestmentProject\Domain\ValueObjects\InvestmentProjectId;
use App\Shared\Domain\DomainEvent;
use DateTimeImmutable;

final class CapexStageAdded implements DomainEvent
{
    private DateTimeImmutable $occurredAt;

    public function __construct(
        private readonly InvestmentProjectId $projectId,
        private readonly CapexStageId $stageId,
        private readonly string $name,
        private readonly string $netAmount,
        private readonly string $currency,
        private readonly int $durationMonths,
        private readonly string $kstCode,
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

    public function name(): string
    {
        return $this->name;
    }

    public function netAmount(): string
    {
        return $this->netAmount;
    }

    public function currency(): string
    {
        return $this->currency;
    }

    public function durationMonths(): int
    {
        return $this->durationMonths;
    }

    public function kstCode(): string
    {
        return $this->kstCode;
    }

    public function toPayload(): array
    {
        return [
            'project_id' => $this->projectId->value(),
            'stage_id' => $this->stageId->value(),
            'name' => $this->name,
            'net_amount' => $this->netAmount,
            'currency' => $this->currency,
            'duration_months' => $this->durationMonths,
            'kst_code' => $this->kstCode,
            'occurred_at' => $this->occurredAt->format(DateTimeImmutable::ATOM),
        ];
    }
}
