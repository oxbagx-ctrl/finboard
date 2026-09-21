<?php

declare(strict_types=1);

namespace Tests\Unit\Identity;

use App\Contexts\Identity\Infrastructure\Mail\MailDiagnosticService;
use App\Contexts\Identity\Infrastructure\Mail\TestDiagnosticMail;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

final class TestDiagnosticMailTest extends TestCase
{
    public function test_diagnostic_mail_envelope_has_correct_subject_and_recipient(): void
    {
        $mailable = new TestDiagnosticMail(
            recipientEmail: 'advisory@helvest.pl',
            mailerName: 'smtp',
            host: 'mail.helvest.pl',
            port: 587,
            encryption: 'tls',
            fromAddress: 'advisory@helvest.pl',
            environment: 'production',
            sentAtFormatted: '2026-09-22 12:00:00 UTC',
            socketLatencyMs: 42,
            diagnosticMetadata: [
                'php_version' => '8.2.20',
                'laravel_version' => '11.0.0',
                'server_hostname' => 'prod-oci-app-1',
            ]
        );

        $envelope = $mailable->envelope();

        $this->assertSame('[FinBoard] Diagnostyka Połączenia Pocztowego (SMTP Transport Diagnostic)', $envelope->subject);
        $this->assertCount(1, $envelope->to);
        $this->assertSame('advisory@helvest.pl', $envelope->to[0]->address);
    }

    public function test_diagnostic_mail_renders_html_with_deal_advisory_dark_theme_and_metrics(): void
    {
        $mailable = new TestDiagnosticMail(
            recipientEmail: 'admin@finboard.local',
            mailerName: 'smtp',
            host: 'mail.helvest.pl',
            port: 587,
            encryption: 'tls',
            fromAddress: 'advisory@helvest.pl',
            environment: 'production',
            sentAtFormatted: '2026-09-22 12:34:56 UTC',
            socketLatencyMs: 28,
            diagnosticMetadata: [
                'php_version' => '8.2.20',
                'laravel_version' => '11.0.0',
                'server_hostname' => 'finboard-oci-node-01',
            ]
        );

        $renderedHtml = $mailable->render();

        $this->assertStringContainsString('FinBoard', $renderedHtml);
        $this->assertStringContainsString('SMTP Diagnostic Ping', $renderedHtml);
        $this->assertStringContainsString('admin@finboard.local', $renderedHtml);
        $this->assertStringContainsString('mail.helvest.pl', $renderedHtml);
        $this->assertStringContainsString('587', $renderedHtml);
        $this->assertStringContainsString('Bezpieczny (TLS/SSL)', $renderedHtml);
        $this->assertStringContainsString('28 ms', $renderedHtml);
        $this->assertStringContainsString('finboard-oci-node-01', $renderedHtml);
        $this->assertStringContainsString('#09090b', $renderedHtml);
        $this->assertStringContainsString('2026-09-22 12:34:56 UTC', $renderedHtml);
    }

    public function test_diagnostic_mail_renders_port_25_warning_when_applicable(): void
    {
        $mailable = new TestDiagnosticMail(
            recipientEmail: 'test@legacy.com',
            mailerName: 'smtp',
            host: 'smtp.legacy.net',
            port: 25,
            encryption: null,
            fromAddress: 'no-reply@legacy.com',
            environment: 'staging',
            sentAtFormatted: '2026-09-22 12:00:00 UTC'
        );

        $renderedHtml = $mailable->render();

        $this->assertStringContainsString('Port 25 (OCI Warning)', $renderedHtml);
    }

    public function test_send_test_email_dispatches_test_diagnostic_mail_via_mail_facade(): void
    {
        Mail::fake();
        Config::set('mail.default', 'array');

        $service = new MailDiagnosticService();
        $result = $service->sendTestEmail('diagnostic-verify@helvest.pl', 'array', 35);

        $this->assertTrue($result['success']);
        $this->assertSame('diagnostic-verify@helvest.pl', $result['recipient']);

        Mail::assertSent(TestDiagnosticMail::class, function (TestDiagnosticMail $mail) {
            return $mail->recipientEmail === 'diagnostic-verify@helvest.pl'
                && $mail->mailerName === 'array'
                && $mail->socketLatencyMs === 35;
        });
    }
}
