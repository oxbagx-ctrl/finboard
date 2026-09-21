<?php

declare(strict_types=1);

namespace Tests\Feature\Identity;

use App\Contexts\Identity\Domain\Events\UserInvited;
use App\Contexts\Identity\Domain\ValueObjects\InvitationId;
use App\Contexts\Identity\Domain\ValueObjects\UserId;
use App\Contexts\Identity\Infrastructure\Listeners\SendInvitationEmailListener;
use App\Contexts\Identity\Infrastructure\Mail\UserInvitationMail;
use DateTimeImmutable;
use Illuminate\Contracts\Queue\Job;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Mockery;
use Symfony\Component\Mailer\Exception\TransportException;
use Tests\TestCase;

final class InvitationMailQueueResilienceTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Config::set('mail.default', 'smtp');
        Config::set('mail.mailers.smtp.host', 'mail.helvest.pl');
        Config::set('mail.mailers.smtp.port', 587);
        Config::set('mail.mailers.smtp.encryption', 'tls');
    }

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    private function createDummyEvent(string $email = 'target.cfo@helvest.pl'): UserInvited
    {
        return new UserInvited(
            invitationId: InvitationId::generate(),
            email: $email,
            role: 'client',
            companyId: null, // in-memory, no DB dependency
            assignedCompanyIds: [],
            invitedBy: UserId::generate(),
            token: 'test_token_' . bin2hex(random_bytes(16)),
            expiresAt: new DateTimeImmutable('+48 hours')
        );
    }

    public function test_listener_implements_should_queue_contract_with_resilient_defaults(): void
    {
        $listener = new SendInvitationEmailListener();

        $this->assertInstanceOf(ShouldQueue::class, $listener);
        $this->assertSame('default', $listener->queue);
        $this->assertSame(3, $listener->tries);
        $this->assertSame(3, $listener->maxExceptions);
        $this->assertSame(30, $listener->timeout);
        $this->assertSame([10, 60, 180], $listener->backoff());
    }

    public function test_listener_simulates_smtp_timeout_on_attempt_1_and_releases_with_initial_backoff(): void
    {
        $event = $this->createDummyEvent('timeout.client@target.com');

        Mail::shouldReceive('to')
            ->once()
            ->with('timeout.client@target.com')
            ->andReturnSelf();

        Mail::shouldReceive('send')
            ->once()
            ->with(Mockery::type(UserInvitationMail::class))
            ->andThrow(new TransportException('Connection to tcp://mail.helvest.pl:587 timed out after 30 seconds'));

        // Warning logged on retry
        Log::shouldReceive('warning')
            ->once()
            ->withArgs(function (string $message) {
                return str_contains($message, 'Tymczasowy błąd wysyłki emaila do timeout.client@target.com')
                    && str_contains($message, 'próba 1/3')
                    && str_contains($message, '10s')
                    && str_contains($message, 'timed out');
            });

        // Fatal error should NOT be logged on attempt 1
        Log::shouldReceive('error')->never();

        $job = Mockery::mock(Job::class);
        $job->shouldReceive('attempts')->andReturn(1);
        $job->shouldReceive('release')->once()->with(10);

        $listener = new SendInvitationEmailListener();
        $listener->job = $job;

        $listener->handle($event);
        $this->assertTrue(true, 'Attempt 1 released job with 10s backoff');
    }

    public function test_listener_simulates_smtp_timeout_on_attempt_2_and_releases_with_increased_backoff(): void
    {
        $event = $this->createDummyEvent('timeout2.client@target.com');

        Mail::shouldReceive('to')
            ->once()
            ->with('timeout2.client@target.com')
            ->andReturnSelf();

        Mail::shouldReceive('send')
            ->once()
            ->with(Mockery::type(UserInvitationMail::class))
            ->andThrow(new TransportException('Connection could not be established with host mail.helvest.pl:587'));

        Log::shouldReceive('warning')
            ->once()
            ->withArgs(function (string $message) {
                return str_contains($message, 'Tymczasowy błąd wysyłki emaila do timeout2.client@target.com')
                    && str_contains($message, 'próba 2/3')
                    && str_contains($message, '60s');
            });

        Log::shouldReceive('error')->never();

        $job = Mockery::mock(Job::class);
        $job->shouldReceive('attempts')->andReturn(2);
        $job->shouldReceive('release')->once()->with(60);

        $listener = new SendInvitationEmailListener();
        $listener->job = $job;

        $listener->handle($event);
        $this->assertTrue(true, 'Attempt 2 released job with 60s backoff');
    }

    public function test_listener_exhausts_all_retries_on_attempt_3_and_logs_fatal_diagnostic_error(): void
    {
        $event = $this->createDummyEvent('exhausted.client@target.com');

        Mail::shouldReceive('to')
            ->once()
            ->with('exhausted.client@target.com')
            ->andReturnSelf();

        Mail::shouldReceive('send')
            ->once()
            ->with(Mockery::type(UserInvitationMail::class))
            ->andThrow(new TransportException('SSL/TLS Handshake failed on mail.helvest.pl:587'));

        Log::shouldReceive('warning')->zeroOrMoreTimes();

        // On attempt 3 (tries reached), release must NOT be called, and error must be logged
        $job = Mockery::mock(Job::class);
        $job->shouldReceive('attempts')->andReturn(3);
        $job->shouldNotReceive('release');

        Log::shouldReceive('error')
            ->once()
            ->withArgs(function (string $message, array $context) {
                return str_contains($message, 'Nie udało się wysłać wiadomości email z zaproszeniem')
                    && $context['recipient'] === 'exhausted.client@target.com'
                    && $context['attempts'] === 3
                    && $context['max_tries'] === 3
                    && $context['host'] === 'mail.helvest.pl'
                    && $context['port'] === 587
                    && str_contains($context['error_message'], 'SSL/TLS Handshake failed');
            });

        $listener = new SendInvitationEmailListener();
        $listener->job = $job;

        $listener->handle($event);
        $this->assertTrue(true, 'Attempt 3 logged fatal diagnostic error without releasing');
    }

    public function test_listener_successfully_recovers_after_retry_when_smtp_connectivity_restores(): void
    {
        $event = $this->createDummyEvent('recovered.client@target.com');

        Mail::shouldReceive('to')
            ->once()
            ->with('recovered.client@target.com')
            ->andReturnSelf();

        Mail::shouldReceive('send')
            ->once()
            ->with(Mockery::type(UserInvitationMail::class))
            ->andReturnNull();

        Log::shouldReceive('warning')->never();
        Log::shouldReceive('error')->never();

        $job = Mockery::mock(Job::class);
        $job->shouldReceive('attempts')->andReturn(2); // attempt 2 succeeds!
        $job->shouldNotReceive('release');

        $listener = new SendInvitationEmailListener();
        $listener->job = $job;

        $listener->handle($event);

        $this->assertTrue(true, 'Listener successfully delivered invitation mail on retry without throwing');
    }

    public function test_failed_lifecycle_callback_invokes_handle_mail_failure(): void
    {
        $event = $this->createDummyEvent('permanent.failure@target.com');
        $exception = new TransportException('SMTP server unreachable (554 Transaction Failed)');

        Log::shouldReceive('error')
            ->once()
            ->withArgs(function (string $message, array $context) {
                return str_contains($message, 'Nie udało się wysłać wiadomości email z zaproszeniem')
                    && $context['recipient'] === 'permanent.failure@target.com'
                    && str_contains($context['error_message'], '554 Transaction Failed');
            });

        $listener = new SendInvitationEmailListener();
        $listener->failed($event, $exception);

        $this->assertTrue(true, 'Failed lifecycle method handled exception correctly');
    }
}
