<?php

declare(strict_types=1);

namespace App\Contexts\Identity\Infrastructure\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

final class TestDiagnosticMail extends Mailable
{
    use Queueable, SerializesModels;

    /**
     * @param array<string, mixed> $diagnosticMetadata
     */
    public function __construct(
        public readonly string $recipientEmail,
        public readonly string $mailerName,
        public readonly ?string $host,
        public readonly ?int $port,
        public readonly ?string $encryption,
        public readonly ?string $fromAddress,
        public readonly string $environment,
        public readonly string $sentAtFormatted,
        public readonly ?int $socketLatencyMs = null,
        public readonly array $diagnosticMetadata = []
    ) {
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            to: [$this->recipientEmail],
            subject: '[FinBoard] Diagnostyka Połączenia Pocztowego (SMTP Transport Diagnostic)'
        );
    }

    public function content(): Content
    {
        $isSecurePort = in_array($this->port, [465, 587], true);
        $isPort25 = $this->port === 25;

        return new Content(
            view: 'emails.diagnostic-test',
            text: 'emails.diagnostic-test-text',
            with: [
                'recipientEmail' => $this->recipientEmail,
                'mailer' => $this->mailerName,
                'host' => $this->host,
                'port' => $this->port,
                'encryption' => $this->encryption,
                'fromAddress' => $this->fromAddress,
                'environment' => $this->environment,
                'sentAtFormatted' => $this->sentAtFormatted,
                'socketLatencyMs' => $this->socketLatencyMs,
                'diagnosticMetadata' => $this->diagnosticMetadata,
                'isSecurePort' => $isSecurePort,
                'isPort25' => $isPort25,
            ]
        );
    }
}
