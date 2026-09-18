<?php

declare(strict_types=1);

namespace App\Presentation\Api\Controllers;

use App\Models\FinancialCategory;
use App\Presentation\Api\Resources\FinancialCategoryResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class FinancialCategoryController
{
    /**
     * Get all financial categories.
     */
    public function index(): AnonymousResourceCollection
    {
        $categories = FinancialCategory::query()
            ->orderBy('type')
            ->orderBy('name')
            ->get();

        return FinancialCategoryResource::collection($categories);
    }
}
