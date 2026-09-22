<?php

declare(strict_types=1);

namespace App\Contexts\InvestmentProject\Domain\ValueObjects;

use App\Shared\Domain\ValueObject;
use InvalidArgumentException;

final class KstClassification implements ValueObject
{
    /**
     * Standard statutory depreciation rates per Polish KŚT classification.
     */
    public const MAPPING = [
        'KST_0' => ['name' => 'Grunty i tereny (nieamortyzowane)', 'rate' => 0.0],
        'KST_1' => ['name' => 'Budynki i lokale przemysłowo-biurowe', 'rate' => 2.5],
        'KST_2' => ['name' => 'Budowle i obiekty inżynierii lądowej', 'rate' => 4.5],
        'KST_3' => ['name' => 'Kotły i maszyny energetyczne', 'rate' => 7.0],
        'KST_4' => ['name' => 'Maszyny i aparaty ogólnego zastosowania', 'rate' => 10.0],
        'KST_5' => ['name' => 'Specjalistyczne ciągi technologiczne', 'rate' => 14.0],
        'KST_6' => ['name' => 'Urządzenia techniczne i sieci', 'rate' => 10.0],
        'KST_7' => ['name' => 'Środki transportu i pojazdy', 'rate' => 20.0],
        'KST_8' => ['name' => 'Narzędzia, przyrządy i wyposażenie', 'rate' => 20.0],
        'KST_IT' => ['name' => 'Sprzęt komputerowy i systemy informatyczne', 'rate' => 30.0],
    ];

    private string $code;
    private string $name;
    private float $depreciationRate;

    public function __construct(string $code, ?float $customRate = null, ?string $customName = null)
    {
        $normalizedCode = strtoupper(trim($code));

        if (!array_key_exists($normalizedCode, self::MAPPING)) {
            throw new InvalidArgumentException(
                sprintf('Unknown KST code "%s". Allowed codes: %s', $code, implode(', ', array_keys(self::MAPPING)))
            );
        }

        $default = self::MAPPING[$normalizedCode];
        $this->code = $normalizedCode;
        $this->name = $customName ?? $default['name'];

        $rate = $customRate ?? $default['rate'];
        if ($rate < 0.0 || $rate > 100.0) {
            throw new InvalidArgumentException(
                sprintf('Depreciation rate must be between 0.0%% and 100.0%%, %.2f%% given.', $rate)
            );
        }

        $this->depreciationRate = round($rate, 2);
    }

    public static function fromCode(string $code, ?float $customRate = null): self
    {
        return new self($code, $customRate);
    }

    public function code(): string
    {
        return $this->code;
    }

    public function name(): string
    {
        return $this->name;
    }

    public function depreciationRate(): float
    {
        return $this->depreciationRate;
    }

    public function depreciationRateDecimal(): float
    {
        return $this->depreciationRate / 100.0;
    }

    public function isDepreciable(): bool
    {
        return $this->depreciationRate > 0.0;
    }

    public function equals(ValueObject $other): bool
    {
        return $other instanceof self
            && $this->code === $other->code
            && abs($this->depreciationRate - $other->depreciationRate) < 0.01;
    }

    public function __toString(): string
    {
        return sprintf('[%s] %s (%.1f%%/rok)', $this->code, $this->name, $this->depreciationRate);
    }
}
