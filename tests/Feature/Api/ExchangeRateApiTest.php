<?php

declare(strict_types=1);

namespace Tests\Feature\Api;

use App\Domain\Finance\Services\NbpExchangeRateService;
use App\Models\Company;
use App\Models\ExchangeRate;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

final class ExchangeRateApiTest extends TestCase
{
    use DatabaseTransactions;

    private User $user;
    private Company $company;

    protected function setUp(): void
    {
        parent::setUp();

        Cache::forget(NbpExchangeRateService::CACHE_KEY);

        $this->company = Company::firstOrCreate(
            ['code' => 'HELVEST'],
            ['name' => 'Helvest Advisory Sp. z o.o.', 'tax_id' => 'PL5252525252']
        );

        $this->user = User::firstOrCreate(
            ['email' => 'advisor@helvest.com'],
            [
                'name' => 'Advisor User',
                'password' => bcrypt('password123'),
                'role' => 'advisor',
                'company_id' => $this->company->id,
                'is_active' => true,
            ]
        );

        // Baseline rate for tests
        ExchangeRate::updateOrCreate(
            ['currency' => 'EUR'],
            [
                'currency_name' => 'euro',
                'mid_rate' => 4.3000,
                'multiplier' => round(1 / 4.3000, 8),
                'table_no' => '055/A/NBP/2026',
                'effective_date' => '2026-03-20',
                'source' => 'NBP',
                'fetched_at' => Carbon::now(),
            ]
        );
    }

    public function test_unauthenticated_requests_are_rejected_with_401(): void
    {
        $this->getJson('/api/v1/finance/exchange-rates')->assertStatus(401);
        $this->getJson('/api/v1/finance/exchange-rates/EUR')->assertStatus(401);
        $this->postJson('/api/v1/finance/exchange-rates/sync')->assertStatus(401);
    }

    public function test_get_exchange_rates_returns_cached_payload_with_multipliers(): void
    {
        Sanctum::actingAs($this->user);

        // Initial request: cache miss
        $response1 = $this->getJson('/api/v1/finance/exchange-rates');
        $response1->assertOk()
            ->assertJsonStructure([
                'source',
                'table_no',
                'effective_date',
                'fetched_at',
                'cached',
                'rates',
                'multipliers',
            ])
            ->assertJson([
                'source' => 'NBP',
                'cached' => false,
            ]);

        $this->assertArrayHasKey('EUR', $response1->json('multipliers'));
        $this->assertArrayHasKey('PLN', $response1->json('multipliers'));
        $this->assertEquals(1.0, $response1->json('multipliers.PLN'));

        // Second request: cache hit
        $response2 = $this->getJson('/api/v1/finance/exchange-rates');
        $response2->assertOk()
            ->assertJson([
                'cached' => true,
            ]);
    }

    public function test_get_exchange_rates_with_refresh_flag_bypasses_cache(): void
    {
        Sanctum::actingAs($this->user);

        // Prime cache
        $this->getJson('/api/v1/finance/exchange-rates');

        // Forced refresh
        $response = $this->getJson('/api/v1/finance/exchange-rates?refresh=1');
        $response->assertOk()
            ->assertJson([
                'cached' => false,
            ]);
    }

    public function test_get_specific_currency_details_and_conversion_sample(): void
    {
        Sanctum::actingAs($this->user);

        // Existing foreign currency
        $response = $this->getJson('/api/v1/finance/exchange-rates/EUR');
        $response->assertOk()
            ->assertJson([
                'currency' => 'EUR',
                'currency_name' => 'euro',
                'mid_rate' => 4.3,
                'table_no' => '055/A/NBP/2026',
                'effective_date' => '2026-03-20',
                'conversion_sample' => [
                    'amount' => 100.0,
                    'from_currency_to_pln' => 430.0,
                    'from_pln_to_currency' => 23.2558,
                ],
            ]);

        // Base currency PLN
        $plnResponse = $this->getJson('/api/v1/finance/exchange-rates/PLN');
        $plnResponse->assertOk()
            ->assertJson([
                'currency' => 'PLN',
                'mid_rate' => 1.0,
                'multiplier' => 1.0,
                'conversion_sample' => [
                    'amount' => 100.0,
                    'from_currency_to_pln' => 100.0,
                    'from_pln_to_currency' => 100.0,
                ],
            ]);

        // Non-existent currency
        $notFoundResponse = $this->getJson('/api/v1/finance/exchange-rates/NON_EXISTENT');
        $notFoundResponse->assertStatus(404)
            ->assertJsonStructure(['error', 'message']);
    }

    public function test_sync_endpoint_triggers_on_demand_nbp_sync_and_invalidates_cache(): void
    {
        Sanctum::actingAs($this->user);

        $mockPayload = [
            [
                'table' => 'A',
                'no' => '056/A/NBP/2026',
                'effectiveDate' => '2026-03-21',
                'rates' => [
                    [
                        'currency' => 'euro',
                        'code' => 'EUR',
                        'mid' => 4.3210,
                    ],
                    [
                        'currency' => 'dolar amerykański',
                        'code' => 'USD',
                        'mid' => 3.9500,
                    ],
                ],
            ],
        ];

        Http::fake([
            NbpExchangeRateService::NBP_TABLE_A_URL => Http::response($mockPayload, 200),
        ]);

        $response = $this->postJson('/api/v1/finance/exchange-rates/sync');

        $response->assertOk()
            ->assertJson([
                'message' => 'Pomyślnie zsynchronizowano kursy walut z API NBP.',
                'table_no' => '056/A/NBP/2026',
                'effective_date' => '2026-03-21',
                'source' => 'NBP',
                'rates_count' => 2,
            ]);

        $eur = ExchangeRate::findByCurrency('EUR');
        $this->assertNotNull($eur);
        $this->assertSame(4.3210, $eur->mid_rate);
        $this->assertSame('056/A/NBP/2026', $eur->table_no);
    }

    public function test_sync_endpoint_handles_nbp_gateway_error(): void
    {
        Sanctum::actingAs($this->user);

        Http::fake([
            NbpExchangeRateService::NBP_TABLE_A_URL => Http::response('Server Gateway Timeout', 504),
        ]);

        $response = $this->postJson('/api/v1/finance/exchange-rates/sync');

        $response->assertStatus(502)
            ->assertJsonStructure(['error', 'message']);
    }
}
