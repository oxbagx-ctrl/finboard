<?php

declare(strict_types=1);

namespace App\Contexts\Identity\Domain\Entities;

use App\Contexts\Identity\Domain\ValueObjects\RoleType;
use App\Shared\Domain\Entity;

final class Role extends Entity
{
    /**
     * @param array<string> $permissions
     */
    public function __construct(
        private readonly string $id,
        private readonly RoleType $name,
        private readonly string $description,
        private readonly array $permissions = []
    ) {
    }

    public static function admin(): self
    {
        return new self(
            id: 'role-admin',
            name: RoleType::ADMIN,
            description: 'Doradca / Analityk finansowy z pełnymi uprawnieniami do danych i importów',
            permissions: [
                'manage_finances',
                'upload_financial_data',
                'view_all_companies',
                'manage_documents',
                'view_kpi',
            ]
        );
    }

    public static function client(): self
    {
        return new self(
            id: 'role-client',
            name: RoleType::CLIENT,
            description: 'Klient z dostępem do dedykowanego dashboardu KPI oraz Data Room',
            permissions: [
                'view_kpi',
                'view_documents',
                'download_documents',
            ]
        );
    }

    public function id(): string
    {
        return $this->id;
    }

    public function name(): RoleType
    {
        return $this->name;
    }

    public function description(): string
    {
        return $this->description;
    }

    /**
     * @return array<string>
     */
    public function permissions(): array
    {
        return $this->permissions;
    }

    public function isAdmin(): bool
    {
        return $this->name === RoleType::ADMIN;
    }

    public function isClient(): bool
    {
        return $this->name === RoleType::CLIENT;
    }

    public function can(string $permission): bool
    {
        return in_array($permission, $this->permissions, true);
    }
}
