<?php

declare(strict_types=1);

namespace App\Contexts\DocumentManagement\Application\Commands\RevokeVdrPermission;

use App\Contexts\DocumentManagement\Domain\Repositories\VdrPermissionRepositoryInterface;
use App\Contexts\DocumentManagement\Domain\ValueObjects\VdrPermissionId;
use InvalidArgumentException;

final class RevokeVdrPermissionHandler
{
    public function __construct(
        private readonly VdrPermissionRepositoryInterface $permissionRepository
    ) {
    }

    public function handle(RevokeVdrPermissionCommand $command): void
    {
        $permId = VdrPermissionId::fromString($command->permissionId);
        $type = strtolower(trim($command->permissionType));

        if ($type === 'folder') {
            $this->permissionRepository->deleteFolderPermission($permId);
        } elseif ($type === 'document') {
            $this->permissionRepository->deleteDocumentPermission($permId);
        } else {
            throw new InvalidArgumentException(sprintf('Unknown permission type: "%s". Must be "folder" or "document".', $command->permissionType));
        }
    }
}
