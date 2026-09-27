<?php

declare(strict_types=1);

namespace App\Contexts\DocumentManagement\Application\Queries\GetEffectiveVdrPermission;

use App\Contexts\DocumentManagement\Domain\Repositories\VdrPermissionRepositoryInterface;
use App\Contexts\DocumentManagement\Domain\ValueObjects\DocumentId;
use App\Contexts\DocumentManagement\Domain\ValueObjects\EffectivePermission;
use App\Contexts\DocumentManagement\Domain\ValueObjects\FolderId;
use App\Models\Document as EloquentDocument;

final class GetEffectiveVdrPermissionHandler
{
    public function __construct(
        private readonly VdrPermissionRepositoryInterface $permissionRepository
    ) {
    }

    public function handle(GetEffectiveVdrPermissionQuery $query): EffectivePermission
    {
        $matrix = $this->permissionRepository->loadPermissionMatrix($query->companyId);

        $folderId = $query->folderId !== null ? FolderId::fromString($query->folderId) : null;
        $documentId = $query->documentId !== null ? DocumentId::fromString($query->documentId) : null;

        // If folderId is not explicitly passed but documentId is passed, find folder of document
        if ($folderId === null && $documentId !== null) {
            $docModel = EloquentDocument::find($documentId->value());
            if ($docModel?->folder_id !== null) {
                $folderId = FolderId::fromString((string) $docModel->folder_id);
            }
        }

        return $matrix->resolve(
            role: $query->role,
            userId: $query->userId,
            folderId: $folderId,
            documentId: $documentId
        );
    }
}
