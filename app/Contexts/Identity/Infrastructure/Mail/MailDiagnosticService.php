<?php

declare(strict_types=1);

namespace App\Contexts\Identity\Infrastructure\Mail;

use Illuminate\Support\Facades\Mail;
use Throwable;

final class MailDiagnosticService
{
    /**
     * Get active mail configuration status and security attributes.
     *
     * @return array<string, mixed>
     */
    public function getStatus(?string $mailer = null): array
    {
        $activeMailer = $mailer ?? (string) config('mail.default', 'smtp');
        $mailerConfig = config("mail.mailers.{$activeMailer}", []);

        $host = isset($mailerConfig['host']) ? (string) $mailerConfig['host'] : null;
        $port = isset($mailerConfig['port']) ? (int) $mailerConfig['port'] : null;
        $encryption = isset($mailerConfig['encryption']) ? (string) $mailerConfig['encryption'] : null;
        $username = isset($mailerConfig['username']) && $mailerConfig['username'] !== null ? (string) $mailerConfig['username'] : null;
        $hasPassword = !empty($mailerConfig['password']);

        $fromAddress = (string) config('mail.from.address', '');
        $fromName = (string) config('mail.from.name', '');
        $timeout = isset($mailerConfig['timeout']) ? (int) $mailerConfig['timeout'] : 15;

        $isPort25 = $port === 25;
        $isSecurePort = in_array($port, [465, 587], true);

        return [
            'mailer' => $activeMailer,
            'host' => $host,
            'port' => $port,
            'encryption' => $encryption,
            'username' => $username,
            'has_password' => $hasPassword,
            'from_address' => $fromAddress,
            'from_name' => $fromName,
            'timeout' => $timeout,
            'is_port_25_warning' => $isPort25,
            'is_secure_port' => $isSecurePort,
            'environment' => config('app.env'),
        ];
    }

    /**
     * Check low-level socket connectivity and read SMTP server greeting banner.
     *
     * @return array{connected: bool, latency_ms: int, banner: ?string, error_code: ?int, error_message: ?string, warning: ?string}
     */
    public function checkSocket(?string $host = null, ?int $port = null, int $timeout = 5): array
    {
        $status = $this->getStatus('smtp');
        $targetHost = $host ?? $status['host'] ?? '127.0.0.1';
        $targetPort = $port ?? $status['port'] ?? 25;

        $warning = null;
        if ($targetPort === 25) {
            $warning = 'Port 25 jest blokowany przez dostawców chmurowych (np. Oracle Cloud Infrastructure OCI). Zalecane jest użycie portu 587 (TLS/STARTTLS) lub 465 (SSL).';
        }

        $errno = 0;
        $errstr = '';
        $socketAddress = "tcp://{$targetHost}:{$targetPort}";
        $startTime = microtime(true);

        $context = stream_context_create([
            'ssl' => [
                'verify_peer' => false,
                'verify_peer_name' => false,
            ],
        ]);

        $connection = @stream_socket_client(
            $socketAddress,
            $errno,
            $errstr,
            (float) $timeout,
            STREAM_CLIENT_CONNECT,
            $context
        );

        $latencyMs = (int) round((microtime(true) - $startTime) * 1000);

        if (!$connection) {
            $errorMessage = $errstr !== '' ? $errstr : 'Nie udało się nawiązać połączenia socketowego z serwerem pocztowym.';
            if ($errno === 110 || str_contains(strtolower($errstr), 'timed out')) {
                $errorMessage .= ' Przekroczono limit czasu połączenia (Connection Timed Out). Sprawdź czy port nie jest blokowany przez firewall lub Security Lists w OCI.';
            } elseif ($errno === 111 || str_contains(strtolower($errstr), 'refused')) {
                $errorMessage .= ' Połączenie odrzucone (Connection Refused). Sprawdź czy usługa SMTP nasłuchuje na wskazanym porcie.';
            }

            return [
                'connected' => false,
                'latency_ms' => $latencyMs,
                'banner' => null,
                'error_code' => $errno,
                'error_message' => $errorMessage,
                'warning' => $warning,
            ];
        }

        stream_set_timeout($connection, $timeout);
        $banner = trim((string) fgets($connection, 1024));
        fclose($connection);

        return [
            'connected' => true,
            'latency_ms' => $latencyMs,
            'banner' => $banner !== '' ? $banner : null,
            'error_code' => null,
            'error_message' => null,
            'warning' => $warning,
        ];
    }

    /**
     * Dispatch a test email and measure sending latency.
     *
     * @return array{success: bool, recipient: string, latency_ms: int, error_message: ?string}
     */
    public function sendTestEmail(string $recipient, ?string $mailer = null, ?int $socketLatencyMs = null): array
    {
        $activeMailer = $mailer ?? (string) config('mail.default', 'smtp');
        $status = $this->getStatus($activeMailer);

        $sentAt = now()->format('Y-m-d H:i:s T');

        $mailable = new TestDiagnosticMail(
            recipientEmail: $recipient,
            mailerName: $activeMailer,
            host: $status['host'] ?? null,
            port: $status['port'] ?? null,
            encryption: $status['encryption'] ?? null,
            fromAddress: $status['from_address'] ?? null,
            environment: (string) config('app.env', 'production'),
            sentAtFormatted: $sentAt,
            socketLatencyMs: $socketLatencyMs,
            diagnosticMetadata: [
                'php_version' => PHP_VERSION,
                'laravel_version' => app()->version(),
                'server_hostname' => gethostname() ?: 'finboard-app',
            ]
        );

        $startTime = microtime(true);

        try {
            Mail::mailer($activeMailer)->to($recipient)->send($mailable);

            $latencyMs = (int) round((microtime(true) - $startTime) * 1000);

            return [
                'success' => true,
                'recipient' => $recipient,
                'latency_ms' => $latencyMs,
                'error_message' => null,
            ];
        } catch (Throwable $e) {
            $latencyMs = (int) round((microtime(true) - $startTime) * 1000);

            return [
                'success' => false,
                'recipient' => $recipient,
                'latency_ms' => $latencyMs,
                'error_message' => $e->getMessage(),
            ];
        }
    }
}
