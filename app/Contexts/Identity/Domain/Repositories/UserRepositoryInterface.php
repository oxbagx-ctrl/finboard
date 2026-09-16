<?php

declare(strict_types=1);

namespace App\Contexts\Identity\Domain\Repositories;

use App\Contexts\Identity\Domain\Model\User;
use App\Contexts\Identity\Domain\ValueObjects\Email;
use App\Contexts\Identity\Domain\ValueObjects\UserId;

interface UserRepositoryInterface
{
    /**
     * Find a user by their unique domain identifier.
     */
    public function findById(UserId $id): ?User;

    /**
     * Find a user by their validated email address.
     */
    public function findByEmail(Email $email): ?User;

    /**
     * Persist the user aggregate and dispatch any recorded domain events.
     */
    public function save(User $user): void;

    /**
     * Delete a user by identifier.
     */
    public function delete(UserId $id): void;

    /**
     * Find all users associated with a specific tenant company.
     *
     * @return array<User>
     */
    public function findByCompanyId(string $companyId): array;

    /**
     * Return all registered users.
     *
     * @return array<User>
     */
    public function all(): array;
}
