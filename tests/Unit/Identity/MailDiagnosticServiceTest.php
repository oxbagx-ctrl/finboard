<?php

declare(strict_types=1);

namespace Tests\Unit\Identity;

use App\Contexts\Identity\Infrastructure\Mail\MailDiagnosticService;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

final class MailDiagnosticServiceTest extends TestCase
{
    private MailDiagnosticService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = new MailDiagnosticService();
    }

    public function test_get_status_returns_complete_configuration_attributes(): void
    {
        Config::set('mail.default', 'smtp');
        Config::set('mail.mailers.smtp', [
            'transport' => 'smtp',
            'host' => 'mail.helvest.pl',
            'port' => 587,
            'encryption' => 'tls',
            'username' => 'advisory@helvest.pl',
            'password' => 'secret_pass_123',
            'timeout' => 15,
        ]);
        Config::set('mail.from.address', 'advisory@helvest.pl');
        Config::set('mail.from.name', 'FinBoard Advisory');

        $status = $this->service->getStatus();

        $this->assertSame('smtp', $status['mailer']);
        $this->assertSame('mail.helvest.pl', $status['host']);
        $this->assertSame(587, $status['port']);
        $this->assertSame('tls', $status['encryption']);
        $this->assertSame('advisory@helvest.pl', $status['username']);
        $this->assertTrue($status['has_password']);
        $this->assertSame('advisory@helvest.pl', $status['from_address']);
        $this->assertSame('FinBoard Advisory', $status['from_name']);
        $this->assertTrue($status['is_secure_port']);
        $this->assertFalse($status['is_port_25_warning']);
    }

    public function test_get_status_flags_port_25_warning(): void
    {
        Config::set('mail.default', 'smtp');
        Config::set('mail.mailers.smtp', [
            'transport' => 'smtp',
            'host' => 'smtp.legacy.net',
            'port' => 25,
        ]);

        $status = $this->service->getStatus();

        $this->assertSame(25, $status['port']);
        $this->assertTrue($status['is_port_25_warning']);
        $this->assertFalse($status['is_secure_port']);
    }

    public function test_check_socket_handles_unreachable_endpoint_gracefully(): void
    {
        // Connecting to a non-existent port with 1s timeout
        $result = $this->service->checkSocket('127.0.0.1', 59999, 1);

        $this->assertFalse($result['connected']);
        $this->assertNull($result['banner']);
        $this->assertNotNull($result['error_message']);
        $this->assertIsInt($result['latency_ms']);
    }

    public function test_check_socket_warns_about_port_25_oci_restriction(): void
    {
        $result = $this->service->checkSocket('127.0.0.1', 25, 1);

        $this->assertNotNull($result['warning']);
        $this->assertStringContainsString('Oracle Cloud Infrastructure', $result['warning']);
        $this->assertStringContainsString('587', $result['warning']);
    }

    public function test_send_test_email_dispatches_message_successfully(): void
    {
        Config::set('mail.default', 'array');
        Mail::fake();

        $result = $this->service->sendTestEmail('client@acme.com', 'array');

        $this->assertTrue($result['success']);
        $this->assertSame('client@acme.com', $result['recipient']);
        $this->assertNull($result['error_message']);
        $this->assertGreaterThanOrEqual(0, $result['latency_ms']);
    }

    public function test_get_status_recognizes_port_465_as_secure(): void
    {
        Config::set('mail.default', 'smtp');
        Config::set('mail.mailers.smtp', [
            'transport' => 'smtp',
            'host' => 'smtp.ssl-provider.net',
            'port' => 465,
            'encryption' => 'ssl',
            'username' => 'ssl_user',
            'password' => 'secret',
            'timeout' => 30,
        ]);

        $status = $this->service->getStatus();

        $this->assertSame(465, $status['port']);
        $this->assertSame('ssl', $status['encryption']);
        $this->assertSame(30, $status['timeout']);
        $this->assertTrue($status['is_secure_port']);
        $this->assertFalse($status['is_port_25_warning']);
    }

    public function test_get_status_handles_missing_password_and_unsecured_port(): void
    {
        Config::set('mail.default', 'smtp');
        Config::set('mail.mailers.smtp', [
            'transport' => 'smtp',
            'host' => 'smtp.internal.local',
            'port' => 2525,
            'username' => null,
            'password' => null,
        ]);

        $status = $this->service->getStatus();

        $this->assertSame(2525, $status['port']);
        $this->assertFalse($status['has_password']);
        $this->assertNull($status['username']);
        $this->assertFalse($status['is_secure_port']);
        $this->assertFalse($status['is_port_25_warning']);
    }

    public function test_send_test_email_handles_exception_and_returns_error_result(): void
    {
        Config::set('mail.mailers.faulty_mailer', [
            'transport' => 'unknown_transport_driver',
        ]);

        $result = $this->service->sendTestEmail('error@finboard.local', 'faulty_mailer');

        $this->assertFalse($result['success']);
        $this->assertSame('error@finboard.local', $result['recipient']);
        $this->assertNotNull($result['error_message']);
        $this->assertGreaterThanOrEqual(0, $result['latency_ms']);
    }
}
