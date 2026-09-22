<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

final class InvestmentGrantAllocation extends Model
{
    use HasUuids;

    protected $table = 'investment_grant_allocations';

    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = [
        'id',
        'project_id',
        'company_id',
        'grant_program_name',
        'total_eligible_costs',
        'co_financing_rate_percent',
        'max_grant_amount',
        'advance_payment_amount',
        'currency',
        'status',
        'disbursement_schedule',
        'notes',
    ];

    protected $casts = [
        'total_eligible_costs' => 'string',
        'co_financing_rate_percent' => 'string',
        'max_grant_amount' => 'string',
        'advance_payment_amount' => 'string',
        'disbursement_schedule' => 'array',
    ];

    /**
     * @return BelongsTo<InvestmentProject, InvestmentGrantAllocation>
     */
    public function project(): BelongsTo
    {
        return $this->belongsTo(InvestmentProject::class, 'project_id');
    }

    /**
     * @return BelongsTo<Company, InvestmentGrantAllocation>
     */
    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class, 'company_id');
    }

    public function scopeForCompany(Builder $query, string $companyId): Builder
    {
        return $query->where('company_id', $companyId);
    }

    public function scopeForProject(Builder $query, string $projectId): Builder
    {
        return $query->where('project_id', $projectId);
    }

    public function scopeByStatus(Builder $query, string $status): Builder
    {
        return $query->where('status', $status);
    }
}
