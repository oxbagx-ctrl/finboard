<?php

declare(strict_types=1);

namespace App\Contexts\Tenant\Domain\Repositories;

use App\Contexts\Identity\Domain\ValueObjects\UserId;
use App\Contexts\Tenant\Domain\Entities\CompanyAdvisorAssignment;
use App\Contexts\Tenant\Domain\ValueObjects\CompanyId;

interface CompanyAdvisorRepositoryInterface
{
    public function assign(CompanyAdvisorAssignment $assignment): void;

    public function revoke(CompanyId $companyId, UserId $advisorId, ?UserId $revokedBy = null): void;

    public function isAdvisorAssigned(CompanyId $companyId, UserId $advisorId): bool;

    /**
     * @return array<string> Array of Company UUID strings assigned to this advisor
     */
    public function findCompanyIdsByAdvisor(UserId $advisorId): array;

    /**
     * @return array<string> Array of Advisor User UUID strings assigned to this company
     */
    public function findAdvisorIdsByCompany(CompanyId $companyId): array;
}
