<?php

declare(strict_types=1);

namespace App\Contexts\DocumentManagement\Domain\ValueObjects;

final class EffectivePermission
{
    public const SOURCE_SUPER_ADMIN = 'super_admin';
    public const SOURCE_DIRECT_DOCUMENT_USER = 'direct_document_user';
    public const SOURCE_DIRECT_DOCUMENT_ROLE = 'direct_document_role';
    public const SOURCE_DIRECT_FOLDER_USER = 'direct_folder_user';
    public const SOURCE_DIRECT_FOLDER_ROLE = 'direct_folder_role';
    public const SOURCE_INHERITED_FOLDER_USER = 'inherited_folder_user';
    public const SOURCE_INHERITED_FOLDER_ROLE = 'inherited_folder_role';
    public const SOURCE_ROLE_DEFAULT = 'role_default';

    public function __construct(
        private readonly PermissionLevel $level,
        private readonly bool $watermarkRequired,
        private readonly string $source,
        private readonly ?string $sourceId = null
    ) {
    }

    public static function superAdmin(): self
    {
        return new self(
            level: PermissionLevel::MANAGE,
            watermarkRequired: false,
            source: self::SOURCE_SUPER_ADMIN
        );
    }

    public static function none(string $source = self::SOURCE_ROLE_DEFAULT): self
    {
        return new self(
            level: PermissionLevel::NONE,
            watermarkRequired: false,
            source: $source
        );
    }

    public function level(): PermissionLevel
    {
        return $this->level;
    }

    public function watermarkRequired(): bool
    {
        return $this->watermarkRequired;
    }

    public function source(): string
    {
        return $this->source;
    }

    public function sourceId(): ?string
    {
        return $this->sourceId;
    }

    public function canView(): bool
    {
        return $this->level->canView();
    }

    public function canDownload(): bool
    {
        return $this->level->canDownload();
    }

    public function canManage(): bool
    {
        return $this->level->canManage();
    }

    public function isNone(): bool
    {
        return $this->level->isNone();
    }

    public function toArray(): array
    {
        return [
            'level' => $this->level->value,
            'can_view' => $this->canView(),
            'can_download' => $this->canDownload(),
            'can_manage' => $this->canManage(),
            'watermark_required' => $this->watermarkRequired,
            'source' => $this->source,
            'source_id' => $this->sourceId,
        ];
    }
}
