<?php

declare(strict_types=1);

namespace App\Contexts\DocumentManagement\Domain\ValueObjects;

use InvalidArgumentException;

enum PermissionLevel: string
{
    case NONE = 'none';
    case VIEW = 'view';
    case DOWNLOAD = 'download';
    case MANAGE = 'manage';

    public function priority(): int
    {
        return match ($this) {
            self::NONE => 0,
            self::VIEW => 10,
            self::DOWNLOAD => 20,
            self::MANAGE => 30,
        };
    }

    public function label(): string
    {
        return match ($this) {
            self::NONE => 'Brak dostępu',
            self::VIEW => 'Tylko podgląd (View-Only)',
            self::DOWNLOAD => 'Pobieranie (Download)',
            self::MANAGE => 'Zarządzanie (Pełny dostęp)',
        };
    }

    public function canView(): bool
    {
        return $this->priority() >= self::VIEW->priority();
    }

    public function canDownload(): bool
    {
        return $this->priority() >= self::DOWNLOAD->priority();
    }

    public function canManage(): bool
    {
        return $this->priority() >= self::MANAGE->priority();
    }

    public function isNone(): bool
    {
        return $this === self::NONE;
    }

    public static function fromString(string $value): self
    {
        $normalized = strtolower(trim($value));

        return match ($normalized) {
            'none', 'no_access', '0' => self::NONE,
            'view', 'preview', 'read' => self::VIEW,
            'download' => self::DOWNLOAD,
            'manage', 'admin', 'write', 'full' => self::MANAGE,
            default => throw new InvalidArgumentException(sprintf('Unknown permission level: "%s". Valid levels: none, view, download, manage.', $value)),
        };
    }
}
