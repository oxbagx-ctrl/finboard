<?php

declare(strict_types=1);

namespace App\Shared\Domain;

use DateTimeImmutable;

interface DomainEvent
{
    /**
     * Exact timestamp when the domain event occurred.
     */
    public function occurredAt(): DateTimeImmutable;

    /**
     * Unique identifier for the aggregate that produced this event.
     */
    public function aggregateId(): string;

    /**
     * Event payload serialized to an array.
     *
     * @return array<string, mixed>
     */
    public function toPayload(): array;
}
