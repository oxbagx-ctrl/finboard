<?php

declare(strict_types=1);

namespace App\Contexts\Finance\Infrastructure\Repositories;

use App\Contexts\Finance\Domain\Model\FinancialAuditLog;
use App\Contexts\Finance\Domain\Repositories\FinancialAuditLogRepositoryInterface;
use App\Contexts\Finance\Domain\ValueObjects\AuditAction;
use App\Contexts\Finance\Domain\ValueObjects\FinancialAuditLogId;
use App\Models\FinancialAuditLog as EloquentFinancialAuditLog;
use DateTimeImmutable;

final class EloquentFinancialAuditLogRepository implements FinancialAuditLogRepositoryInterface
{
    public function save(FinancialAuditLog $log): void
    {
        EloquentFinancialAuditLog::updateOrCreate(
            ['id' => $log->id()],
            [
                'company_id' => $log->companyId(),
                'user_id' => $log->userId(),
                'action' => $log->action()->value,
                'entity_type' => $log->entityType(),
                'entity_id' => $log->entityId(),
                'description' => $log->description(),
                'old_values' => $log->oldValues(),
                'new_values' => $log->newValues(),
                'ip_address' => $log->ipAddress(),
                'user_agent' => $log->userAgent(),
                'created_at' => $log->createdAt()->format('Y-m-d H:i:s'),
            ]
        );
    }

    public function findById(FinancialAuditLogId $id): ?FinancialAuditLog
    {
        /** @var EloquentFinancialAuditLog|null $eloquent */
        $eloquent = EloquentFinancialAuditLog::find($id->value());

        if ($eloquent === null) {
            return null;
        }

        return $this->toDomain($eloquent);
    }

    /**
     * @return array<FinancialAuditLog>
     */
    public function findByCompanyId(
        string $companyId,
        int $limit = 50,
        ?AuditAction $action = null,
        ?string $entityType = null
    ): array {
        $query = EloquentFinancialAuditLog::where('company_id', $companyId)
            ->orderBy('created_at', 'desc');

        if ($action !== null) {
            $query->where('action', $action->value);
        }

        if ($entityType !== null && trim($entityType) !== '') {
            $query->where('entity_type', $entityType);
        }

        return $query->limit($limit)
            ->get()
            ->map(fn (EloquentFinancialAuditLog $model) => $this->toDomain($model))
            ->all();
    }

    /**
     * @return array<FinancialAuditLog>
     */
    public function getRecentLogs(string $companyId, int $limit = 10): array
    {
        return $this->findByCompanyId($companyId, $limit);
    }

    public function countByCompanyId(string $companyId): int
    {
        return EloquentFinancialAuditLog::where('company_id', $companyId)->count();
    }

    private function toDomain(EloquentFinancialAuditLog $model): FinancialAuditLog
    {
        return new FinancialAuditLog(
            id: FinancialAuditLogId::fromString($model->id),
            companyId: $model->company_id,
            userId: $model->user_id,
            action: AuditAction::from($model->action),
            entityType: $model->entity_type,
            entityId: $model->entity_id,
            description: $model->description,
            oldValues: $model->old_values,
            newValues: $model->new_values,
            ipAddress: $model->ip_address,
            userAgent: $model->user_agent,
            createdAt: DateTimeImmutable::createFromFormat('Y-m-d H:i:s', $model->created_at->format('Y-m-d H:i:s'))
                ?: new DateTimeImmutable($model->created_at->toIso8601String())
        );
    }
}
