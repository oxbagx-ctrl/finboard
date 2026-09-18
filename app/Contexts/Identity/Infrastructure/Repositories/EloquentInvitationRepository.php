<?php

declare(strict_types=1);

namespace App\Contexts\Identity\Infrastructure\Repositories;

use App\Contexts\Identity\Domain\Entities\Invitation;
use App\Contexts\Identity\Domain\Entities\Role;
use App\Contexts\Identity\Domain\Repositories\InvitationRepositoryInterface;
use App\Contexts\Identity\Domain\ValueObjects\Email;
use App\Contexts\Identity\Domain\ValueObjects\InvitationId;
use App\Contexts\Identity\Domain\ValueObjects\InvitationStatus;
use App\Contexts\Identity\Domain\ValueObjects\Token;
use App\Contexts\Identity\Domain\ValueObjects\UserId;
use App\Models\Invitation as InvitationModel;
use DateTimeImmutable;
use Illuminate\Contracts\Events\Dispatcher as EventDispatcher;

final class EloquentInvitationRepository implements InvitationRepositoryInterface
{
    public function __construct(
        private readonly EventDispatcher $eventDispatcher
    ) {
    }

    public function findById(InvitationId $id): ?Invitation
    {
        $model = InvitationModel::find($id->value());
        if ($model === null) {
            return null;
        }

        return $this->toDomain($model);
    }

    public function findByToken(string $token): ?Invitation
    {
        $model = InvitationModel::where('token', trim($token))->first();
        if ($model === null) {
            return null;
        }

        return $this->toDomain($model);
    }

    public function findPendingByEmail(Email $email): ?Invitation
    {
        $model = InvitationModel::where('email', $email->value())
            ->where('status', InvitationStatus::PENDING->value)
            ->where('expires_at', '>', now())
            ->latest('created_at')
            ->first();

        if ($model === null) {
            return null;
        }

        return $this->toDomain($model);
    }

    public function save(Invitation $invitation): void
    {
        $model = InvitationModel::find($invitation->id()) ?? new InvitationModel();

        $model->id = $invitation->id();
        $model->email = $invitation->email()->value();
        $model->role = $invitation->role()->name()->value;
        $model->company_id = $invitation->companyId();
        $model->assigned_companies = $invitation->assignedCompanyIds();
        $model->token = $invitation->token()->value();
        $model->invited_by = $invitation->invitedBy()->value();
        $model->status = $invitation->status()->value;
        $model->expires_at = $invitation->token()->expiresAt()->format('Y-m-d H:i:s');
        $model->accepted_at = $invitation->acceptedAt()?->format('Y-m-d H:i:s');
        $model->revoked_at = $invitation->revokedAt()?->format('Y-m-d H:i:s');
        $model->revoked_by = $invitation->revokedBy()?->value();
        $model->save();

        // Release and dispatch all recorded domain events
        foreach ($invitation->releaseEvents() as $event) {
            $this->eventDispatcher->dispatch($event);
        }
    }

    public function delete(InvitationId $id): void
    {
        InvitationModel::destroy($id->value());
    }

    /**
     * @return array<Invitation>
     */
    public function findAll(): array
    {
        return InvitationModel::orderBy('created_at', 'desc')
            ->get()
            ->map(fn (InvitationModel $model) => $this->toDomain($model))
            ->all();
    }

    /**
     * @return array<Invitation>
     */
    public function findPending(): array
    {
        return InvitationModel::pending()
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(fn (InvitationModel $model) => $this->toDomain($model))
            ->all();
    }

    /**
     * @return array<Invitation>
     */
    public function findByCompanyId(string $companyId): array
    {
        return InvitationModel::where('company_id', $companyId)
            ->orWhereJsonContains('assigned_companies', $companyId)
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(fn (InvitationModel $model) => $this->toDomain($model))
            ->all();
    }

    /**
     * @return array<Invitation>
     */
    public function findByInvitedBy(UserId $userId): array
    {
        return InvitationModel::where('invited_by', $userId->value())
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(fn (InvitationModel $model) => $this->toDomain($model))
            ->all();
    }

    private function toDomain(InvitationModel $model): Invitation
    {
        $role = Role::fromString((string) $model->role);
        $status = InvitationStatus::tryFrom((string) $model->status) ?? InvitationStatus::PENDING;
        $expiresAt = new DateTimeImmutable($model->expires_at->toIso8601String());
        $token = Token::fromString((string) $model->token, $expiresAt);
        $createdAt = new DateTimeImmutable($model->created_at?->toIso8601String() ?? 'now');
        $acceptedAt = $model->accepted_at ? new DateTimeImmutable($model->accepted_at->toIso8601String()) : null;
        $revokedAt = $model->revoked_at ? new DateTimeImmutable($model->revoked_at->toIso8601String()) : null;
        $revokedBy = $model->revoked_by ? UserId::fromString((string) $model->revoked_by) : null;

        return new Invitation(
            id: InvitationId::fromString((string) $model->id),
            email: Email::fromString((string) $model->email),
            role: $role,
            invitedBy: UserId::fromString((string) $model->invited_by),
            companyId: $model->company_id !== null ? (string) $model->company_id : null,
            assignedCompanyIds: is_array($model->assigned_companies) ? $model->assigned_companies : [],
            token: $token,
            status: $status,
            createdAt: $createdAt,
            acceptedAt: $acceptedAt,
            revokedAt: $revokedAt,
            revokedBy: $revokedBy
        );
    }
}
