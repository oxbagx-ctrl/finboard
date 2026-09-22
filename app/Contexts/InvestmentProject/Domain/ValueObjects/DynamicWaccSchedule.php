<?php

declare(strict_types=1);

namespace App\Contexts\InvestmentProject\Domain\ValueObjects;

use App\Shared\Domain\ValueObject;
use InvalidArgumentException;

final class DynamicWaccSchedule implements ValueObject
{
    /** @var array<int, WaccResult> */
    private array $annualWacc;

    /**
     * @param array<int, WaccResult> $annualWacc Map of Year (1..N) => WaccResult
     */
    public function __construct(array $annualWacc)
    {
        if (empty($annualWacc)) {
            throw new InvalidArgumentException('Dynamic WACC schedule cannot be empty.');
        }

        $this->annualWacc = $annualWacc;
    }

    /**
     * @return array<int, WaccResult>
     */
    public function annualWaccMap(): array
    {
        return $this->annualWacc;
    }

    public function annualWacc(int $year): ?WaccResult
    {
        return $this->annualWacc[$year] ?? null;
    }

    public function yearCount(): int
    {
        return count($this->annualWacc);
    }

    public function averageNominalWaccPercent(): float
    {
        $sum = 0.0;
        foreach ($this->annualWacc as $wacc) {
            $sum += $wacc->nominalWaccPercent();
        }

        return round($sum / count($this->annualWacc), 4);
    }

    public function averageRealWaccPercent(): float
    {
        $sum = 0.0;
        foreach ($this->annualWacc as $wacc) {
            $sum += $wacc->realWaccPercent();
        }

        return round($sum / count($this->annualWacc), 4);
    }

    public function minNominalWacc(): WaccResult
    {
        $min = null;
        foreach ($this->annualWacc as $wacc) {
            if ($min === null || $wacc->nominalWaccPercent() < $min->nominalWaccPercent()) {
                $min = $wacc;
            }
        }

        return $min;
    }

    public function maxNominalWacc(): WaccResult
    {
        $max = null;
        foreach ($this->annualWacc as $wacc) {
            if ($max === null || $wacc->nominalWaccPercent() > $max->nominalWaccPercent()) {
                $max = $wacc;
            }
        }

        return $max;
    }

    /**
     * Cumulative multi-year compounding discount factors:
     * DF_t = Product_{k=1..t} [ 1 / (1 + WACC_k) ]
     *
     * @return array<int, float> Year => Discount Factor
     */
    public function cumulativeDiscountFactors(bool $useReal = false): array
    {
        $factors = [];
        $cumulative = 1.0;

        foreach ($this->annualWacc as $year => $wacc) {
            $rateDecimal = $useReal ? $wacc->realWaccDecimal() : $wacc->nominalWaccDecimal();
            $cumulative *= (1.0 / (1.0 + $rateDecimal));
            $factors[$year] = round($cumulative, 6);
        }

        return $factors;
    }

    public function equals(ValueObject $other): bool
    {
        if (!$other instanceof self) {
            return false;
        }

        return abs($this->averageNominalWaccPercent() - $other->averageNominalWaccPercent()) < 0.0001
            && abs($this->averageRealWaccPercent() - $other->averageRealWaccPercent()) < 0.0001
            && count($this->annualWacc) === count($other->annualWacc);
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        $annual = [];
        foreach ($this->annualWacc as $year => $wacc) {
            $annual[$year] = $wacc->toArray();
        }

        return [
            'year_count' => count($this->annualWacc),
            'average_nominal_wacc_percent' => $this->averageNominalWaccPercent(),
            'average_real_wacc_percent' => $this->averageRealWaccPercent(),
            'cumulative_discount_factors_nominal' => $this->cumulativeDiscountFactors(false),
            'cumulative_discount_factors_real' => $this->cumulativeDiscountFactors(true),
            'annual_wacc' => $annual,
        ];
    }
}
