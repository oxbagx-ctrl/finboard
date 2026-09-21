<?php

declare(strict_types=1);

namespace Tests\Feature\Console;

use App\Contexts\Identity\Infrastructure\Mail\TestDiagnosticMail;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

final class TestMailConnectionCommandTest extends TestCase
{
    public function test_command_executes_successfully_with_skip_send(): void
    {
        $this->artisan('mail:test', [
            'recipient' => 'test@finboard.local',
            '--transport' => 'log',
            '--skip-send' => true,
        ])
            ->expectsOutputToContain('FINBOARD - DIAGNOSTYKA POŁĄCZENIA POCZTY (SMTP)')
            ->expectsOutputToContain('1. Weryfikacja Konfiguracji Środowiska:')
            ->expectsOutputToContain('3. Pominięto wysyłkę wiadomości testowej (--skip-send).')
            ->assertSuccessful();
    }

    public function test_command_warns_about_port_25(): void
    {
        Config::set('mail.mailers.smtp.port', 25);

        $this->artisan('mail:test', [
            '--transport' => 'smtp',
            '--skip-send' => true,
            '--timeout' => 1,
        ])
            ->expectsOutputToContain('[OSTRZEŻENIE] Wykryto port 25!')
            ->expectsOutputToContain('Oracle Cloud Infrastructure OCI');
    }

    public function test_command_dispatches_email_successfully_with_array_transport(): void
    {
        Mail::fake();

        $this->artisan('mail:test', [
            'recipient' => 'cfo@helvest.pl',
            '--transport' => 'array',
        ])
            ->expectsOutputToContain('Wysyłanie wiadomości testowej do: cfo@helvest.pl')
            ->expectsOutputToContain('[OK] Wiadomość testowa została pomyślnie wysłana!')
            ->assertSuccessful();

        Mail::assertSent(TestDiagnosticMail::class, function (TestDiagnosticMail $mail) {
            return $mail->recipientEmail === 'cfo@helvest.pl'
                && $mail->mailerName === 'array';
        });
    }

    public function test_command_fails_gracefully_when_smtp_socket_unreachable(): void
    {
        Config::set('mail.mailers.smtp.host', '127.0.0.1');
        Config::set('mail.mailers.smtp.port', 59999);

        $this->artisan('mail:test', [
            '--transport' => 'smtp',
            '--skip-send' => true,
            '--timeout' => 1,
        ])
            ->expectsOutputToContain('[BŁĄD POŁĄCZENIA]')
            ->assertFailed();
    }

    public function test_command_prompts_for_valid_email_when_missing_and_handles_invalid_input(): void
    {
        Config::set('mail.from.address', '');

        $this->artisan('mail:test', [
            '--transport' => 'array',
        ])
            ->expectsQuestion('Podaj adres email do wysyłki testowej', 'not-a-valid-email')
            ->expectsOutputToContain('[BŁĄD] Podano nieprawidłowy adres email odbiorcy.')
            ->assertFailed();
    }

    public function test_command_prompts_and_succeeds_when_valid_email_is_entered_interactively(): void
    {
        Mail::fake();
        Config::set('mail.from.address', '');

        $this->artisan('mail:test', [
            '--transport' => 'array',
        ])
            ->expectsQuestion('Podaj adres email do wysyłki testowej', 'interactive@helvest.pl')
            ->expectsOutputToContain('Wysyłanie wiadomości testowej do: interactive@helvest.pl')
            ->expectsOutputToContain('[OK] Wiadomość testowa została pomyślnie wysłana!')
            ->assertSuccessful();

        Mail::assertSent(TestDiagnosticMail::class, function (TestDiagnosticMail $mail) {
            return $mail->recipientEmail === 'interactive@helvest.pl';
        });
    }

    public function test_command_handles_mail_send_failure_gracefully(): void
    {
        // Using non-existent transport driver to trigger send exception
        Config::set('mail.mailers.invalid_mailer', [
            'transport' => 'non_existent_driver',
        ]);

        $this->artisan('mail:test', [
            'recipient' => 'test@finboard.local',
            '--transport' => 'invalid_mailer',
        ])
            ->expectsOutputToContain('[BŁĄD WYSYŁKI]')
            ->expectsOutputToContain('Wysyłka wiadomości testowej zakończona niepowodzeniem.')
            ->assertFailed();
    }
}
