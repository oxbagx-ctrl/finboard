<?php

declare(strict_types=1);

namespace App\Contexts\Tenant\Infrastructure\Repositories;

use App\Contexts\Identity\Domain\ValueObjects\UserId;
use App\Contexts\Tenant\Domain\Entities\CompanyAdvisorAssignment;
use App\Contexts\Tenant\Domain\Repositories\CompanyAdvisorRepositoryInterface;
use App\Contexts\Tenant\Domain\ValueObjects\CompanyId;
use Illuminate\Contracts\Events\Dispatcher as EventDispatcher;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

final class EloquentCompanyAdvisorRepository implements CompanyAdvisorRepositoryInterface
{
    public function __construct(
        private readonly EventDispatcher $eventDispatcher
    ) {
    }

    public function assign(CompanyAdvisorAssignment $assignment): void
    {
        if (Schema::hasTable('advisor_company')) {
            DB::table('advisor_company')->updateOrInsert(
                [
                    'advisor_id' => $assignment->advisorId()->value(),
                    'company_id' => $assignment->companyId()->value(),
                ],
                [
                    'assigned_by' => $assignment->assignedBy()?->value(),
                    'created_at' => $assignment->assignedAt()->format('Y-m-d H:i:s'),
                    'updated_at' => $assignment->assignedAt()->format('Y-m-d H:i:s'),
                ]
            );
        }

        foreach ($assignment->releaseEvents() as $event) {
            $this->eventDispatcher->dispatch($event);
        }
    }

    public function revoke(CompanyId $companyId, UserId $advisorId, ?UserId $revokedBy = null): void
    {
        $deleted = 0;
        if (Schema::hasTable('advisor_company')) {
            $deleted = DB::table('advisor_company')
                ->where('company_id', $companyId->value())
                ->where('advisor_id', $advisorId->value())
                ->delete();
        }

        $assignment = new CompanyAdvisorAssignment($companyId, $advisorId);
        $assignment->recordRevocation($revokedBy);

        foreach ($assignment->releaseEvents() as $event) {
            $this->eventDispatcher->dispatch($event);
        }
    }

    public function isAdvisorAssigned(CompanyId $companyId, UserId $advisorId): bool
    {
        if (!Schema::hasTable('advisor_company')) {
            return false;
        }

        return DB::table('advisor_company')
            ->where('company_id', $companyId->value())
            ->where('advisor_id', $advisorId->value())
            ->exists();
    }

    /**
     * @return array<string>
     */
    public function findCompanyIdsByAdvisor(UserId $advisorId): array
    {
        if (!Schema::hasTable('advisor_company')) {
            return [];
        }

        return DB::table('advisor_company')
            ->where('advisor_id', $advisorId->value())
            ->pluck('company_id')
            ->map(fn ($val) => (string) $val)
            ->all();
    }

    /**
     * @return array<string>
     */
    public function findAdvisorIdsByCompany(CompanyId $companyId): array
    {
        if (!Schema::hasTable('advisor_company')) {
            return [];
        }

        return DB::table('advisor_company')
            ->where('company_id', $companyId->value())
            ->pluck('advisor_id')
            ->map(fn ($val) => (string) $val)
            ->all();
    }
}
