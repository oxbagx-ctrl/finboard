<?php

declare(strict_types=1);

namespace App\Contexts\InvestmentProject\Domain\Events;

use App\Contexts\InvestmentProject\Domain\ValueObjects\DebtFacilityId;
use App\Contexts\InvestmentProject\Domain\ValueObjects\InvestmentProjectId;
use App\Shared\Domain\DomainEvent;
use DateTimeImmutable;

final class DebtFacilityConfigured implements DomainEvent
{
    private DateTimeImmutable $occurredAt;

    public function __construct(
        private readonly InvestmentProjectId $projectId,
        private readonly DebtFacilityId $facilityId,
        private readonly string $name,
        private readonly string $committedAmount,
        private readonly string $currency,
        private readonly float $nominalAnnualRate,
        private readonly int $tenorMonths,
        private readonly int $gracePeriodMonths,
        private readonly string $amortizationType,
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

    public function facilityId(): DebtFacilityId
    {
        return $this->facilityId;
    }

    public function name(): string
    {
        return $this->name;
    }

    public function committedAmount(): string
    {
        return $this->committedAmount;
    }

    public function currency(): string
    {
        return $this->currency;
    }

    public function nominalAnnualRate(): float
    {
        return $this->nominalAnnualRate;
    }

    public function tenorMonths(): int
    {
        return $this->tenorMonths;
    }

    public function gracePeriodMonths(): int
    {
        return $this->gracePeriodMonths;
    }

    public function amortizationType(): string
    {
        return $this->amortizationType;
    }

    public function toPayload(): array
    {
        return [
            'project_id' => $this->projectId->value(),
            'facility_id' => $this->facilityId->value(),
            'name' => $this->name,
            'committed_amount' => $this->committedAmount,
            'currency' => $this->currency,
            'nominal_annual_rate' => $this->nominalAnnualRate,
            'tenor_months' => $this->tenorMonths,
            'grace_period_months' => $this->gracePeriodMonths,
            'amortization_type' => $this->amortizationType,
            'occurred_at' => $this->occurredAt->format(DateTimeImmutable::ATOM),
        ];
    }
}
