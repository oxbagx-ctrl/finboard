<?php

declare(strict_types=1);

namespace Tests\Feature\Console;

use App\Domain\Finance\Services\NbpExchangeRateService;
use App\Models\ExchangeRate;
use Illuminate\Console\Scheduling\Event;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

final class SyncExchangeRatesCommandTest extends TestCase
{
    use DatabaseTransactions;

    private array $mockTableAPayload = [
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
                [
                    'currency' => 'frank szwajcarski',
                    'code' => 'CHF',
                    'mid' => 4.4500,
                ],
                [
                    'currency' => 'jen (Japonia)',
                    'code' => 'JPY',
                    'mid' => 0.0260,
                ],
            ],
        ],
    ];

    public function test_sync_exchange_rates_command_executes_successfully(): void
    {
        Http::fake([
            NbpExchangeRateService::NBP_TABLE_A_URL => Http::response($this->mockTableAPayload, 200),
        ]);

        $this->artisan('app:sync-exchange-rates')
            ->expectsOutputToContain('FINBOARD - SYNCHRONIZACJA KURSÓW WALUT NBP (TABELA A)')
            ->expectsOutputToContain('055/A/NBP/2026')
            ->expectsOutputToContain('2026-03-20')
            ->expectsOutputToContain('EUR, USD, GBP, CHF')
            ->expectsOutputToContain('Synchronizacja zakończona sukcesem.')
            ->assertSuccessful();

        $eur = ExchangeRate::findByCurrency('EUR');
        $this->assertNotNull($eur);
        $this->assertSame(4.3125, $eur->mid_rate);
        $this->assertSame('055/A/NBP/2026', $eur->table_no);
    }

    public function test_sync_exchange_rates_command_with_table_option_displays_full_currency_table(): void
    {
        Http::fake([
            NbpExchangeRateService::NBP_TABLE_A_URL => Http::response($this->mockTableAPayload, 200),
        ]);

        $this->artisan('app:sync-exchange-rates', ['--table' => true])
            ->expectsOutputToContain('Kompletna Tabela Kursów Średnich NBP')
            ->expectsOutputToContain('JPY')
            ->assertSuccessful();
    }

    public function test_sync_exchange_rates_command_handles_api_failure_gracefully(): void
    {
        Http::fake([
            NbpExchangeRateService::NBP_TABLE_A_URL => Http::response('Gateway Timeout', 504),
        ]);

        $this->artisan('app:sync-exchange-rates')
            ->expectsOutputToContain('BŁĄD SYNCHRONIZACJI')
            ->assertFailed();
    }

    public function test_command_alias_finance_sync_exchange_rates_works(): void
    {
        Http::fake([
            NbpExchangeRateService::NBP_TABLE_A_URL => Http::response($this->mockTableAPayload, 200),
        ]);

        $this->artisan('finance:sync-exchange-rates')
            ->expectsOutputToContain('Pomyślnie zsynchronizowano kursy walut NBP.')
            ->assertSuccessful();
    }

    public function test_scheduler_has_exchange_rates_sync_scheduled_twice_daily(): void
    {
        /** @var Schedule $schedule */
        $schedule = $this->app->make(Schedule::class);

        $events = collect($schedule->events())->filter(function (Event $event): bool {
            return str_contains($event->command ?? '', 'app:sync-exchange-rates');
        });

        $this->assertGreaterThanOrEqual(2, $events->count());

        $hasMorning = $events->contains(function (Event $event): bool {
            return $event->expression === '30 8 * * 1-5' || str_contains($event->expression, '30 8');
        });

        $hasMidday = $events->contains(function (Event $event): bool {
            return $event->expression === '30 12 * * 1-5' || str_contains($event->expression, '30 12');
        });

        $this->assertTrue($hasMorning, 'Harmonogram powinien zawierać uruchomienie poranne o 08:30');
        $this->assertTrue($hasMidday, 'Harmonogram powinien zawierać uruchomienie południowe o 12:30');
    }
}
