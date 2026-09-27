<?php

declare(strict_types=1);

namespace App\Presentation\Api\Controllers;

use App\Contexts\DocumentManagement\Application\Commands\RevokeVdrPermission\RevokeVdrPermissionCommand;
use App\Contexts\DocumentManagement\Application\Commands\RevokeVdrPermission\RevokeVdrPermissionHandler;
use App\Contexts\DocumentManagement\Application\Commands\SetVdrDocumentPermission\SetVdrDocumentPermissionCommand;
use App\Contexts\DocumentManagement\Application\Commands\SetVdrDocumentPermission\SetVdrDocumentPermissionHandler;
use App\Contexts\DocumentManagement\Application\Commands\SetVdrFolderPermission\SetVdrFolderPermissionCommand;
use App\Contexts\DocumentManagement\Application\Commands\SetVdrFolderPermission\SetVdrFolderPermissionHandler;
use App\Contexts\DocumentManagement\Application\Queries\GetEffectiveVdrPermission\GetEffectiveVdrPermissionHandler;
use App\Contexts\DocumentManagement\Application\Queries\GetEffectiveVdrPermission\GetEffectiveVdrPermissionQuery;
use App\Contexts\DocumentManagement\Application\Queries\GetVdrPermissionMatrix\GetVdrPermissionMatrixHandler;
use App\Contexts\DocumentManagement\Application\Queries\GetVdrPermissionMatrix\GetVdrPermissionMatrixQuery;
use App\Models\User;
use App\Presentation\Api\Requests\SetVdrPermissionRequest;
use App\Presentation\Api\Traits\ResolvesCompanyContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

final class VdrPermissionController
{
    use ResolvesCompanyContext;

    public function __construct(
        private readonly GetVdrPermissionMatrixHandler $getMatrixHandler,
        private readonly GetEffectiveVdrPermissionHandler $getEffectiveHandler,
        private readonly SetVdrFolderPermissionHandler $setFolderPermissionHandler,
        private readonly SetVdrDocumentPermissionHandler $setDocumentPermissionHandler,
        private readonly RevokeVdrPermissionHandler $revokePermissionHandler
    ) {
    }

    /**
     * Get the full VDR Permission Matrix for the current company.
     */
    public function matrix(Request $request): JsonResponse
    {
        $companyId = $this->resolveCompanyId($request);
        $this->ensureCanManageVdr($request->user(), $companyId);

        $data = $this->getMatrixHandler->handle(new GetVdrPermissionMatrixQuery($companyId));

        return new JsonResponse(['data' => $data], Response::HTTP_OK);
    }

    /**
     * Set/update folder permission grant in the matrix.
     */
    public function setFolderPermission(string $folderId, SetVdrPermissionRequest $request): JsonResponse
    {
        $companyId = $this->resolveCompanyId($request);
        $this->ensureCanManageVdr($request->user(), $companyId);

        $permission = $this->setFolderPermissionHandler->handle(new SetVdrFolderPermissionCommand(
            companyId: $companyId,
            folderId: $folderId,
            subjectType: (string) $request->input('subject_type'),
            subjectId: (string) $request->input('subject_id'),
            permissionLevel: (string) $request->input('permission_level'),
            watermarkRequired: $request->boolean('watermark_required', false)
        ));

        return new JsonResponse([
            'message' => 'Uprawnienie folderu transakcyjnego zostało zaktualizowane.',
            'data' => [
                'id' => $permission->id(),
                'folder_id' => $permission->folderId()->value(),
                'subject_type' => $permission->subject()->type(),
                'subject_id' => $permission->subject()->id(),
                'permission_level' => $permission->permissionLevel()->value,
                'watermark_required' => $permission->watermarkRequired(),
            ],
        ], Response::HTTP_OK);
    }

    /**
     * Set/update document permission override in the matrix.
     */
    public function setDocumentPermission(string $documentId, SetVdrPermissionRequest $request): JsonResponse
    {
        $companyId = $this->resolveCompanyId($request);
        $this->ensureCanManageVdr($request->user(), $companyId);

        $permission = $this->setDocumentPermissionHandler->handle(new SetVdrDocumentPermissionCommand(
            companyId: $companyId,
            documentId: $documentId,
            subjectType: (string) $request->input('subject_type'),
            subjectId: (string) $request->input('subject_id'),
            permissionLevel: (string) $request->input('permission_level'),
            watermarkRequired: $request->boolean('watermark_required', false)
        ));

        return new JsonResponse([
            'message' => 'Uprawnienie dokumentu transakcyjnego zostało zaktualizowane.',
            'data' => [
                'id' => $permission->id(),
                'document_id' => $permission->documentId()->value(),
                'subject_type' => $permission->subject()->type(),
                'subject_id' => $permission->subject()->id(),
                'permission_level' => $permission->permissionLevel()->value,
                'watermark_required' => $permission->watermarkRequired(),
            ],
        ], Response::HTTP_OK);
    }

    /**
     * Revoke a folder or document permission by ID.
     */
    public function revoke(string $type, string $id, Request $request): JsonResponse
    {
        $companyId = $this->resolveCompanyId($request);
        $this->ensureCanManageVdr($request->user(), $companyId);

        $this->revokePermissionHandler->handle(new RevokeVdrPermissionCommand(
            companyId: $companyId,
            permissionType: $type,
            permissionId: $id
        ));

        return new JsonResponse([
            'message' => 'Uprawnienie zostało pomyślnie odwołane.',
        ], Response::HTTP_OK);
    }

    /**
     * Calculate effective permissions for the current user on a resource.
     */
    public function effective(Request $request): JsonResponse
    {
        $companyId = $this->resolveCompanyId($request);
        /** @var User $user */
        $user = $request->user();

        if (!$user->canAccessCompany($companyId)) {
            throw new AccessDeniedHttpException('Brak dostępu do zasobów spółki.');
        }

        $effective = $this->getEffectiveHandler->handle(new GetEffectiveVdrPermissionQuery(
            companyId: $companyId,
            role: (string) $user->role,
            userId: (string) $user->id,
            folderId: $request->filled('folder_id') ? (string) $request->query('folder_id') : null,
            documentId: $request->filled('document_id') ? (string) $request->query('document_id') : null
        ));

        return new JsonResponse(['data' => $effective->toArray()], Response::HTTP_OK);
    }

    private function ensureCanManageVdr(User $user, string $companyId): void
    {
        if (!$user->canAccessCompany($companyId)) {
            throw new AccessDeniedHttpException('Brak uprawnień do zarządzania pokojem danych innej firmy.');
        }

        // Only super_admin or advisor can configure VDR permissions
        if (!$user->isSuperAdmin() && !$user->isAdvisor()) {
            throw new AccessDeniedHttpException('Tylko doradca transakcyjny lub administrator może konfigurować uprawnienia VDR.');
        }
    }
}
