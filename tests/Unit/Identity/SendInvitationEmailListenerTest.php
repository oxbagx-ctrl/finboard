<?php

declare(strict_types=1);

namespace Tests\Unit\Identity;

use App\Contexts\Identity\Domain\Events\UserInvited;
use App\Contexts\Identity\Domain\ValueObjects\InvitationId;
use App\Contexts\Identity\Domain\ValueObjects\UserId;
use App\Contexts\Identity\Infrastructure\Listeners\SendInvitationEmailListener;
use DateTimeImmutable;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use RuntimeException;
use Tests\TestCase;

final class SendInvitationEmailListenerTest extends TestCase
{
    public function test_listener_catches_mailer_exception_and_logs_error_context(): void
    {
        Config::set('mail.default', 'smtp');
        Config::set('mail.mailers.smtp.host', 'mail.helvest.pl');
        Config::set('mail.mailers.smtp.port', 587);

        // Simulate mail failure
        Mail::shouldReceive('to')
            ->once()
            ->with('invited.cfo@targetcorp.com')
            ->andReturnSelf();

        Mail::shouldReceive('send')
            ->once()
            ->andThrow(new RuntimeException('Connection to mail.helvest.pl:587 timed out after 15 seconds'));

        // Expect error logged with detailed diagnostic context
        Log::shouldReceive('error')
            ->once()
            ->withArgs(function (string $message, array $context) {
                return str_contains($message, 'Nie udało się wysłać wiadomości email z zaproszeniem')
                    && $context['recipient'] === 'invited.cfo@targetcorp.com'
                    && $context['role'] === 'client'
                    && $context['host'] === 'mail.helvest.pl'
                    && $context['port'] === 587
                    && str_contains($context['error_message'], 'timed out');
            });

        Log::shouldReceive('warning')->zeroOrMoreTimes();

        $invitationId = InvitationId::generate();
        $event = new UserInvited(
            invitationId: $invitationId,
            email: 'invited.cfo@targetcorp.com',
            role: 'client',
            companyId: null, // companyId null avoids DB queries on host
            assignedCompanyIds: [],
            invitedBy: UserId::generate(),
            token: 'test_token_abc_123456789',
            expiresAt: new DateTimeImmutable('+72 hours')
        );

        $listener = new SendInvitationEmailListener();

        // Must complete without throwing any exception
        $listener->handle($event);
        $this->assertTrue(true, 'Listener handled mail failure gracefully without throwing unhandled exception');
    }

    public function test_listener_attempts_audit_trail_and_does_not_crash_on_db_exception(): void
    {
        Config::set('mail.default', 'smtp');

        Mail::shouldReceive('to')
            ->once()
            ->with('fail.audit@helvest.pl')
            ->andReturnSelf();

        Mail::shouldReceive('send')
            ->once()
            ->andThrow(new RuntimeException('SMTP Auth Failed (535 Incorrect credentials)'));

        Log::shouldReceive('error')->once();
        Log::shouldReceive('warning')->zeroOrMoreTimes();

        $event = new UserInvited(
            invitationId: InvitationId::generate(),
            email: 'fail.audit@helvest.pl',
            role: 'advisor',
            companyId: 'non-existent-company-uuid',
            assignedCompanyIds: [],
            invitedBy: UserId::generate(),
            token: 'test_token_audit_123',
            expiresAt: new DateTimeImmutable('+48 hours')
        );

        $listener = new SendInvitationEmailListener();

        // When DB is unavailable or company not found, warning is caught and process never crashes
        $listener->handle($event);
        $this->assertTrue(true, 'Listener handles audit log failure gracefully without crashing');
    }
}
