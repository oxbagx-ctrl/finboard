<?php

declare(strict_types=1);

namespace Tests\Unit\Finance;

use App\Domain\Finance\Exceptions\NbpApiException;
use App\Domain\Finance\Services\NbpExchangeRateService;
use App\Models\ExchangeRate;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

final class NbpExchangeRateServiceTest extends TestCase
{
    use DatabaseTransactions;

    private NbpExchangeRateService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = new NbpExchangeRateService();
        Cache::forget(NbpExchangeRateService::CACHE_KEY);
    }

    public function test_sync_rates_successfully_fetches_and_persists_nbp_table_a(): void
    {
        $mockPayload = [
            [
                'table' => 'A',
                'no' => '055/A/NBP/2026',
                'effectiveDate' => '2026-03-20',
                'rates' => [
                    [
                        'currency' => 'euro',
                        'code' => 'EUR',
                        'mid' => 4.3125,
                    ],
                    [
                        'currency' => 'dolar amerykański',
                        'code' => 'USD',
                        'mid' => 3.9450,
                    ],
                    [
                        'currency' => 'funt szterling',
                        'code' => 'GBP',
                        'mid' => 5.1200,
                    ],
                ],
            ],
        ];

        Http::fake([
            NbpExchangeRateService::NBP_TABLE_A_URL => Http::response($mockPayload, 200),
        ]);

        $result = $this->service->syncRates();

        $this->assertSame('055/A/NBP/2026', $result['table_no']);
        $this->assertSame('2026-03-20', $result['effective_date']);
        $this->assertSame('NBP', $result['source']);
        $this->assertSame(3, $result['rates_count']);
        $this->assertCount(3, $result['rates']);

        $eur = ExchangeRate::findByCurrency('EUR');
        $this->assertNotNull($eur);
        $this->assertSame(4.3125, $eur->mid_rate);
        $this->assertEqualsWithDelta(round(1 / 4.3125, 8), $eur->multiplier, 0.00000001);
        $this->assertSame('055/A/NBP/2026', $eur->table_no);
        $this->assertSame('2026-03-20', $eur->effective_date->format('Y-m-d'));

        $usd = ExchangeRate::findByCurrency('USD');
        $this->assertNotNull($usd);
        $this->assertSame(3.9450, $usd->mid_rate);

        $gbp = ExchangeRate::findByCurrency('GBP');
        $this->assertNotNull($gbp);
        $this->assertSame(5.1200, $gbp->mid_rate);
    }

    public function test_sync_rates_throws_exception_on_network_failure(): void
    {
        Http::fake([
            NbpExchangeRateService::NBP_TABLE_A_URL => Http::response('Server Error', 500),
        ]);

        $this->expectException(NbpApiException::class);
        $this->service->syncRates();
    }

    public function test_sync_rates_throws_exception_on_malformed_json_payload(): void
    {
        Http::fake([
            NbpExchangeRateService::NBP_TABLE_A_URL => Http::response(['unexpected' => 'format'], 200),
        ]);

        $this->expectException(NbpApiException::class);
        $this->service->syncRates();
    }

    public function test_sync_rates_throws_exception_on_empty_rates(): void
    {
        Http::fake([
            NbpExchangeRateService::NBP_TABLE_A_URL => Http::response([
                [
                    'table' => 'A',
                    'no' => '055/A/NBP/2026',
                    'effectiveDate' => '2026-03-20',
                    'rates' => [],
                ],
            ], 200),
        ]);

        $this->expectException(NbpApiException::class);
        $this->service->syncRates();
    }

    public function test_currency_conversion_methods_calculate_accurately(): void
    {
        ExchangeRate::updateOrCreate(
            ['currency' => 'EUR'],
            [
                'currency_name' => 'euro',
                'mid_rate' => 4.3000,
                'multiplier' => round(1 / 4.3000, 8),
                'table_no' => '001/A/NBP/2026',
                'effective_date' => '2026-01-02',
                'source' => 'NBP',
                'fetched_at' => now(),
            ]
        );

        // Convert PLN to EUR
        $eurAmount = $this->service->convertFromPln(100.0, 'EUR');
        $this->assertEqualsWithDelta(23.2558, $eurAmount, 0.001);

        // Convert EUR to PLN
        $plnAmount = $this->service->convertToPln(100.0, 'EUR');
        $this->assertEqualsWithDelta(430.0000, $plnAmount, 0.0001);

        // PLN to PLN identity
        $this->assertSame(100.0, $this->service->convertFromPln(100.0, 'PLN'));
        $this->assertSame(100.0, $this->service->convertToPln(100.0, 'PLN'));

        // Multiplier & Rate helper getters
        $this->assertEqualsWithDelta(round(1 / 4.3000, 8), $this->service->getMultiplier('EUR'), 0.00000001);
        $this->assertSame(1.0, $this->service->getMultiplier('PLN'));
        $this->assertNotNull($this->service->getRate('EUR'));

        // Unknown currency throws exception
        $this->expectException(NbpApiException::class);
        $this->service->convertFromPln(100.0, 'UNKNOWN_CURRENCY');
    }

    public function test_cache_aside_strategy_and_invalidation(): void
    {
        ExchangeRate::updateOrCreate(
            ['currency' => 'EUR'],
            [
                'currency_name' => 'euro',
                'mid_rate' => 4.3000,
                'multiplier' => round(1 / 4.3000, 8),
                'table_no' => '001/A/NBP/2026',
                'effective_date' => '2026-01-02',
                'source' => 'NBP',
                'fetched_at' => now(),
            ]
        );

        // First call: cache miss
        $payload1 = $this->service->getCachedRatesPayload();
        $this->assertFalse($payload1['cached']);
        $this->assertArrayHasKey('multipliers', $payload1);
        $this->assertSame(1.0, $payload1['multipliers']['PLN']);

        // Second call: cache hit
        $payload2 = $this->service->getCachedRatesPayload();
        $this->assertTrue($payload2['cached']);

        // Invalidate cache
        $this->service->invalidateCache();
        $payload3 = $this->service->getCachedRatesPayload();
        $this->assertFalse($payload3['cached']);
    }
}
