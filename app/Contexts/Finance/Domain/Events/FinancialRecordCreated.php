<?php

declare(strict_types=1);

namespace App\Contexts\Finance\Domain\Events;

use App\Contexts\Finance\Domain\ValueObjects\FinancialRecordId;
use App\Shared\Domain\DomainEvent;
use DateTimeImmutable;

final class FinancialRecordCreated implements DomainEvent
{
    private DateTimeImmutable $occurredAt;

    public function __construct(
        private readonly FinancialRecordId $recordId,
        private readonly string $companyId,
        private readonly string $categoryId,
        private readonly string $amount,
        private readonly string $currency,
        private readonly string $recordDate,
        private readonly string $source,
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
        return $this->recordId->value();
    }

    public function companyId(): string
    {
        return $this->companyId;
    }

    public function toPayload(): array
    {
        return [
            'record_id' => $this->recordId->value(),
            'company_id' => $this->companyId,
            'category_id' => $this->categoryId,
            'amount' => $this->amount,
            'currency' => $this->currency,
            'record_date' => $this->recordDate,
            'source' => $this->source,
            'occurred_at' => $this->occurredAt->format(DateTimeImmutable::ATOM),
        ];
    }
}
