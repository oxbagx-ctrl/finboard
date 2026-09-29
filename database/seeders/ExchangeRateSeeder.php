<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\ExchangeRate;
use Carbon\Carbon;
use Illuminate\Database\Seeder;

final class ExchangeRateSeeder extends Seeder
{
    public function run(): void
    {
        $rates = [
            [
                'currency' => 'EUR',
                'currency_name' => 'euro',
                'mid_rate' => 4.3000,
                'multiplier' => round(1 / 4.3000, 8),
                'table_no' => '001/A/NBP/2026',
                'effective_date' => '2026-01-02',
                'source' => 'NBP',
                'fetched_at' => Carbon::now(),
            ],
            [
                'currency' => 'USD',
                'currency_name' => 'dolar amerykański',
                'mid_rate' => 3.9000,
                'multiplier' => round(1 / 3.9000, 8),
                'table_no' => '001/A/NBP/2026',
                'effective_date' => '2026-01-02',
                'source' => 'NBP',
                'fetched_at' => Carbon::now(),
            ],
            [
                'currency' => 'GBP',
                'currency_name' => 'funt szterling',
                'mid_rate' => 5.1000,
                'multiplier' => round(1 / 5.1000, 8),
                'table_no' => '001/A/NBP/2026',
                'effective_date' => '2026-01-02',
                'source' => 'NBP',
                'fetched_at' => Carbon::now(),
            ],
        ];

        foreach ($rates as $rate) {
            ExchangeRate::updateOrCreate(
                ['currency' => $rate['currency']],
                $rate
            );
        }
    }
}
