<?php

declare(strict_types=1);

namespace App\Contexts\Finance\Infrastructure\Repositories;

use App\Contexts\Finance\Domain\Entities\Category;
use App\Contexts\Finance\Domain\Repositories\CategoryRepositoryInterface;
use App\Contexts\Finance\Domain\ValueObjects\CategoryType;
use App\Models\FinancialCategory as EloquentCategory;

final class EloquentCategoryRepository implements CategoryRepositoryInterface
{
    public function findById(string $id): ?Category
    {
        /** @var EloquentCategory|null $eloquent */
        $eloquent = EloquentCategory::find($id);

        if ($eloquent === null) {
            return null;
        }

        return $this->toDomain($eloquent);
    }

    /**
     * @return array<Category>
     */
    public function all(): array
    {
        return EloquentCategory::all()
            ->map(fn (EloquentCategory $eloquent) => $this->toDomain($eloquent))
            ->all();
    }

    private function toDomain(EloquentCategory $eloquent): Category
    {
        return new Category(
            id: $eloquent->id,
            name: $eloquent->name,
            type: CategoryType::from($eloquent->type),
            code: $eloquent->code,
            description: $eloquent->description
        );
    }
}
