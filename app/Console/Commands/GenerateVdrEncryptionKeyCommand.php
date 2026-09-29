<?php

declare(strict_types=1);

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Console\ConfirmableTrait;
use Illuminate\Support\Facades\Config;

final class GenerateVdrEncryptionKeyCommand extends Command
{
    use ConfirmableTrait;

    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'vdr:key-generate
                            {--show : Wyświetla wygenerowany klucz w terminalu bez modyfikacji pliku .env}
                            {--force : Wymusza nadpisanie klucza w środowisku produkcyjnym}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Generuje kryptograficznie bezpieczny 256-bitowy klucz szyfrowania danych spoczynkowych VDR (AES-256-GCM) i zapisuje go w pliku .env';

    /**
     * The console command aliases.
     *
     * @var array<int, string>
     */
    protected $aliases = [
        'vdr:generate-key',
    ];

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $key = 'base64:' . base64_encode(random_bytes(32));

        if ($this->option('show')) {
            $this->comment($key);
            return self::SUCCESS;
        }

        if (!$this->confirmToProceed()) {
            return self::FAILURE;
        }

        if (!$this->writeNewEnvironmentFileWith($key)) {
            return self::FAILURE;
        }

        Config::set('vdr.encryption.key', $key);
        Config::set('vdr.encryption.keys.' . (string) Config::get('vdr.encryption.active_key_id', 'vdr-key-1'), $key);

        $this->components->info("Klucz szyfrowania VDR [{$key}] został pomyślnie wygenerowany i zapisany w pliku .env.");

        return self::SUCCESS;
    }

    /**
     * Write a new environment file with the given VDR key.
     */
    private function writeNewEnvironmentFileWith(string $key): bool
    {
        $envPath = $this->laravel->environmentFilePath();

        if (!file_exists($envPath)) {
            $this->components->error("Plik konfiguracyjny środowiska nie istnieje: {$envPath}");
            return false;
        }

        $input = file_get_contents($envPath);
        if ($input === false) {
            $this->components->error("Nie można odczytać pliku środowiska: {$envPath}");
            return false;
        }

        if (preg_match('/^VDR_ENCRYPTION_KEY=.*$/m', $input)) {
            $replaced = preg_replace(
                '/^VDR_ENCRYPTION_KEY=.*$/m',
                'VDR_ENCRYPTION_KEY=' . $key,
                $input
            );
        } else {
            // Key entry was not present, append to file
            $replaced = rtrim($input) . PHP_EOL . 'VDR_ENCRYPTION_KEY=' . $key . PHP_EOL;
        }

        if (file_put_contents($envPath, $replaced) === false) {
            $this->components->error("Nie udało się zapisać zaktualizowanego klucza do pliku: {$envPath}");
            return false;
        }

        return true;
    }
}
