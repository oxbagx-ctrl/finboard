<?php

declare(strict_types=1);

namespace App\Contexts\DocumentManagement\Infrastructure\Repositories;

use App\Contexts\DocumentManagement\Domain\Model\VdrDocumentPermission;
use App\Contexts\DocumentManagement\Domain\Model\VdrFolderPermission;
use App\Contexts\DocumentManagement\Domain\Model\VdrPermissionMatrix;
use App\Contexts\DocumentManagement\Domain\Repositories\VdrPermissionRepositoryInterface;
use App\Contexts\DocumentManagement\Domain\ValueObjects\AccessSubject;
use App\Contexts\DocumentManagement\Domain\ValueObjects\DocumentId;
use App\Contexts\DocumentManagement\Domain\ValueObjects\FolderId;
use App\Contexts\DocumentManagement\Domain\ValueObjects\PermissionLevel;
use App\Contexts\DocumentManagement\Domain\ValueObjects\VdrPermissionId;
use App\Models\TransactionFolder as EloquentFolder;
use App\Models\VdrDocumentPermission as EloquentDocPermission;
use App\Models\VdrFolderPermission as EloquentFolderPermission;
use DateTimeImmutable;
use Illuminate\Contracts\Events\Dispatcher;

final class EloquentVdrPermissionRepository implements VdrPermissionRepositoryInterface
{
    public function __construct(
        private readonly Dispatcher $dispatcher
    ) {
    }

    public function saveFolderPermission(VdrFolderPermission $permission): void
    {
        EloquentFolderPermission::query()->updateOrCreate(
            [
                'company_id' => $permission->companyId(),
                'folder_id' => $permission->folderId()->value(),
                'subject_type' => $permission->subject()->type(),
                'subject_id' => $permission->subject()->id(),
            ],
            [
                'id' => $permission->id(),
                'permission_level' => $permission->permissionLevel()->value,
                'watermark_required' => $permission->watermarkRequired(),
            ]
        );

        foreach ($permission->releaseEvents() as $event) {
            $this->dispatcher->dispatch($event);
        }
    }

    public function saveDocumentPermission(VdrDocumentPermission $permission): void
    {
        EloquentDocPermission::query()->updateOrCreate(
            [
                'company_id' => $permission->companyId(),
                'document_id' => $permission->documentId()->value(),
                'subject_type' => $permission->subject()->type(),
                'subject_id' => $permission->subject()->id(),
            ],
            [
                'id' => $permission->id(),
                'permission_level' => $permission->permissionLevel()->value,
                'watermark_required' => $permission->watermarkRequired(),
            ]
        );

        foreach ($permission->releaseEvents() as $event) {
            $this->dispatcher->dispatch($event);
        }
    }

    public function deleteFolderPermission(VdrPermissionId $id): void
    {
        $model = EloquentFolderPermission::find($id->value());
        if ($model !== null) {
            $domain = $this->toFolderDomain($model);
            $domain->revoke();
            $model->delete();

            foreach ($domain->releaseEvents() as $event) {
                $this->dispatcher->dispatch($event);
            }
        }
    }

    public function deleteDocumentPermission(VdrPermissionId $id): void
    {
        $model = EloquentDocPermission::find($id->value());
        if ($model !== null) {
            $domain = $this->toDocDomain($model);
            $domain->revoke();
            $model->delete();

            foreach ($domain->releaseEvents() as $event) {
                $this->dispatcher->dispatch($event);
            }
        }
    }

    public function findFolderPermission(FolderId $folderId, AccessSubject $subject): ?VdrFolderPermission
    {
        $model = EloquentFolderPermission::query()
            ->where('folder_id', $folderId->value())
            ->where('subject_type', $subject->type())
            ->where('subject_id', $subject->id())
            ->first();

        return $model !== null ? $this->toFolderDomain($model) : null;
    }

    public function findDocumentPermission(DocumentId $documentId, AccessSubject $subject): ?VdrDocumentPermission
    {
        $model = EloquentDocPermission::query()
            ->where('document_id', $documentId->value())
            ->where('subject_type', $subject->type())
            ->where('subject_id', $subject->id())
            ->first();

        return $model !== null ? $this->toDocDomain($model) : null;
    }

    /**
     * @return array<VdrFolderPermission>
     */
    public function getFolderPermissions(FolderId $folderId): array
    {
        return EloquentFolderPermission::query()
            ->where('folder_id', $folderId->value())
            ->get()
            ->map(fn (EloquentFolderPermission $m) => $this->toFolderDomain($m))
            ->all();
    }

    /**
     * @return array<VdrDocumentPermission>
     */
    public function getDocumentPermissions(DocumentId $documentId): array
    {
        return EloquentDocPermission::query()
            ->where('document_id', $documentId->value())
            ->get()
            ->map(fn (EloquentDocPermission $m) => $this->toDocDomain($m))
            ->all();
    }

    /**
     * @return array<VdrFolderPermission>
     */
    public function getCompanyFolderPermissions(string $companyId): array
    {
        return EloquentFolderPermission::query()
            ->where('company_id', $companyId)
            ->get()
            ->map(fn (EloquentFolderPermission $m) => $this->toFolderDomain($m))
            ->all();
    }

    /**
     * @return array<VdrDocumentPermission>
     */
    public function getCompanyDocumentPermissions(string $companyId): array
    {
        return EloquentDocPermission::query()
            ->where('company_id', $companyId)
            ->get()
            ->map(fn (EloquentDocPermission $m) => $this->toDocDomain($m))
            ->all();
    }

    public function loadPermissionMatrix(string $companyId): VdrPermissionMatrix
    {
        $matrix = VdrPermissionMatrix::forCompany($companyId);

        // 1. Load folder permissions
        $folderPerms = $this->getCompanyFolderPermissions($companyId);
        foreach ($folderPerms as $perm) {
            $matrix->addFolderPermission($perm);
        }

        // 2. Load document permissions
        $docPerms = $this->getCompanyDocumentPermissions($companyId);
        foreach ($docPerms as $perm) {
            $matrix->addDocumentPermission($perm);
        }

        // 3. Load folder hierarchy parent map
        $parentMap = EloquentFolder::query()
            ->where('company_id', $companyId)
            ->pluck('parent_id', 'id')
            ->toArray();
        $matrix->setFolderHierarchy($parentMap);

        return $matrix;
    }

    private function toFolderDomain(EloquentFolderPermission $model): VdrFolderPermission
    {
        return new VdrFolderPermission(
            id: VdrPermissionId::fromString($model->id),
            companyId: $model->company_id,
            folderId: FolderId::fromString($model->folder_id),
            subject: AccessSubject::fromTypeAndId($model->subject_type, $model->subject_id),
            permissionLevel: PermissionLevel::fromString($model->permission_level),
            watermarkRequired: (bool) $model->watermark_required,
            createdAt: new DateTimeImmutable($model->created_at?->toISOString() ?? 'now'),
            updatedAt: $model->updated_at !== null ? new DateTimeImmutable($model->updated_at->toISOString()) : null
        );
    }

    private function toDocDomain(EloquentDocPermission $model): VdrDocumentPermission
    {
        return new VdrDocumentPermission(
            id: VdrPermissionId::fromString($model->id),
            companyId: $model->company_id,
            documentId: DocumentId::fromString($model->document_id),
            subject: AccessSubject::fromTypeAndId($model->subject_type, $model->subject_id),
            permissionLevel: PermissionLevel::fromString($model->permission_level),
            watermarkRequired: (bool) $model->watermark_required,
            createdAt: new DateTimeImmutable($model->created_at?->toISOString() ?? 'now'),
            updatedAt: $model->updated_at !== null ? new DateTimeImmutable($model->updated_at->toISOString()) : null
        );
    }
}
