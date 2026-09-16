<?php

declare(strict_types=1);

namespace App\Contexts\Identity\Infrastructure\Repositories;

use App\Contexts\Identity\Domain\Entities\Role;
use App\Contexts\Identity\Domain\Model\User;
use App\Contexts\Identity\Domain\Repositories\UserRepositoryInterface;
use App\Contexts\Identity\Domain\ValueObjects\Email;
use App\Contexts\Identity\Domain\ValueObjects\HashedPassword;
use App\Contexts\Identity\Domain\ValueObjects\UserId;
use App\Models\User as UserModel;
use DateTimeImmutable;
use Illuminate\Contracts\Events\Dispatcher as EventDispatcher;

final class EloquentUserRepository implements UserRepositoryInterface
{
    public function __construct(
        private readonly EventDispatcher $eventDispatcher
    ) {
    }

    public function findById(UserId $id): ?User
    {
        $model = UserModel::find($id->value());
        if ($model === null) {
            return null;
        }

        return $this->toDomain($model);
    }

    public function findByEmail(Email $email): ?User
    {
        $model = UserModel::where('email', $email->value())->first();
        if ($model === null) {
            return null;
        }

        return $this->toDomain($model);
    }

    public function save(User $user): void
    {
        $model = UserModel::find($user->id()) ?? new UserModel();

        $model->id = $user->id();
        $model->name = $user->name();
        $model->email = $user->email()->value();
        $model->password = $user->password()->value();
        $model->role = $user->role()->name()->value;
        $model->company_id = $user->companyId();
        $model->is_active = $user->isActive();
        $model->save();

        // Dispatch domain events recorded on aggregate
        foreach ($user->releaseEvents() as $event) {
            $this->eventDispatcher->dispatch($event);
        }
    }

    public function delete(UserId $id): void
    {
        UserModel::destroy($id->value());
    }

    /**
     * @return array<User>
     */
    public function findByCompanyId(string $companyId): array
    {
        return UserModel::where('company_id', $companyId)
            ->get()
            ->map(fn (UserModel $model) => $this->toDomain($model))
            ->all();
    }

    /**
     * @return array<User>
     */
    public function all(): array
    {
        return UserModel::all()
            ->map(fn (UserModel $model) => $this->toDomain($model))
            ->all();
    }

    private function toDomain(UserModel $model): User
    {
        $role = $model->role === 'admin' ? Role::admin() : Role::client();

        return new User(
            id: UserId::fromString((string) $model->id),
            name: (string) $model->name,
            email: Email::fromString((string) $model->email),
            password: HashedPassword::fromHash((string) $model->password),
            role: $role,
            companyId: $model->company_id !== null ? (string) $model->company_id : null,
            isActive: (bool) $model->is_active,
            createdAt: new DateTimeImmutable($model->created_at?->toIso8601String() ?? 'now'),
            updatedAt: $model->updated_at ? new DateTimeImmutable($model->updated_at->toIso8601String()) : null
        );
    }
}
