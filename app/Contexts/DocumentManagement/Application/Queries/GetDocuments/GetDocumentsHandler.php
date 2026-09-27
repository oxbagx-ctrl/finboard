<?php

declare(strict_types=1);

namespace App\Contexts\DocumentManagement\Application\Queries\GetDocuments;

use App\Models\Document as EloquentDocument;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;

final class GetDocumentsHandler
{
    public function handle(GetDocumentsQuery $query): LengthAwarePaginator
    {
        $builder = EloquentDocument::query()
            ->with('uploader')
            ->where('company_id', $query->companyId);

        if (!$query->includeArchived) {
            $builder->where('is_archived', false);
        }

        if ($query->type !== null && trim($query->type) !== '') {
            $builder->where('type', trim($query->type));
        }

        if ($query->search !== null && trim($query->search) !== '') {
            $search = '%' . trim($query->search) . '%';
            $likeOp = DB::connection()->getDriverName() === 'pgsql' ? 'ilike' : 'like';

            $builder->where(function ($q) use ($search, $likeOp) {
                $q->where('title', $likeOp, $search)
                  ->orWhere('original_name', $likeOp, $search);
            });
        }

        $perPage = max(1, min(100, $query->perPage));
        $page = max(1, $query->page);

        return $builder
            ->orderBy('created_at', 'desc')
            ->paginate(perPage: $perPage, page: $page);
    }
}
