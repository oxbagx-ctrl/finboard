<?php

declare(strict_types=1);

namespace Tests\Unit\Identity;

use App\Contexts\Identity\Infrastructure\Mail\UserInvitationMail;
use DateTimeImmutable;
use Tests\TestCase;

final class UserInvitationMailTest extends TestCase
{
    public function test_user_invitation_mail_envelope_and_rendered_html(): void
    {
        $mailable = new UserInvitationMail(
            invitationId: '11111111-1111-1111-1111-111111111111',
            recipientEmail: 'client.cfo@acme.com',
            role: 'client',
            companyName: 'Acme Manufacturing S.A.',
            assignedCompanyNames: [],
            inviterName: 'Admin User',
            invitationUrl: 'http://localhost:8080/invitation/accept?token=abcdef123456',
            token: 'abcdef123456',
            expiresAt: new DateTimeImmutable('2026-09-21 12:00:00')
        );

        $this->assertSame('client.cfo@acme.com', $mailable->recipientEmail);
        $this->assertSame('Klient / CFO Spółki', $mailable->roleDisplayName);

        $envelope = $mailable->envelope();
        $this->assertStringContainsString('Zaproszenie do platformy', $envelope->subject);

        $html = $mailable->render();
        $this->assertStringContainsString('Acme Manufacturing S.A.', $html);
        $this->assertStringContainsString('Klient / CFO Spółki', $html);
        $this->assertStringContainsString('http://localhost:8080/invitation/accept?token=abcdef123456', $html);
        $this->assertStringContainsString('Aktywuj Konto i Ustaw Hasło', $html);
        $this->assertStringContainsString('Admin User', $html);
        $this->assertStringContainsString('2026-09-21 12:00 UTC', $html);
    }

    public function test_advisor_invitation_mail_displays_assigned_companies(): void
    {
        $mailable = new UserInvitationMail(
            invitationId: '22222222-2222-2222-2222-222222222222',
            recipientEmail: 'advisor.expert@helvest.com',
            role: 'advisor',
            companyName: null,
            assignedCompanyNames: ['Acme S.A.', 'Helvest Sp. z o.o.'],
            inviterName: 'SuperAdmin Partner',
            invitationUrl: 'http://localhost:8080/invitation/accept?token=fedcba654321',
            token: 'fedcba654321',
            expiresAt: new DateTimeImmutable('2026-09-21 15:30:00')
        );

        $this->assertSame('Doradca Transakcyjny (Advisor)', $mailable->roleDisplayName);

        $html = $mailable->render();
        $this->assertStringContainsString('Acme S.A., Helvest Sp. z o.o.', $html);
        $this->assertStringContainsString('Doradca Transakcyjny (Advisor)', $html);
        $this->assertStringContainsString('SuperAdmin Partner', $html);
    }
}
