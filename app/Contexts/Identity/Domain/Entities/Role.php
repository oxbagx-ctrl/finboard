<?php

declare(strict_types=1);

namespace App\Contexts\Identity\Domain\Entities;

use App\Contexts\Identity\Domain\ValueObjects\RoleType;
use App\Shared\Domain\Entity;
use InvalidArgumentException;

final class Role extends Entity
{
    public const PERM_MANAGE_ADVISORS = 'manage_advisors';
    public const PERM_ASSIGN_ADVISORS = 'assign_advisors';
    public const PERM_VIEW_ALL_COMPANIES = 'view_all_companies';
    public const PERM_VIEW_ASSIGNED_COMPANIES = 'view_assigned_companies';
    public const PERM_MANAGE_COMPANIES = 'manage_companies';
    public const PERM_MANAGE_FINANCES = 'manage_finances';
    public const PERM_UPLOAD_FINANCIAL_DATA = 'upload_financial_data';
    public const PERM_MANAGE_DOCUMENTS = 'manage_documents';
    public const PERM_VIEW_KPI = 'view_kpi';
    public const PERM_INVITE_USERS = 'invite_users';
    public const PERM_INVITE_CLIENTS = 'invite_clients';
    public const PERM_MANAGE_USERS = 'manage_users';
    public const PERM_VIEW_DOCUMENTS = 'view_documents';
    public const PERM_DOWNLOAD_DOCUMENTS = 'download_documents';

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

    public static function superAdmin(): self
    {
        return new self(
            id: 'role-super-admin',
            name: RoleType::SUPER_ADMIN,
            description: 'Super Administrator / Partner z globalnymi uprawnieniami zarządzania doradcami i spółkami',
            permissions: [
                self::PERM_MANAGE_ADVISORS,
                self::PERM_ASSIGN_ADVISORS,
                self::PERM_VIEW_ALL_COMPANIES,
                self::PERM_MANAGE_COMPANIES,
                self::PERM_MANAGE_FINANCES,
                self::PERM_UPLOAD_FINANCIAL_DATA,
                self::PERM_MANAGE_DOCUMENTS,
                self::PERM_VIEW_KPI,
                self::PERM_INVITE_USERS,
                self::PERM_MANAGE_USERS,
            ]
        );
    }

    public static function advisor(): self
    {
        return new self(
            id: 'role-advisor',
            name: RoleType::ADVISOR,
            description: 'Doradca Transakcyjny z dostępem do przypisanych spółek portfela oraz zapraszania klientów',
            permissions: [
                self::PERM_VIEW_ASSIGNED_COMPANIES,
                self::PERM_MANAGE_FINANCES,
                self::PERM_UPLOAD_FINANCIAL_DATA,
                self::PERM_MANAGE_DOCUMENTS,
                self::PERM_VIEW_KPI,
                self::PERM_INVITE_CLIENTS,
                self::PERM_VIEW_DOCUMENTS,
                self::PERM_DOWNLOAD_DOCUMENTS,
            ]
        );
    }

    public static function client(): self
    {
        return new self(
            id: 'role-client',
            name: RoleType::CLIENT,
            description: 'Użytkownik Klienta z dostępem wyłącznie do dedykowanego dashboardu KPI oraz Data Room swojej spółki',
            permissions: [
                self::PERM_VIEW_KPI,
                self::PERM_VIEW_DOCUMENTS,
                self::PERM_DOWNLOAD_DOCUMENTS,
            ]
        );
    }

    /**
     * Legacy admin factory mapping to full administrative capabilities.
     */
    public static function admin(): self
    {
        return new self(
            id: 'role-admin',
            name: RoleType::ADMIN,
            description: 'Administrator / Doradca z pełnymi uprawnieniami transakcyjnymi',
            permissions: [
                self::PERM_MANAGE_ADVISORS,
                self::PERM_ASSIGN_ADVISORS,
                self::PERM_MANAGE_FINANCES,
                self::PERM_UPLOAD_FINANCIAL_DATA,
                self::PERM_VIEW_ALL_COMPANIES,
                self::PERM_MANAGE_DOCUMENTS,
                self::PERM_VIEW_KPI,
                self::PERM_INVITE_USERS,
                self::PERM_MANAGE_USERS,
            ]
        );
    }

    public static function fromString(string $role): self
    {
        return match (strtolower(trim($role))) {
            'super_admin', 'superadmin', 'partner' => self::superAdmin(),
            'advisor', 'doradca' => self::advisor(),
            'client', 'klient' => self::client(),
            'admin', 'administrator' => self::admin(),
            default => throw new InvalidArgumentException("Unknown role string: {$role}"),
        };
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

    public function isSuperAdmin(): bool
    {
        return $this->name === RoleType::SUPER_ADMIN || $this->name === RoleType::ADMIN;
    }

    public function isAdvisor(): bool
    {
        return $this->name === RoleType::ADVISOR;
    }

    public function isClient(): bool
    {
        return $this->name === RoleType::CLIENT;
    }

    public function isAdmin(): bool
    {
        return $this->name === RoleType::SUPER_ADMIN || $this->name === RoleType::ADMIN;
    }

    public function can(string $permission): bool
    {
        return in_array($permission, $this->permissions, true);
    }
}
