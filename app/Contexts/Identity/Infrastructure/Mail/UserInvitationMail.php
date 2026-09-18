<?php

declare(strict_types=1);

namespace App\Contexts\Identity\Infrastructure\Mail;

use DateTimeImmutable;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Address;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

final class UserInvitationMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public string $roleDisplayName;
    public string $expiresAtFormatted;

    /**
     * @param array<string> $assignedCompanyNames
     */
    public function __construct(
        public readonly string $invitationId,
        public readonly string $recipientEmail,
        public readonly string $role,
        public readonly ?string $companyName,
        public readonly array $assignedCompanyNames,
        public readonly ?string $inviterName,
        public readonly string $invitationUrl,
        public readonly string $token,
        public readonly DateTimeImmutable $expiresAt
    ) {
        $this->roleDisplayName = match (strtolower(trim($this->role))) {
            'super_admin', 'superadmin', 'partner' => 'Super Administrator (Partner)',
            'advisor', 'doradca' => 'Doradca Transakcyjny (Advisor)',
            'client', 'klient' => 'Klient / CFO Spółki',
            default => ucfirst($this->role),
        };

        $this->expiresAtFormatted = $this->expiresAt->format('Y-m-d H:i') . ' UTC';
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            to: [$this->recipientEmail],
            subject: '[FinBoard] Zaproszenie do platformy Deal Advisory & VDR'
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.user-invitation',
            text: 'emails.user-invitation-text',
            with: [
                'roleDisplayName' => $this->roleDisplayName,
                'companyName' => $this->companyName,
                'assignedCompanyNames' => $this->assignedCompanyNames,
                'inviterName' => $this->inviterName,
                'invitationUrl' => $this->invitationUrl,
                'token' => $this->token,
                'expiresAtFormatted' => $this->expiresAtFormatted,
            ]
        );
    }
}
