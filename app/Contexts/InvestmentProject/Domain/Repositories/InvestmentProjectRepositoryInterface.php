<?php

declare(strict_types=1);

namespace App\Contexts\InvestmentProject\Domain\Repositories;

use App\Contexts\InvestmentProject\Domain\Model\InvestmentProject;
use App\Contexts\InvestmentProject\Domain\ValueObjects\InvestmentProjectId;

interface InvestmentProjectRepositoryInterface
{
    /**
     * Find an investment project by its ID, with optional company ID constraint for tenant isolation.
     */
    public function findById(InvestmentProjectId $id, ?string $companyId = null): ?InvestmentProject;

    /**
     * Retrieve all investment projects belonging to a company, optionally filtered by status.
     *
     * @return array<InvestmentProject>
     */
    public function findByCompanyId(string $companyId, ?string $status = null): array;

    /**
     * Persist an investment project aggregate root along with all child entities, dispatching domain events.
     */
    public function save(InvestmentProject $project): void;

    /**
     * Delete an investment project by its ID, with optional company ID constraint for tenant isolation.
     */
    public function delete(InvestmentProjectId $id, ?string $companyId = null): void;

    /**
     * Check whether an investment project exists.
     */
    public function exists(InvestmentProjectId $id, ?string $companyId = null): bool;

    /**
     * Count total investment projects for a specific company.
     */
    public function countByCompanyId(string $companyId): int;
}
