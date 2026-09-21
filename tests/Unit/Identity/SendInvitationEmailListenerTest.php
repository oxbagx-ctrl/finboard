<?php

declare(strict_types=1);

namespace Tests\Unit\Identity;

use App\Contexts\Identity\Domain\Events\UserInvited;
use App\Contexts\Identity\Domain\ValueObjects\InvitationId;
use App\Contexts\Identity\Domain\ValueObjects\UserId;
use App\Contexts\Identity\Infrastructure\Listeners\SendInvitationEmailListener;
use DateTimeImmutable;
use Illuminate\Contracts\Queue\Job;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Mockery;
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

    public function test_listener_declares_retry_properties_and_backoff_schedule(): void
    {
        $listener = new SendInvitationEmailListener();

        $this->assertSame(3, $listener->tries);
        $this->assertSame(3, $listener->maxExceptions);
        $this->assertSame(30, $listener->timeout);
        $this->assertSame('default', $listener->queue);
        $this->assertSame([10, 60, 180], $listener->backoff());
    }

    public function test_listener_releases_job_with_exponential_backoff_on_intermediate_attempt(): void
    {
        Config::set('mail.default', 'smtp');

        Mail::shouldReceive('to')
            ->once()
            ->with('retry.cfo@targetcorp.com')
            ->andReturnSelf();

        Mail::shouldReceive('send')
            ->once()
            ->andThrow(new RuntimeException('Connection timed out on port 587'));

        // Expect warning log for retry
        Log::shouldReceive('warning')
            ->once()
            ->withArgs(function (string $message) {
                return str_contains($message, 'Tymczasowy błąd wysyłki')
                    && str_contains($message, 'próba 1/3')
                    && str_contains($message, '10s');
            });

        // Error should NOT be logged yet on attempt 1
        Log::shouldNotReceive('error');

        $jobMock = Mockery::mock(Job::class);
        $jobMock->shouldReceive('attempts')->andReturn(1);
        $jobMock->shouldReceive('release')->once()->with(10);

        $event = new UserInvited(
            invitationId: InvitationId::generate(),
            email: 'retry.cfo@targetcorp.com',
            role: 'client',
            companyId: null,
            assignedCompanyIds: [],
            invitedBy: UserId::generate(),
            token: 'test_token_retry_123',
            expiresAt: new DateTimeImmutable('+48 hours')
        );

        $listener = new SendInvitationEmailListener();
        $listener->job = $jobMock;

        $listener->handle($event);
    }

    public function test_listener_exhausts_retries_and_executes_handle_mail_failure_on_last_attempt(): void
    {
        Config::set('mail.default', 'smtp');
        Config::set('mail.mailers.smtp.host', 'mail.helvest.pl');
        Config::set('mail.mailers.smtp.port', 587);

        Mail::shouldReceive('to')
            ->once()
            ->with('exhausted@targetcorp.com')
            ->andReturnSelf();

        Mail::shouldReceive('send')
            ->once()
            ->andThrow(new RuntimeException('Permanent connection timeout'));

        // On attempt 3 (max tries reached), job should NOT be released, but error logged
        $jobMock = Mockery::mock(Job::class);
        $jobMock->shouldReceive('attempts')->andReturn(3);
        $jobMock->shouldNotReceive('release');

        Log::shouldReceive('error')
            ->once()
            ->withArgs(function (string $message, array $context) {
                return str_contains($message, 'Nie udało się wysłać wiadomości email z zaproszeniem')
                    && $context['recipient'] === 'exhausted@targetcorp.com'
                    && $context['attempts'] === 3
                    && $context['max_tries'] === 3;
            });

        Log::shouldReceive('warning')->zeroOrMoreTimes();

        $event = new UserInvited(
            invitationId: InvitationId::generate(),
            email: 'exhausted@targetcorp.com',
            role: 'client',
            companyId: null,
            assignedCompanyIds: [],
            invitedBy: UserId::generate(),
            token: 'test_token_exhausted_123',
            expiresAt: new DateTimeImmutable('+48 hours')
        );

        $listener = new SendInvitationEmailListener();
        $listener->job = $jobMock;

        $listener->handle($event);
    }
}
