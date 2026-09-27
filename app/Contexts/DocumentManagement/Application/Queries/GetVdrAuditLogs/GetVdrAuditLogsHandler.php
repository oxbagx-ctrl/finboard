<?php

declare(strict_types=1);

namespace App\Contexts\DocumentManagement\Application\Queries\GetVdrAuditLogs;

use App\Models\DocumentAccessLog;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

final class GetVdrAuditLogsHandler
{
    public function handle(GetVdrAuditLogsQuery $query): LengthAwarePaginator
    {
        $builder = DocumentAccessLog::query()
            ->with(['user', 'document' => function ($q) {
                $q->withTrashed();
            }]);

        // Multi-tenant company context scope
        $companyId = $query->companyId;
        $builder->where(function ($q) use ($companyId) {
            $q->where('company_id', $companyId)
                ->orWhereHas('document', function ($docQ) use ($companyId) {
                    $docQ->withTrashed()->where('company_id', $companyId);
                });
        });

        // Document specific scope (if requested)
        if ($query->documentId !== null && trim($query->documentId) !== '') {
            $builder->where('document_id', trim($query->documentId));
        }

        // Action filter (single action or comma-separated list of actions)
        if ($query->action !== null && trim($query->action) !== '') {
            $actions = array_filter(array_map('trim', explode(',', $query->action)));
            if (count($actions) === 1) {
                $builder->where('action', reset($actions));
            } elseif (count($actions) > 1) {
                $builder->whereIn('action', $actions);
            }
        }

        // Search across document title, user name, user email, and IP address
        if ($query->search !== null && trim($query->search) !== '') {
            $search = '%' . trim($query->search) . '%';
            $likeOp = \Illuminate\Support\Facades\DB::connection()->getDriverName() === 'pgsql' ? 'ilike' : 'like';

            $builder->where(function ($q) use ($search, $likeOp) {
                $q->where('document_title', $likeOp, $search)
                    ->orWhere('ip_address', 'like', $search)
                    ->orWhereHas('user', function ($userQ) use ($search, $likeOp) {
                        $userQ->where('name', $likeOp, $search)
                            ->orWhere('email', $likeOp, $search);
                    })
                    ->orWhereHas('document', function ($docQ) use ($search, $likeOp) {
                        $docQ->withTrashed()
                            ->where('title', $likeOp, $search)
                            ->orWhere('original_name', $likeOp, $search);
                    });
            });
        }

        $perPage = max(1, min(100, $query->perPage));
        $page = max(1, $query->page);

        return $builder
            ->orderBy('created_at', 'desc')
            ->paginate(perPage: $perPage, page: $page);
    }
}
