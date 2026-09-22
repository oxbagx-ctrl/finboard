<?php

declare(strict_types=1);

namespace App\Contexts\InvestmentProject\Domain\Events;

use App\Contexts\InvestmentProject\Domain\ValueObjects\InvestmentProjectId;
use App\Shared\Domain\DomainEvent;
use DateTimeImmutable;

final class FinancingStructureUpdated implements DomainEvent
{
    private DateTimeImmutable $occurredAt;

    public function __construct(
        private readonly InvestmentProjectId $projectId,
        private readonly string $investor1Equity,
        private readonly string $investor2Equity,
        private readonly string $grantAmount,
        private readonly float $grantIntensityPercent,
        private readonly string $vatBridgeLoanAmount,
        private readonly string $currency,
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

    public function investor1Equity(): string
    {
        return $this->investor1Equity;
    }

    public function investor2Equity(): string
    {
        return $this->investor2Equity;
    }

    public function grantAmount(): string
    {
        return $this->grantAmount;
    }

    public function grantIntensityPercent(): float
    {
        return $this->grantIntensityPercent;
    }

    public function vatBridgeLoanAmount(): string
    {
        return $this->vatBridgeLoanAmount;
    }

    public function currency(): string
    {
        return $this->currency;
    }

    public function toPayload(): array
    {
        return [
            'project_id' => $this->projectId->value(),
            'investor_1_equity' => $this->investor1Equity,
            'investor_2_equity' => $this->investor2Equity,
            'grant_amount' => $this->grantAmount,
            'grant_intensity_percent' => $this->grantIntensityPercent,
            'vat_bridge_loan_amount' => $this->vatBridgeLoanAmount,
            'currency' => $this->currency,
            'occurred_at' => $this->occurredAt->format(DateTimeImmutable::ATOM),
        ];
    }
}
