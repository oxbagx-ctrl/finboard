<?php

declare(strict_types=1);

namespace App\Contexts\InvestmentProject\Domain\ValueObjects;

use App\Shared\Domain\ValueObject;
use InvalidArgumentException;

final class WaterfallStructure implements ValueObject
{
    /** @var array<int, WaterfallTier> */
    private array $tiers;

    /**
     * @param array<WaterfallTier> $tiers
     */
    public function __construct(array $tiers)
    {
        if (empty($tiers)) {
            throw new InvalidArgumentException('Waterfall structure must contain at least one tier.');
        }

        // Validate ordered hurdles and unique tier numbers
        $previousHurdle = 0.0;
        $seenResidual = false;
        $normalized = [];

        foreach ($tiers as $tier) {
            if ($seenResidual) {
                throw new InvalidArgumentException('Residual tier (no hurdle rate) must be the final tier in the waterfall.');
            }

            if ($tier->isResidual()) {
                $seenResidual = true;
            } else {
                $hurdle = $tier->hurdleRatePercent();
                if ($hurdle <= $previousHurdle) {
                    throw new InvalidArgumentException(
                        sprintf(
                            'Waterfall hurdles must be strictly ascending: Tier %d (%.2f%%) is not greater than previous hurdle (%.2f%%).',
                            $tier->tierNumber(),
                            $hurdle,
                            $previousHurdle
                        )
                    );
                }
                $previousHurdle = $hurdle;
            }

            $normalized[$tier->tierNumber()] = $tier;
        }

        $this->tiers = $normalized;
    }

    /**
     * Preset 1: Pari Passu (Pro-rata distribution based on initial equity shares).
     */
    public static function pariPassu(float $investor1SharePercent, float $investor2SharePercent): self
    {
        return new self([
            new WaterfallTier(
                tierNumber: 1,
                name: 'Pari Passu Pro-Rata',
                hurdleRatePercent: null,
                investor1SplitPercent: $investor1SharePercent,
                investor2SplitPercent: $investor2SharePercent
            ),
        ]);
    }

    /**
     * Preset 2: Two-tier Hurdle (Preferred Return + Sponsor Promote).
     *
     * Tier 1: Return of Capital & Preferred Return up to hurdle (pro-rata).
     * Tier 2: Excess Cash Split (Promote to Investor 1).
     */
    public static function standardTwoTier(
        float $hurdleRatePercent = 8.0,
        float $sponsorPromotePercent = 20.0,
        float $investor1SharePercent = 50.0,
        float $investor2SharePercent = 50.0
    ): self {
        // Tier 2 split: Investor 1 gets their pro-rata share PLUS the promote on Investor 2's share,
        // or a direct promote structure (e.g. 20% carry to Sponsor, remainder pro-rata).
        $tier2Inv1 = min(100.0, $investor1SharePercent + ($sponsorPromotePercent * ($investor2SharePercent / 100.0)));
        $tier2Inv2 = max(0.0, 100.0 - $tier2Inv1);

        return new self([
            new WaterfallTier(
                tierNumber: 1,
                name: sprintf('Return of Capital & Hurdle (%.1f%% Pref)', $hurdleRatePercent),
                hurdleRatePercent: $hurdleRatePercent,
                investor1SplitPercent: $investor1SharePercent,
                investor2SplitPercent: $investor2SharePercent
            ),
            new WaterfallTier(
                tierNumber: 2,
                name: sprintf('Residual Profit Split (%.1f%% Sponsor Promote)', $sponsorPromotePercent),
                hurdleRatePercent: null,
                investor1SplitPercent: round($tier2Inv1, 2),
                investor2SplitPercent: round($tier2Inv2, 2)
            ),
        ]);
    }

    /**
     * Preset 3: Three-tier Hurdle (Preferred Return + Catch-up/Promote + Super-Promote).
     */
    public static function standardThreeTier(
        float $hurdle1Percent = 8.0,
        float $promote1Percent = 20.0,
        float $hurdle2Percent = 15.0,
        float $promote2Percent = 35.0,
        float $investor1SharePercent = 50.0,
        float $investor2SharePercent = 50.0
    ): self {
        $tier2Inv1 = min(100.0, $investor1SharePercent + ($promote1Percent * ($investor2SharePercent / 100.0)));
        $tier2Inv2 = max(0.0, 100.0 - $tier2Inv1);

        $tier3Inv1 = min(100.0, $investor1SharePercent + ($promote2Percent * ($investor2SharePercent / 100.0)));
        $tier3Inv2 = max(0.0, 100.0 - $tier3Inv1);

        return new self([
            new WaterfallTier(
                tierNumber: 1,
                name: sprintf('Tier 1: Preferred Return (%.1f%% Hurdle)', $hurdle1Percent),
                hurdleRatePercent: $hurdle1Percent,
                investor1SplitPercent: $investor1SharePercent,
                investor2SplitPercent: $investor2SharePercent
            ),
            new WaterfallTier(
                tierNumber: 2,
                name: sprintf('Tier 2: Intermediate Promote (%.1f%% Hurdle, %.1f%% Carry)', $hurdle2Percent, $promote1Percent),
                hurdleRatePercent: $hurdle2Percent,
                investor1SplitPercent: round($tier2Inv1, 2),
                investor2SplitPercent: round($tier2Inv2, 2)
            ),
            new WaterfallTier(
                tierNumber: 3,
                name: sprintf('Tier 3: Super Promote (>%.1f%% Hurdle, %.1f%% Carry)', $hurdle2Percent, $promote2Percent),
                hurdleRatePercent: null,
                investor1SplitPercent: round($tier3Inv1, 2),
                investor2SplitPercent: round($tier3Inv2, 2)
            ),
        ]);
    }

    /**
     * @return array<int, WaterfallTier>
     */
    public function tiers(): array
    {
        return $this->tiers;
    }

    public function tier(int $tierNumber): ?WaterfallTier
    {
        return $this->tiers[$tierNumber] ?? null;
    }

    public function tierCount(): int
    {
        return count($this->tiers);
    }

    public function equals(ValueObject $other): bool
    {
        if (!$other instanceof self) {
            return false;
        }

        if (count($this->tiers) !== count($other->tiers)) {
            return false;
        }

        foreach ($this->tiers as $num => $tier) {
            $otherTier = $other->tier($num);
            if ($otherTier === null || !$tier->equals($otherTier)) {
                return false;
            }
        }

        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        $tiersArray = [];
        foreach ($this->tiers as $num => $tier) {
            $tiersArray[$num] = $tier->toArray();
        }

        return [
            'tier_count' => count($this->tiers),
            'tiers' => $tiersArray,
        ];
    }
}
