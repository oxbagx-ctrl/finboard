<?php

declare(strict_types=1);

namespace App\Contexts\Identity\Domain\Model;

use App\Contexts\Identity\Domain\Entities\Role;
use App\Contexts\Identity\Domain\Events\UserRegistered;
use App\Contexts\Identity\Domain\Events\UserRoleAssigned;
use App\Contexts\Identity\Domain\ValueObjects\Email;
use App\Contexts\Identity\Domain\ValueObjects\HashedPassword;
use App\Contexts\Identity\Domain\ValueObjects\UserId;
use App\Shared\Domain\AggregateRoot;
use DateTimeImmutable;
use DomainException;

final class User extends AggregateRoot
{
    public function __construct(
        private readonly UserId $id,
        private string $name,
        private Email $email,
        private HashedPassword $password,
        private Role $role,
        private ?string $companyId = null,
        private bool $isActive = true,
        private readonly DateTimeImmutable $createdAt = new DateTimeImmutable(),
        private ?DateTimeImmutable $updatedAt = null
    ) {
    }

    public static function register(
        UserId $id,
        string $name,
        Email $email,
        HashedPassword $password,
        Role $role,
        ?string $companyId = null
    ): self {
        $user = new self(
            id: $id,
            name: trim($name),
            email: $email,
            password: $password,
            role: $role,
            companyId: $companyId !== null ? trim($companyId) : null,
            isActive: true,
            createdAt: new DateTimeImmutable()
        );

        $user->recordThat(new UserRegistered(
            userId: $id,
            email: $email->value(),
            role: $role->name()->value,
            companyId: $user->companyId
        ));

        return $user;
    }

    public function id(): string
    {
        return $this->id->value();
    }

    public function userId(): UserId
    {
        return $this->id;
    }

    public function name(): string
    {
        return $this->name;
    }

    public function email(): Email
    {
        return $this->email;
    }

    public function password(): HashedPassword
    {
        return $this->password;
    }

    public function role(): Role
    {
        return $this->role;
    }

    public function companyId(): ?string
    {
        return $this->companyId;
    }

    public function isActive(): bool
    {
        return $this->isActive;
    }

    public function createdAt(): DateTimeImmutable
    {
        return $this->createdAt;
    }

    public function updatedAt(): ?DateTimeImmutable
    {
        return $this->updatedAt;
    }

    public function changeRole(Role $newRole): void
    {
        if ($this->role->equals($newRole)) {
            return;
        }

        $previousRoleName = $this->role->name()->value;
        $this->role = $newRole;
        $this->updatedAt = new DateTimeImmutable();

        $this->recordThat(new UserRoleAssigned(
            userId: $this->id,
            previousRole: $previousRoleName,
            newRole: $newRole->name()->value
        ));
    }

    public function changePassword(HashedPassword $newPassword): void
    {
        $this->password = $newPassword;
        $this->updatedAt = new DateTimeImmutable();
    }

    public function updateProfile(string $name, Email $email): void
    {
        $this->name = trim($name);
        $this->email = $email;
        $this->updatedAt = new DateTimeImmutable();
    }

    public function assignCompany(?string $companyId): void
    {
        $this->companyId = $companyId !== null ? trim($companyId) : null;
        $this->updatedAt = new DateTimeImmutable();
    }

    public function deactivate(): void
    {
        if (!$this->isActive) {
            throw new DomainException('User is already inactive.');
        }

        $this->isActive = false;
        $this->updatedAt = new DateTimeImmutable();
    }

    public function activate(): void
    {
        if ($this->isActive) {
            throw new DomainException('User is already active.');
        }

        $this->isActive = true;
        $this->updatedAt = new DateTimeImmutable();
    }

    public function isSuperAdmin(): bool
    {
        return $this->role->isSuperAdmin();
    }

    public function isAdvisor(): bool
    {
        return $this->role->isAdvisor();
    }

    public function isAdmin(): bool
    {
        return $this->role->isAdmin();
    }

    public function isClient(): bool
    {
        return $this->role->isClient();
    }

    public function can(string $permission): bool
    {
        if (!$this->isActive) {
            return false;
        }

        return $this->role->can($permission);
    }

    /**
     * Multi-tenant security check:
     * - Admins (SuperAdmin, Advisor) have broader advisory access.
     * - Clients are strictly restricted to their designated tenant company.
     */
    public function canAccessCompany(string $companyId): bool
    {
        if (!$this->isActive) {
            return false;
        }

        if ($this->isAdmin()) {
            return true;
        }

        return $this->companyId !== null && $this->companyId === $companyId;
    }
}
