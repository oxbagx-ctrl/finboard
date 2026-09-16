<?php

declare(strict_types=1);

namespace App\Shared\Domain;

abstract class AggregateRoot extends Entity
{
    /**
     * Recorded domain events awaiting dispatch.
     *
     * @var array<DomainEvent>
     */
    private array $recordedEvents = [];

    /**
     * Record a domain event within the aggregate lifecycle.
     */
    protected function recordThat(DomainEvent $event): void
    {
        $this->recordedEvents[] = $event;
    }

    /**
     * Pull all recorded domain events and clear the internal buffer.
     *
     * @return array<DomainEvent>
     */
    public function releaseEvents(): array
    {
        $events = $this->recordedEvents;
        $this->recordedEvents = [];

        return $events;
    }

    /**
     * Check whether there are uncommitted events.
     */
    public function hasEvents(): bool
    {
        return !empty($this->recordedEvents);
    }
}
