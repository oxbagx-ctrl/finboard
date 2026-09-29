<?php

declare(strict_types=1);

namespace Tests\Unit\Finance;

use App\Models\ExchangeRate;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

final class ExchangeRateModelTest extends TestCase
{
    use DatabaseTransactions;

    public function test_exchange_rate_model_properties_and_casts(): void
    {
        $rate = ExchangeRate::create([
            'currency' => 'CHF',
            'currency_name' => 'frank szwajcarski',
            'mid_rate' => 4.5678,
            'multiplier' => round(1 / 4.5678, 8),
            'table_no' => '055/A/NBP/2026',
            'effective_date' => '2026-03-20',
            'source' => 'NBP',
            'fetched_at' => now(),
        ]);

        $this->assertNotEmpty($rate->id);
        $this->assertSame('CHF', $rate->currency);
        $this->assertSame('frank szwajcarski', $rate->currency_name);
        $this->assertSame(4.5678, $rate->mid_rate);
        $this->assertEqualsWithDelta(0.21892377, $rate->multiplier, 0.000001);
        $this->assertSame('055/A/NBP/2026', $rate->table_no);
        $this->assertSame('2026-03-20', $rate->effective_date->format('Y-m-d'));
        $this->assertSame('NBP', $rate->source);
        $this->assertNotNull($rate->fetched_at);
    }

    public function test_find_by_currency_case_insensitive(): void
    {
        ExchangeRate::updateOrCreate(
            ['currency' => 'CAD'],
            [
                'currency_name' => 'dolar kanadyjski',
                'mid_rate' => 2.9500,
                'multiplier' => round(1 / 2.9500, 8),
                'table_no' => '055/A/NBP/2026',
                'effective_date' => '2026-03-20',
                'source' => 'NBP',
                'fetched_at' => now(),
            ]
        );

        $foundUpper = ExchangeRate::findByCurrency('CAD');
        $foundLower = ExchangeRate::findByCurrency('cad');
        $foundPadded = ExchangeRate::findByCurrency(' cad ');

        $this->assertNotNull($foundUpper);
        $this->assertNotNull($foundLower);
        $this->assertNotNull($foundPadded);
        $this->assertSame($foundUpper->id, $foundLower->id);
        $this->assertSame($foundUpper->id, $foundPadded->id);
        $this->assertNull(ExchangeRate::findByCurrency('XYZ'));
    }

    public function test_get_multiplier_for(): void
    {
        ExchangeRate::updateOrCreate(
            ['currency' => 'JPY'],
            [
                'currency_name' => 'jen (Japonia)',
                'mid_rate' => 0.0260,
                'multiplier' => round(1 / 0.0260, 8),
                'table_no' => '055/A/NBP/2026',
                'effective_date' => '2026-03-20',
                'source' => 'NBP',
                'fetched_at' => now(),
            ]
        );

        // PLN should always return 1.0
        $this->assertSame(1.0, ExchangeRate::getMultiplierFor('PLN'));
        $this->assertSame(1.0, ExchangeRate::getMultiplierFor('pln'));

        // Registered currency
        $expectedMultiplier = round(1 / 0.0260, 8);
        $this->assertEqualsWithDelta($expectedMultiplier, ExchangeRate::getMultiplierFor('JPY'), 0.00000001);
        $this->assertEqualsWithDelta($expectedMultiplier, ExchangeRate::getMultiplierFor('jpy'), 0.00000001);

        // Unknown currency fallback
        $this->assertSame(1.0, ExchangeRate::getMultiplierFor('NON_EXISTENT'));
    }

    public function test_convert_from_and_to_pln(): void
    {
        $rate = ExchangeRate::updateOrCreate(
            ['currency' => 'EUR'],
            [
                'currency_name' => 'euro',
                'mid_rate' => 4.3000,
                'multiplier' => round(1 / 4.3000, 8),
                'table_no' => '055/A/NBP/2026',
                'effective_date' => '2026-03-20',
                'source' => 'NBP',
                'fetched_at' => now(),
            ]
        );

        // 100 PLN to EUR: 100 * (1 / 4.3000) = 23.2558...
        $eurAmount = $rate->convertFromPln(100.0);
        $this->assertEqualsWithDelta(23.2558, $eurAmount, 0.001);

        // 100 EUR to PLN: 100 * 4.3000 = 430.0000
        $plnAmount = $rate->convertToPln(100.0);
        $this->assertEqualsWithDelta(430.0000, $plnAmount, 0.0001);
    }
}
