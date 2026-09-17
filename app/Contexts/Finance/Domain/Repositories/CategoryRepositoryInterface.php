<?php

declare(strict_types=1);

namespace App\Contexts\Finance\Domain\Repositories;

use App\Contexts\Finance\Domain\Entities\Category;

interface CategoryRepositoryInterface
{
    public function findById(string $id): ?Category;

    /**
     * @return array<Category>
     */
    public function all(): array;
}
