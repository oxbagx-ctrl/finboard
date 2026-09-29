<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

final class ExchangeRate extends Model
{
    use HasUuids;

    protected $table = 'exchange_rates';

    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = [
        'id',
        'currency',
        'currency_name',
        'mid_rate',
        'multiplier',
        'table_no',
        'effective_date',
        'source',
        'fetched_at',
    ];

    protected $casts = [
        'mid_rate' => 'float',
        'multiplier' => 'float',
        'effective_date' => 'date:Y-m-d',
        'fetched_at' => 'datetime',
    ];

    /**
     * Find exchange rate by ISO currency code (case-insensitive).
     */
    public static function findByCurrency(string $currency): ?self
    {
        return self::where('currency', strtoupper(trim($currency)))->first();
    }

    /**
     * Get multiplier for converting from PLN to currency.
     * Returns 1.0 for PLN or when currency is not found.
     */
    public static function getMultiplierFor(string $currency): float
    {
        $code = strtoupper(trim($currency));
        if ($code === 'PLN') {
            return 1.0;
        }

        $record = self::findByCurrency($code);

        return $record !== null ? (float) $record->multiplier : 1.0;
    }

    /**
     * Convert an amount from PLN to this currency.
     */
    public function convertFromPln(float $amountInPln): float
    {
        return round($amountInPln * (float) $this->multiplier, 4);
    }

    /**
     * Convert an amount from this currency to PLN.
     */
    public function convertToPln(float $amountInForeignCurrency): float
    {
        return round($amountInForeignCurrency * (float) $this->mid_rate, 4);
    }

    /**
     * Get table type (e.g. 'A') from table_no.
     */
    public function getTableTypeAttribute(): string
    {
        if (preg_match('/\/([A-C])\//', (string) $this->table_no, $matches)) {
            return $matches[1];
        }

        return 'A';
    }
}
