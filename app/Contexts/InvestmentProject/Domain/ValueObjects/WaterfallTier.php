<?php

declare(strict_types=1);

namespace App\Contexts\InvestmentProject\Domain\ValueObjects;

use App\Shared\Domain\ValueObject;
use InvalidArgumentException;

final class WaterfallTier implements ValueObject
{
    public function __construct(
        private readonly int $tierNumber,
        private readonly string $name,
        private readonly ?float $hurdleRatePercent,
        private readonly float $investor1SplitPercent,
        private readonly float $investor2SplitPercent
    ) {
        if ($this->tierNumber < 1) {
            throw new InvalidArgumentException(
                sprintf('Tier number must be >= 1, %d given.', $this->tierNumber)
            );
        }

        $trimmedName = trim($this->name);
        if ($trimmedName === '') {
            throw new InvalidArgumentException('Waterfall tier name cannot be empty.');
        }

        if ($this->hurdleRatePercent !== null && $this->hurdleRatePercent <= 0.0) {
            throw new InvalidArgumentException('Hurdle rate percent must be strictly positive if specified.');
        }

        if ($this->investor1SplitPercent < 0.0 || $this->investor1SplitPercent > 100.0) {
            throw new InvalidArgumentException(
                sprintf('Investor 1 split must be between 0.0%% and 100.0%%, %.2f%% given.', $this->investor1SplitPercent)
            );
        }

        if ($this->investor2SplitPercent < 0.0 || $this->investor2SplitPercent > 100.0) {
            throw new InvalidArgumentException(
                sprintf('Investor 2 split must be between 0.0%% and 100.0%%, %.2f%% given.', $this->investor2SplitPercent)
            );
        }

        $totalSplit = $this->investor1SplitPercent + $this->investor2SplitPercent;
        if (abs($totalSplit - 100.0) > 0.01) {
            throw new InvalidArgumentException(
                sprintf('Tier split percentages must sum to 100.0%%, %.2f%% given.', $totalSplit)
            );
        }
    }

    public function tierNumber(): int
    {
        return $this->tierNumber;
    }

    public function name(): string
    {
        return $this->name;
    }

    public function hurdleRatePercent(): ?float
    {
        return $this->hurdleRatePercent;
    }

    public function isResidual(): bool
    {
        return $this->hurdleRatePercent === null;
    }

    public function investor1SplitPercent(): float
    {
        return $this->investor1SplitPercent;
    }

    public function investor2SplitPercent(): float
    {
        return $this->investor2SplitPercent;
    }

    public function investor1SplitDecimal(): float
    {
        return $this->investor1SplitPercent / 100.0;
    }

    public function investor2SplitDecimal(): float
    {
        return $this->investor2SplitPercent / 100.0;
    }

    public function equals(ValueObject $other): bool
    {
        if (!$other instanceof self) {
            return false;
        }

        return $this->tierNumber === $other->tierNumber
            && $this->name === $other->name
            && abs(($this->hurdleRatePercent ?? -1.0) - ($other->hurdleRatePercent ?? -1.0)) < 0.0001
            && abs($this->investor1SplitPercent - $other->investor1SplitPercent) < 0.0001
            && abs($this->investor2SplitPercent - $other->investor2SplitPercent) < 0.0001;
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'tier_number' => $this->tierNumber,
            'name' => $this->name,
            'hurdle_rate_percent' => $this->hurdleRatePercent,
            'is_residual' => $this->isResidual(),
            'investor1_split_percent' => $this->investor1SplitPercent,
            'investor2_split_percent' => $this->investor2SplitPercent,
        ];
    }
}
