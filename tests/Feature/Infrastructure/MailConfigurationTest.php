<?php

declare(strict_types=1);

namespace Tests\Feature\Infrastructure;

use App\Contexts\Identity\Infrastructure\Mail\UserInvitationMail;
use DateTimeImmutable;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

final class MailConfigurationTest extends TestCase
{
    public function test_smtp_mailer_is_properly_configured(): void
    {
        $smtpConfig = config('mail.mailers.smtp');

        $this->assertIsArray($smtpConfig);
        $this->assertSame('smtp', $smtpConfig['transport']);
        $this->assertArrayHasKey('host', $smtpConfig);
        $this->assertArrayHasKey('port', $smtpConfig);
    }

    public function test_user_invitation_mail_can_be_sent_via_mail_facade(): void
    {
        Mail::fake();

        $mailable = new UserInvitationMail(
            invitationId: 'inv-test-id',
            recipientEmail: 'client@company.com',
            role: 'client',
            companyName: 'Acme Manufacturing S.A.',
            assignedCompanyNames: [],
            inviterName: 'Partner Helvest',
            invitationUrl: 'http://localhost:8080/accept-invitation?token=token-123',
            token: 'token-123',
            expiresAt: new DateTimeImmutable('+48 hours')
        );

        Mail::to('client@company.com')->send($mailable);

        Mail::assertQueued(UserInvitationMail::class, function (UserInvitationMail $mail) {
            return $mail->hasTo('client@company.com')
                && $mail->roleDisplayName === 'Klient / CFO Spółki'
                && $mail->companyName === 'Acme Manufacturing S.A.';
        });
    }
}
