<?php

declare(strict_types=1);

namespace App\Contexts\Finance\Domain\Repositories;

use App\Contexts\Finance\Domain\Model\FinancialAuditLog;
use App\Contexts\Finance\Domain\ValueObjects\AuditAction;
use App\Contexts\Finance\Domain\ValueObjects\FinancialAuditLogId;

interface FinancialAuditLogRepositoryInterface
{
    /**
     * Persist a financial audit log entry.
     */
    public function save(FinancialAuditLog $log): void;

    /**
     * Find an audit log by unique ID.
     */
    public function findById(FinancialAuditLogId $id): ?FinancialAuditLog;

    /**
     * Retrieve audit logs for a company with optional filters.
     *
     * @return array<FinancialAuditLog>
     */
    public function findByCompanyId(
        string $companyId,
        int $limit = 50,
        ?AuditAction $action = null,
        ?string $entityType = null
    ): array;

    /**
     * Retrieve the most recent audit logs for a company.
     *
     * @return array<FinancialAuditLog>
     */
    public function getRecentLogs(string $companyId, int $limit = 10): array;

    /**
     * Count total audit log entries for a company.
     */
    public function countByCompanyId(string $companyId): int;
}
