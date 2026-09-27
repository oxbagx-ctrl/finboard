<?php

declare(strict_types=1);

namespace App\Contexts\DocumentManagement\Application\Commands\SetVdrFolderPermission;

use App\Contexts\DocumentManagement\Domain\Model\VdrFolderPermission;
use App\Contexts\DocumentManagement\Domain\Repositories\TransactionFolderRepositoryInterface;
use App\Contexts\DocumentManagement\Domain\Repositories\VdrPermissionRepositoryInterface;
use App\Contexts\DocumentManagement\Domain\ValueObjects\AccessSubject;
use App\Contexts\DocumentManagement\Domain\ValueObjects\FolderId;
use App\Contexts\DocumentManagement\Domain\ValueObjects\PermissionLevel;
use App\Contexts\DocumentManagement\Domain\ValueObjects\VdrPermissionId;
use InvalidArgumentException;

final class SetVdrFolderPermissionHandler
{
    public function __construct(
        private readonly VdrPermissionRepositoryInterface $permissionRepository,
        private readonly TransactionFolderRepositoryInterface $folderRepository
    ) {
    }

    public function handle(SetVdrFolderPermissionCommand $command): VdrFolderPermission
    {
        $folderId = FolderId::fromString($command->folderId);
        $folder = $this->folderRepository->findById($folderId);

        if ($folder === null || $folder->companyId() !== $command->companyId) {
            throw new InvalidArgumentException(sprintf('Folder "%s" was not found in company context.', $command->folderId));
        }

        $subject = AccessSubject::fromTypeAndId($command->subjectType, $command->subjectId);
        $level = PermissionLevel::fromString($command->permissionLevel);

        $existing = $this->permissionRepository->findFolderPermission($folderId, $subject);

        if ($existing !== null) {
            $existing->update($level, $command->watermarkRequired);
            $this->permissionRepository->saveFolderPermission($existing);
            return $existing;
        }

        $newPerm = VdrFolderPermission::grant(
            id: VdrPermissionId::generate(),
            companyId: $command->companyId,
            folderId: $folderId,
            subject: $subject,
            permissionLevel: $level,
            watermarkRequired: $command->watermarkRequired
        );

        $this->permissionRepository->saveFolderPermission($newPerm);

        return $newPerm;
    }
}
