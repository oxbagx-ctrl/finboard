<?php

declare(strict_types=1);

namespace App\Contexts\Identity\Infrastructure\Listeners;

use App\Contexts\Identity\Domain\Events\UserInvited;
use App\Contexts\Identity\Infrastructure\Mail\UserInvitationMail;
use App\Models\Company;
use App\Models\User;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Facades\Mail;

final class SendInvitationEmailListener implements ShouldQueue
{
    use InteractsWithQueue;

    public string $queue = 'default';

    public function handle(UserInvited $event): void
    {
        // Resolve target company name (if applicable)
        $companyName = null;
        if ($event->companyId() !== null) {
            $company = Company::query()->find($event->companyId());
            $companyName = $company?->name;
        }

        // Resolve assigned company names (for advisor)
        $assignedCompanyNames = [];
        if (!empty($event->assignedCompanyIds())) {
            $assignedCompanyNames = Company::query()
                ->whereIn('id', $event->assignedCompanyIds())
                ->pluck('name')
                ->all();
        }

        // Resolve inviter name
        $inviter = User::query()->find($event->invitedBy());
        $inviterName = $inviter?->name ?? 'Administrator FinBoard';

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

        Mail::to($event->email())->send($mailable);
    }
}
