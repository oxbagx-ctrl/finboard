<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

final class InvestmentCapexStage extends Model
{
    use HasUuids;

    protected $table = 'investment_capex_stages';

    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = [
        'id',
        'project_id',
        'company_id',
        'stage_name',
        'net_amount',
        'currency',
        'vat_rate_percent',
        'vat_rate_code',
        'start_date',
        'completion_date',
        'kst_code',
        'kst_annual_rate',
        'eligible_for_grant',
        'order_index',
    ];

    protected $casts = [
        'net_amount' => 'string',
        'vat_rate_percent' => 'string',
        'kst_annual_rate' => 'string',
        'start_date' => 'date:Y-m-d',
        'completion_date' => 'date:Y-m-d',
        'eligible_for_grant' => 'boolean',
        'order_index' => 'integer',
    ];

    /**
     * @return BelongsTo<InvestmentProject, InvestmentCapexStage>
     */
    public function project(): BelongsTo
    {
        return $this->belongsTo(InvestmentProject::class, 'project_id');
    }

    /**
     * @return BelongsTo<Company, InvestmentCapexStage>
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
        return $query->where('project_id', $projectId)->orderBy('order_index');
    }
}
