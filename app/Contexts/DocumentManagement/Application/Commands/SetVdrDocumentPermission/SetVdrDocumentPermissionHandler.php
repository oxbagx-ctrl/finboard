<?php

declare(strict_types=1);

namespace App\Contexts\DocumentManagement\Application\Commands\SetVdrDocumentPermission;

use App\Contexts\DocumentManagement\Domain\Model\VdrDocumentPermission;
use App\Contexts\DocumentManagement\Domain\Repositories\DocumentRepositoryInterface;
use App\Contexts\DocumentManagement\Domain\Repositories\VdrPermissionRepositoryInterface;
use App\Contexts\DocumentManagement\Domain\ValueObjects\AccessSubject;
use App\Contexts\DocumentManagement\Domain\ValueObjects\DocumentId;
use App\Contexts\DocumentManagement\Domain\ValueObjects\PermissionLevel;
use App\Contexts\DocumentManagement\Domain\ValueObjects\VdrPermissionId;
use InvalidArgumentException;

final class SetVdrDocumentPermissionHandler
{
    public function __construct(
        private readonly VdrPermissionRepositoryInterface $permissionRepository,
        private readonly DocumentRepositoryInterface $documentRepository
    ) {
    }

    public function handle(SetVdrDocumentPermissionCommand $command): VdrDocumentPermission
    {
        $documentId = DocumentId::fromString($command->documentId);
        $document = $this->documentRepository->findById($documentId);

        if ($document === null || $document->companyId() !== $command->companyId) {
            throw new InvalidArgumentException(sprintf('Document "%s" was not found in company context.', $command->documentId));
        }

        $subject = AccessSubject::fromTypeAndId($command->subjectType, $command->subjectId);
        $level = PermissionLevel::fromString($command->permissionLevel);

        $existing = $this->permissionRepository->findDocumentPermission($documentId, $subject);

        if ($existing !== null) {
            $existing->update($level, $command->watermarkRequired);
            $this->permissionRepository->saveDocumentPermission($existing);
            return $existing;
        }

        $newPerm = VdrDocumentPermission::grant(
            id: VdrPermissionId::generate(),
            companyId: $command->companyId,
            documentId: $documentId,
            subject: $subject,
            permissionLevel: $level,
            watermarkRequired: $command->watermarkRequired
        );

        $this->permissionRepository->saveDocumentPermission($newPerm);

        return $newPerm;
    }
}
