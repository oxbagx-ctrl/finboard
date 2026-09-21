<?php

declare(strict_types=1);

namespace App\Contexts\Identity\Infrastructure\Listeners;

use App\Contexts\Finance\Domain\ValueObjects\AuditAction;
use App\Contexts\Identity\Domain\Events\UserInvited;
use App\Contexts\Identity\Infrastructure\Mail\UserInvitationMail;
use App\Models\Company;
use App\Models\FinancialAuditLog;
use App\Models\User;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Throwable;

final class SendInvitationEmailListener implements ShouldQueue
{
    use InteractsWithQueue;

    public string $queue = 'default';

    public function handle(UserInvited $event): void
    {
        // Resolve target company name (if applicable)
        $companyName = null;
        if ($event->companyId() !== null) {
            try {
                $company = Company::query()->find($event->companyId());
                $companyName = $company?->name;
            } catch (Throwable) {
                $companyName = null;
            }
        }

        // Resolve assigned company names (for advisor)
        $assignedCompanyNames = [];
        if (!empty($event->assignedCompanyIds())) {
            try {
                $assignedCompanyNames = Company::query()
                    ->whereIn('id', $event->assignedCompanyIds())
                    ->pluck('name')
                    ->all();
            } catch (Throwable) {
                $assignedCompanyNames = [];
            }
        }

        // Resolve inviter name
        $inviterName = 'Administrator FinBoard';
        try {
            $inviter = User::query()->find($event->invitedBy());
            $inviterName = $inviter?->name ?? 'Administrator FinBoard';
        } catch (Throwable) {
            $inviterName = 'Administrator FinBoard';
        }

        // Construct secure activation URL with token parameter
        $baseUrl = rtrim((string) config('app.url', 'http://localhost:8080'), '/');
        $invitationUrl = $baseUrl . '/invitation/accept?token=' . urlencode($event->token());

        $mailable = new UserInvitationMail(
            invitationId: $event->invitationId(),
            recipientEmail: $event->email(),
            role: $event->role(),
            companyName: $companyName,
            assignedCompanyNames: $assignedCompanyNames,
            inviterName: $inviterName,
            invitationUrl: $invitationUrl,
            token: $event->token(),
            expiresAt: $event->expiresAt()
        );

        try {
            Mail::to($event->email())->send($mailable);
        } catch (Throwable $e) {
            $this->handleMailFailure($event, $e);
        }
    }

    /**
     * Log failure with full diagnostic context and record in audit trail.
     */
    private function handleMailFailure(UserInvited $event, Throwable $exception): void
    {
        $context = [
            'invitation_id' => $event->invitationId(),
            'recipient' => $event->email(),
            'role' => $event->role(),
            'company_id' => $event->companyId(),
            'invited_by' => $event->invitedBy(),
            'transport' => config('mail.default'),
            'host' => config('mail.mailers.smtp.host'),
            'port' => config('mail.mailers.smtp.port'),
            'error_message' => $exception->getMessage(),
            'error_code' => $exception->getCode(),
            'exception' => get_class($exception),
        ];

        Log::error('Nie udało się wysłać wiadomości email z zaproszeniem do użytkownika.', $context);

        if ($event->companyId() !== null) {
            try {
                FinancialAuditLog::create([
                    'id' => (string) Str::uuid(),
                    'company_id' => $event->companyId(),
                    'user_id' => $event->invitedBy(),
                    'action' => AuditAction::INVITATION_MAIL_FAILED->value,
                    'entity_type' => 'invitation',
                    'entity_id' => $event->invitationId(),
                    'description' => "Niepowodzenie doręczenia emaila zaproszenia do {$event->email()}: {$exception->getMessage()}",
                    'new_values' => [
                        'status' => 'delivery_failed',
                        'recipient' => $event->email(),
                        'role' => $event->role(),
                        'error_message' => $exception->getMessage(),
                        'error_code' => $exception->getCode(),
                        'host' => config('mail.mailers.smtp.host'),
                        'port' => config('mail.mailers.smtp.port'),
                    ],
                    'created_at' => now(),
                ]);
            } catch (Throwable $auditException) {
                Log::warning('Nie udało się zapisać zdarzenia błędu wysyłki do FinancialAuditLog: ' . $auditException->getMessage());
            }
        }
    }
}
