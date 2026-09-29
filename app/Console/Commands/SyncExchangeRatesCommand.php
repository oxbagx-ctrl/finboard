<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Domain\Finance\Services\NbpExchangeRateService;
use App\Models\ExchangeRate;
use Illuminate\Console\Command;
use Throwable;

final class SyncExchangeRatesCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'app:sync-exchange-rates
                            {--table : Wyświetla pełną tabelę zsynchronizowanych kursów walut}';

    /**
     * The command aliases.
     *
     * @var array<int, string>
     */
    protected $aliases = [
        'finance:sync-exchange-rates',
    ];

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Pobiera i aktualizuje oficjalne kursy walut z API NBP (Tabela A) dla celów przeliczeń finansowych FinBoard';

    /**
     * Execute the console command.
     */
    public function handle(NbpExchangeRateService $service): int
    {
        $this->newLine();
        $this->line('<fg=cyan;options=bold>===============================================================</>');
        $this->line('<fg=cyan;options=bold>  FINBOARD - SYNCHRONIZACJA KURSÓW WALUT NBP (TABELA A)        </>');
        $this->line('<fg=cyan;options=bold>===============================================================</>');
        $this->newLine();

        $this->info('Łączenie z Narodowym Bankiem Polskim (API Tabela A)...');

        try {
            $result = $service->syncRates();

            $this->info('✓ Pomyślnie zsynchronizowano kursy walut NBP.');
            $this->line("• Numer Tabeli NBP: <fg=yellow>{$result['table_no']}</>");
            $this->line("• Data Publikacji:  <fg=yellow>{$result['effective_date']}</>");
            $this->line("• Źródło Danych:    <fg=yellow>{$result['source']}</>");
            $this->line("• Zaktualizowano:   <fg=yellow>{$result['rates_count']}</> walut (w tym EUR, USD, GBP, CHF)");
            $this->newLine();

            $primaryCodes = ['EUR', 'USD', 'GBP', 'CHF'];
            $showFullTable = (bool) $this->option('table');

            $allRates = ExchangeRate::orderBy('currency')->get();

            $displayedRates = $showFullTable
                ? $allRates
                : $allRates->filter(fn (ExchangeRate $r) => in_array($r->currency, $primaryCodes, true));

            $rows = [];
            // Add baseline PLN row
            $rows[] = [
                'PLN',
                'złoty polski (waluta bazowa)',
                '1.0000',
                '1.00000000',
                $result['effective_date'],
            ];

            foreach ($displayedRates as $rate) {
                $rows[] = [
                    $rate->currency,
                    $rate->currency_name,
                    number_format((float) $rate->mid_rate, 4, '.', ''),
                    number_format((float) $rate->multiplier, 8, '.', ''),
                    $rate->effective_date?->format('Y-m-d') ?? $result['effective_date'],
                ];
            }

            $tableTitle = $showFullTable
                ? 'Kompletna Tabela Kursów Średnich NBP'
                : 'Kluczowe Waluty Transakcyjne Deal Advisory (użyj --table, aby zobaczyć wszystkie)';

            $this->comment($tableTitle . ':');
            $this->table(
                ['Kod ISO', 'Nazwa Waluty', 'Kurs Średni (PLN)', 'Mnożnik (1/mid)', 'Data Publikacji'],
                $rows
            );

            $this->newLine();
            $this->info('Synchronizacja zakończona sukcesem.');

            return Command::SUCCESS;
        } catch (Throwable $e) {
            $this->newLine();
            $this->error("BŁĄD SYNCHRONIZACJI: {$e->getMessage()}");
            $this->line('<fg=red>Nie udało się pobrać aktualnych kursów z API NBP.</>');

            return Command::FAILURE;
        }
    }
}
