<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Contexts\Identity\Infrastructure\Mail\MailDiagnosticService;
use Illuminate\Console\Command;

final class TestMailConnectionCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'mail:test 
                            {recipient? : Adres email odbiorcy testowej wiadomości}
                            {--transport= : Opcjonalne wymuszenie mailera (np. smtp, log, array)}
                            {--timeout=5 : Timeout połączenia socketowego w sekundach}
                            {--skip-send : Weryfikuje wyłącznie konfigurację i gniazdo sieciowe bez nadawania maila}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Weryfikuje konfigurację SMTP, testuje połączenie socketowe i handshake oraz wysyła diagnostyczny email';

    /**
     * Execute the console command.
     */
    public function handle(MailDiagnosticService $diagnosticService): int
    {
        $this->newLine();
        $this->line('<fg=cyan;options=bold>===============================================================</>');
        $this->line('<fg=cyan;options=bold>       FINBOARD - DIAGNOSTYKA POŁĄCZENIA POCZTY (SMTP)         </>');
        $this->line('<fg=cyan;options=bold>===============================================================</>');
        $this->newLine();

        $defaultMailer = (string) config('mail.default', 'smtp');
        $transport = (string) ($this->option('transport') ?: $defaultMailer);
        $status = $diagnosticService->getStatus($transport);
        $timeout = (int) $this->option('timeout');

        // Step 1: Configuration summary
        $this->info('1. Weryfikacja Konfiguracji Środowiska:');
        $this->table(
            ['Parametr', 'Wartość'],
            [
                ['Aktywny Mailer (default)', $status['mailer']],
                ['Wybrany Transport', $transport],
                ['Host SMTP', $status['host'] ?? '<brak>'],
                ['Port SMTP', (string) ($status['port'] ?? '<brak>')],
                ['Szyfrowanie (encryption)', $status['encryption'] ?: '<brak (plain)>'],
                ['Użytkownik (username)', $status['username'] ?: '<brak>'],
                ['Hasło (password)', $status['has_password'] ? '******** (skonfigurowano)' : '<brak>'],
                ['Adres Nadawcy (From)', $status['from_address'] ?: '<brak>'],
                ['Nazwa Nadawcy', $status['from_name'] ?: '<brak>'],
                ['Timeout Socketu', "{$timeout}s"],
                ['Środowisko (APP_ENV)', $status['environment']],
            ]
        );

        if ($status['is_port_25_warning'] && $transport === 'smtp') {
            $this->newLine();
            $this->warn(' [OSTRZEŻENIE] Wykryto port 25!');
            $this->line(' <fg=yellow>Port 25 jest powszechnie blokowany przez dostawców chmurowych (np. Oracle Cloud Infrastructure OCI).</>');
            $this->line(' <fg=yellow>Zaleca się użycie bezpiecznego portu 587 (TLS/STARTTLS) lub 465 (SSL).</>');
        }

        // Step 2: Socket check (for SMTP transport)
        if ($transport === 'smtp') {
            $this->newLine();
            $this->info('2. Test Połączenia Socketowego (Network Handshake):');

            $host = $status['host'];
            $port = $status['port'];

            if (!$host || !$port) {
                $this->error(' [BŁĄD] Brak zdefiniowanego MAIL_HOST lub MAIL_PORT w konfiguracji.');
                return self::FAILURE;
            }

            $this->line(" Łączenie z tcp://{$host}:{$port} (timeout: {$timeout}s)...");
            $socketResult = $diagnosticService->checkSocket($host, $port, $timeout);

            if (!$socketResult['connected']) {
                $this->error(' [BŁĄD POŁĄCZENIA]');
                $this->line(" Kod błędu: " . ($socketResult['error_code'] ?? 'N/A'));
                $this->line(" Komunikat: {$socketResult['error_message']}");

                if ($socketResult['warning']) {
                    $this->warn(" Wskazówka: {$socketResult['warning']}");
                }

                $this->newLine();
                $this->error('Test połączenia SMTP zakończony niepowodzeniem.');
                return self::FAILURE;
            }

            $this->line(" <fg=green;options=bold>[OK] Gniazdo sieciowe otwarte pomyślnie</> (latencja: {$socketResult['latency_ms']}ms)");
            if ($socketResult['banner']) {
                $this->line(" <fg=gray>Odpowiedź serwera (Banner): {$socketResult['banner']}</>");
            }
        } else {
            $this->newLine();
            $this->info("2. Pominięto test gniazda sieciowego dla transportu '{$transport}'.");
        }

        // Step 3: Test Email Sending
        if ($this->option('skip-send')) {
            $this->newLine();
            $this->info('3. Pominięto wysyłkę wiadomości testowej (--skip-send).');
            $this->newLine();
            $this->line('<fg=green;options=bold>Weryfikacja konfiguracji i gniazda SMTP zakończona sukcesem!</>');
            return self::SUCCESS;
        }

        $recipient = (string) ($this->argument('recipient') ?: $status['from_address']);

        if (!$recipient || !filter_var($recipient, FILTER_VALIDATE_EMAIL)) {
            $this->newLine();
            $recipient = (string) $this->ask('Podaj adres email do wysyłki testowej');
        }

        if (!filter_var($recipient, FILTER_VALIDATE_EMAIL)) {
            $this->error(' [BŁĄD] Podano nieprawidłowy adres email odbiorcy.');
            return self::FAILURE;
        }

        $this->newLine();
        $this->info("3. Wysyłka Diagnostycznej Wiadomości Email:");
        $this->line(" Wysyłanie wiadomości testowej do: <fg=cyan>{$recipient}</> przy użyciu mailera: <fg=cyan>{$transport}</>...");

        $socketLatency = (isset($socketResult) && is_array($socketResult) && ($socketResult['connected'] ?? false)) ? $socketResult['latency_ms'] : null;
        $sendResult = $diagnosticService->sendTestEmail($recipient, $transport, $socketLatency);

        if (!$sendResult['success']) {
            $this->error(' [BŁĄD WYSYŁKI]');
            $this->line(" Komunikat błędu: {$sendResult['error_message']}");
            $this->newLine();
            $this->error('Wysyłka wiadomości testowej zakończona niepowodzeniem.');
            return self::FAILURE;
        }

        $this->line(" <fg=green;options=bold>[OK] Wiadomość testowa została pomyślnie wysłana!</> (czas wysyłki: {$sendResult['latency_ms']}ms)");
        $this->newLine();
        $this->line('<fg=green;options=bold>Wszystkie testy diagnostyczne SMTP zakończone sukcesem!</>');
        $this->newLine();

        return self::SUCCESS;
    }
}
