<?php

declare(strict_types=1);

namespace App\Contexts\DocumentManagement\Application\Queries\GetVdrPermissionMatrix;

use App\Contexts\DocumentManagement\Domain\Repositories\VdrPermissionRepositoryInterface;
use App\Models\Document as EloquentDocument;
use App\Models\TransactionFolder as EloquentFolder;
use App\Models\User as EloquentUser;

final class GetVdrPermissionMatrixHandler
{
    public function __construct(
        private readonly VdrPermissionRepositoryInterface $permissionRepository
    ) {
    }

    public function handle(GetVdrPermissionMatrixQuery $query): array
    {
        $companyId = $query->companyId;

        $folderPerms = $this->permissionRepository->getCompanyFolderPermissions($companyId);
        $docPerms = $this->permissionRepository->getCompanyDocumentPermissions($companyId);

        $folders = EloquentFolder::query()
            ->where('company_id', $companyId)
            ->get(['id', 'name', 'index_code', 'parent_id'])
            ->keyBy('id');

        $documents = EloquentDocument::query()
            ->where('company_id', $companyId)
            ->get(['id', 'title', 'index_code', 'folder_id'])
            ->keyBy('id');

        $users = EloquentUser::query()
            ->where('company_id', $companyId)
            ->get(['id', 'name', 'email', 'role'])
            ->keyBy('id');

        $formattedFolderPerms = array_map(function ($perm) use ($folders, $users) {
            $folder = $folders->get($perm->folderId()->value());
            $subjectLabel = $perm->subject()->isRole()
                ? 'Rola: ' . ucfirst($perm->subject()->id())
                : ($users->get($perm->subject()->id())?->name ?? 'Użytkownik: ' . $perm->subject()->id());

            return [
                'id' => $perm->id(),
                'folder_id' => $perm->folderId()->value(),
                'folder_name' => $folder?->name ?? 'Nieznany folder',
                'folder_index_code' => $folder?->index_code ?? '',
                'subject_type' => $perm->subject()->type(),
                'subject_id' => $perm->subject()->id(),
                'subject_label' => $subjectLabel,
                'permission_level' => $perm->permissionLevel()->value,
                'permission_label' => $perm->permissionLevel()->label(),
                'watermark_required' => $perm->watermarkRequired(),
                'created_at' => $perm->createdAt()->format(\DateTimeImmutable::ATOM),
                'updated_at' => $perm->updatedAt()?->format(\DateTimeImmutable::ATOM),
            ];
        }, $folderPerms);

        $formattedDocPerms = array_map(function ($perm) use ($documents, $users) {
            $doc = $documents->get($perm->documentId()->value());
            $subjectLabel = $perm->subject()->isRole()
                ? 'Rola: ' . ucfirst($perm->subject()->id())
                : ($users->get($perm->subject()->id())?->name ?? 'Użytkownik: ' . $perm->subject()->id());

            return [
                'id' => $perm->id(),
                'document_id' => $perm->documentId()->value(),
                'document_title' => $doc?->title ?? 'Nieznany dokument',
                'document_index_code' => $doc?->index_code ?? '',
                'subject_type' => $perm->subject()->type(),
                'subject_id' => $perm->subject()->id(),
                'subject_label' => $subjectLabel,
                'permission_level' => $perm->permissionLevel()->value,
                'permission_label' => $perm->permissionLevel()->label(),
                'watermark_required' => $perm->watermarkRequired(),
                'created_at' => $perm->createdAt()->format(\DateTimeImmutable::ATOM),
                'updated_at' => $perm->updatedAt()?->format(\DateTimeImmutable::ATOM),
            ];
        }, $docPerms);

        return [
            'company_id' => $companyId,
            'folder_permissions' => array_values($formattedFolderPerms),
            'document_permissions' => array_values($formattedDocPerms),
            'available_roles' => ['client', 'advisor'],
            'available_levels' => [
                ['value' => 'none', 'label' => 'Brak dostępu'],
                ['value' => 'view', 'label' => 'Tylko podgląd (View-Only)'],
                ['value' => 'download', 'label' => 'Pobieranie (Download)'],
                ['value' => 'manage', 'label' => 'Zarządzanie (Pełny dostęp)'],
            ],
        ];
    }
}
