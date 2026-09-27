<?php

declare(strict_types=1);

namespace App\Presentation\Api\Controllers;

use App\Contexts\DocumentManagement\Domain\Model\TransactionFolder;
use App\Contexts\DocumentManagement\Domain\Repositories\TransactionFolderRepositoryInterface;
use App\Contexts\DocumentManagement\Domain\Services\DeweyMnaStructureGenerator;
use App\Contexts\DocumentManagement\Domain\ValueObjects\DeweyIndexCode;
use App\Contexts\DocumentManagement\Domain\ValueObjects\FolderId;
use App\Models\TransactionFolder as EloquentFolder;
use App\Models\User;
use App\Presentation\Api\Requests\CreateTransactionFolderRequest;
use App\Presentation\Api\Requests\UpdateTransactionFolderRequest;
use App\Presentation\Api\Resources\TransactionFolderResource;
use App\Presentation\Api\Traits\ResolvesCompanyContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

final class TransactionFolderController
{
    use ResolvesCompanyContext;

    public function __construct(
        private readonly TransactionFolderRepositoryInterface $folderRepository,
        private readonly DeweyMnaStructureGenerator $structureGenerator
    ) {
    }

    /**
     * List transaction folders for the company (flat or nested tree).
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $companyId = $this->resolveCompanyId($request);

        $query = EloquentFolder::query()
            ->where('company_id', $companyId)
            ->withCount('documents');

        if ($request->boolean('tree', false)) {
            $folders = $query->whereNull('parent_id')
                ->with(['children' => function ($childQuery) {
                    $childQuery->withCount('documents')
                        ->orderBy('sort_order')
                        ->orderBy('index_code');
                }])
                ->orderBy('sort_order')
                ->orderBy('index_code')
                ->get();
        } else {
            $folders = $query->orderBy('sort_order')
                ->orderBy('index_code')
                ->get();
        }

        return TransactionFolderResource::collection($folders);
    }

    /**
     * Create a new transaction folder with Dewey decimal index code.
     */
    public function store(CreateTransactionFolderRequest $request): JsonResponse
    {
        $companyId = $this->resolveCompanyId($request);
        $indexCodeVO = DeweyIndexCode::fromString((string) $request->input('index_code'));

        if ($this->folderRepository->findByIndexCode($companyId, $indexCodeVO) !== null) {
            throw ValidationException::withMessages([
                'index_code' => ['Folder o kodzie indeksu ' . $indexCodeVO->value() . ' już istnieje w tej transakcji.'],
            ]);
        }

        $folder = TransactionFolder::create(
            id: FolderId::generate(),
            companyId: $companyId,
            indexCode: $indexCodeVO,
            name: (string) $request->input('name'),
            parentId: $request->filled('parent_id') ? FolderId::fromString((string) $request->input('parent_id')) : null,
            description: $request->filled('description') ? (string) $request->input('description') : null,
            sortOrder: $request->integer('sort_order', 0)
        );

        $this->folderRepository->save($folder);

        $eloquent = EloquentFolder::withCount('documents')->findOrFail($folder->id());

        return (new TransactionFolderResource($eloquent))
            ->response()
            ->setStatusCode(Response::HTTP_CREATED);
    }

    /**
     * Initialize standard M&A Dewey decimal taxonomy folders for the company.
     */
    public function initStandard(Request $request): JsonResponse
    {
        $companyId = $this->resolveCompanyId($request);
        $standardFolders = $this->structureGenerator->generateStandardFolders($companyId);

        $createdCount = 0;
        foreach ($standardFolders as $folder) {
            if ($this->folderRepository->findByIndexCode($companyId, $folder->indexCode()) === null) {
                $this->folderRepository->save($folder);
                $createdCount++;
            }
        }

        return response()->json([
            'message' => 'Standardowa taksonomia M&A została pomyślnie zainicjowana.',
            'created_count' => $createdCount,
        ], Response::HTTP_CREATED);
    }

    /**
     * Get a specific folder by ID.
     */
    public function show(string $id, Request $request): TransactionFolderResource
    {
        /** @var EloquentFolder|null $folder */
        $folder = EloquentFolder::with(['children' => function ($q) {
            $q->withCount('documents')->orderBy('sort_order')->orderBy('index_code');
        }])->withCount('documents')->find($id);

        if ($folder === null) {
            throw new NotFoundHttpException('Folder nie został znaleziony.');
        }

        $this->ensureCanAccessFolder($request->user(), $folder);

        return new TransactionFolderResource($folder);
    }

    /**
     * Update an existing transaction folder.
     */
    public function update(string $id, UpdateTransactionFolderRequest $request): TransactionFolderResource
    {
        $domainFolder = $this->folderRepository->findById(FolderId::fromString($id));

        if ($domainFolder === null) {
            throw new NotFoundHttpException('Folder nie został znaleziony.');
        }

        $this->ensureCanAccessFolder($request->user(), $domainFolder);

        if ($request->has('index_code')) {
            $newCode = DeweyIndexCode::fromString((string) $request->input('index_code'));
            $existing = $this->folderRepository->findByIndexCode($domainFolder->companyId(), $newCode);
            if ($existing !== null && $existing->id() !== $domainFolder->id()) {
                throw ValidationException::withMessages([
                    'index_code' => ['Folder o kodzie indeksu ' . $newCode->value() . ' już istnieje w tej transakcji.'],
                ]);
            }
            $domainFolder->updateIndexCode($newCode);
        }

        $domainFolder->updateDetails(
            name: $request->input('name', $domainFolder->name()),
            description: $request->has('description') ? $request->input('description') : $domainFolder->description(),
            sortOrder: $request->has('sort_order') ? $request->integer('sort_order') : $domainFolder->sortOrder()
        );

        if ($request->has('parent_id')) {
            $parentId = $request->filled('parent_id') ? FolderId::fromString((string) $request->input('parent_id')) : null;
            $domainFolder->moveToParent($parentId);
        }

        $this->folderRepository->save($domainFolder);

        $eloquent = EloquentFolder::with(['children' => function ($q) {
            $q->withCount('documents')->orderBy('sort_order')->orderBy('index_code');
        }])->withCount('documents')->findOrFail($id);

        return new TransactionFolderResource($eloquent);
    }

    /**
     * Delete a transaction folder.
     */
    public function destroy(string $id, Request $request): JsonResponse
    {
        $domainFolder = $this->folderRepository->findById(FolderId::fromString($id));

        if ($domainFolder === null) {
            throw new NotFoundHttpException('Folder nie został znaleziony.');
        }

        $this->ensureCanAccessFolder($request->user(), $domainFolder);

        $this->folderRepository->delete(FolderId::fromString($id));

        return response()->json([
            'message' => 'Folder transakcyjny został pomyślnie usunięty.',
        ], Response::HTTP_OK);
    }

    private function ensureCanAccessFolder(User $user, TransactionFolder|EloquentFolder $folder): void
    {
        $folderCompanyId = $folder instanceof TransactionFolder ? $folder->companyId() : (string) $folder->company_id;

        if ($user->isAdmin()) {
            return;
        }

        if ($user->isAdvisor()) {
            if (!$user->canAccessCompany($folderCompanyId)) {
                throw new AccessDeniedHttpException('Doradca nie ma dostępu do folderów wybranej firmy.');
            }
            return;
        }

        if ((string) $user->company_id !== $folderCompanyId) {
            throw new AccessDeniedHttpException('Brak dostępu do folderów innej firmy.');
        }
    }
}
