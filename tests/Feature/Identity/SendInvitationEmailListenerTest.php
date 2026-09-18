<?php

declare(strict_types=1);

namespace Tests\Feature\Identity;

use App\Contexts\Identity\Application\Commands\InviteUserCommand;
use App\Contexts\Identity\Application\UseCases\InviteUserUseCase;
use App\Contexts\Identity\Domain\Events\UserInvited;
use App\Contexts\Identity\Domain\ValueObjects\InvitationId;
use App\Contexts\Identity\Domain\ValueObjects\UserId;
use App\Contexts\Identity\Infrastructure\Listeners\SendInvitationEmailListener;
use App\Contexts\Identity\Infrastructure\Mail\UserInvitationMail;
use App\Models\Company;
use App\Models\User;
use DateTimeImmutable;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

final class SendInvitationEmailListenerTest extends TestCase
{
    use DatabaseTransactions;

    private User $admin;
    private Company $company;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::firstOrCreate(
            ['email' => 'admin@helvest.com'],
            [
                'name' => 'Admin Helvest',
                'password' => bcrypt('password123'),
                'role' => 'super_admin',
                'is_active' => true,
            ]
        );

        $this->company = Company::firstOrCreate(
            ['code' => 'ACME'],
            ['name' => 'Acme Manufacturing S.A.']
        );
    }

    public function test_listener_is_registered_for_user_invited_event(): void
    {
        $this->assertTrue(
            Event::hasListeners(UserInvited::class),
            'UserInvited event must have registered listeners'
        );

        $listeners = Event::getListeners(UserInvited::class);
        $this->assertNotEmpty($listeners);

        $reflection = new \ReflectionFunction($listeners[0]);
        $staticVariables = $reflection->getStaticVariables();
        $this->assertSame(
            SendInvitationEmailListener::class,
            $staticVariables['listener'] ?? null
        );
    }

    public function test_listener_sends_user_invitation_mail(): void
    {
        Mail::fake();

        $invitationId = InvitationId::generate();
        $event = new UserInvited(
            invitationId: $invitationId,
            email: 'new.member@acme.com',
            role: 'client',
            companyId: (string) $this->company->id,
            assignedCompanyIds: [],
            invitedBy: UserId::fromString((string) $this->admin->id),
            token: 'secret_token_1234567890abcdef',
            expiresAt: (new DateTimeImmutable())->modify('+48 hours')
        );

        $listener = new SendInvitationEmailListener();
        $listener->handle($event);

        Mail::assertQueued(UserInvitationMail::class, function (UserInvitationMail $mail) use ($invitationId) {
            return $mail->invitationId === $invitationId->value()
                && $mail->recipientEmail === 'new.member@acme.com'
                && $mail->role === 'client'
                && $mail->companyName === 'Acme Manufacturing S.A.'
                && $mail->inviterName === $this->admin->name
                && str_contains($mail->invitationUrl, 'secret_token_1234567890abcdef');
        });
    }

    public function test_invite_user_use_case_triggers_invitation_mail_via_listener(): void
    {
        Mail::fake();

        $useCase = $this->app->make(InviteUserUseCase::class);

        $command = new InviteUserCommand(
            invitedById: (string) $this->admin->id,
            email: 'client.director@acme.com',
            role: 'client',
            companyId: (string) $this->company->id
        );

        $useCase->execute($command);

        Mail::assertQueued(UserInvitationMail::class, function (UserInvitationMail $mail) {
            return $mail->recipientEmail === 'client.director@acme.com'
                && $mail->role === 'client'
                && $mail->companyName === 'Acme Manufacturing S.A.'
                && !empty($mail->token)
                && str_contains($mail->invitationUrl, '/invitation/accept?token=');
        });
    }
}
