<?php

declare(strict_types=1);

namespace App\Contexts\DocumentManagement\Infrastructure\Repositories;

use App\Contexts\DocumentManagement\Domain\Model\TransactionFolder;
use App\Contexts\DocumentManagement\Domain\Repositories\TransactionFolderRepositoryInterface;
use App\Contexts\DocumentManagement\Domain\ValueObjects\DeweyIndexCode;
use App\Contexts\DocumentManagement\Domain\ValueObjects\FolderId;
use App\Models\TransactionFolder as EloquentFolder;
use DateTimeImmutable;
use Illuminate\Contracts\Events\Dispatcher;

final class EloquentTransactionFolderRepository implements TransactionFolderRepositoryInterface
{
    public function __construct(
        private readonly Dispatcher $dispatcher
    ) {
    }

    public function findById(FolderId $id): ?TransactionFolder
    {
        /** @var EloquentFolder|null $eloquent */
        $eloquent = EloquentFolder::find($id->value());

        if ($eloquent === null) {
            return null;
        }

        return $this->toDomain($eloquent);
    }

    /**
     * @return array<TransactionFolder>
     */
    public function findByCompanyId(string $companyId): array
    {
        $folders = EloquentFolder::query()
            ->where('company_id', $companyId)
            ->get()
            ->map(fn (EloquentFolder $model) => $this->toDomain($model))
            ->all();

        // Sort folders in standard Dewey decimal ascending order
        usort($folders, function (TransactionFolder $a, TransactionFolder $b) {
            return $a->indexCode()->compare($b->indexCode());
        });

        return $folders;
    }

    public function findByIndexCode(string $companyId, DeweyIndexCode $code): ?TransactionFolder
    {
        /** @var EloquentFolder|null $eloquent */
        $eloquent = EloquentFolder::query()
            ->where('company_id', $companyId)
            ->where('index_code', $code->value())
            ->first();

        if ($eloquent === null) {
            return null;
        }

        return $this->toDomain($eloquent);
    }

    public function save(TransactionFolder $folder): void
    {
        EloquentFolder::query()->updateOrCreate(
            ['id' => $folder->id()],
            [
                'company_id' => $folder->companyId(),
                'parent_id' => $folder->parentId()?->value(),
                'index_code' => $folder->indexCode()->value(),
                'name' => $folder->name(),
                'description' => $folder->description(),
                'sort_order' => $folder->sortOrder(),
            ]
        );

        foreach ($folder->releaseEvents() as $event) {
            $this->dispatcher->dispatch($event);
        }
    }

    public function delete(FolderId $id): void
    {
        $folder = $this->findById($id);
        if ($folder !== null) {
            $folder->markDeleted();
            foreach ($folder->releaseEvents() as $event) {
                $this->dispatcher->dispatch($event);
            }
        }

        EloquentFolder::destroy($id->value());
    }

    private function toDomain(EloquentFolder $eloquent): TransactionFolder
    {
        $createdAt = new DateTimeImmutable($eloquent->created_at?->format(DateTimeImmutable::ATOM) ?? 'now');
        $updatedAt = $eloquent->updated_at ? new DateTimeImmutable($eloquent->updated_at->format(DateTimeImmutable::ATOM)) : null;

        return new TransactionFolder(
            id: FolderId::fromString($eloquent->id),
            companyId: $eloquent->company_id,
            indexCode: DeweyIndexCode::fromString($eloquent->index_code),
            name: $eloquent->name,
            parentId: $eloquent->parent_id !== null ? FolderId::fromString($eloquent->parent_id) : null,
            description: $eloquent->description,
            sortOrder: (int) $eloquent->sort_order,
            createdAt: $createdAt,
            updatedAt: $updatedAt
        );
    }
}
