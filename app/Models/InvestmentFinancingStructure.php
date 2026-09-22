<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

final class InvestmentFinancingStructure extends Model
{
    use HasUuids;

    protected $table = 'investment_financing_structures';

    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = [
        'id',
        'project_id',
        'company_id',
        'equity_contribution',
        'bank_loan_amount',
        'grant_amount',
        'vat_bridge_loan',
        'currency',
        'grant_disbursement_schedule',
    ];

    protected $casts = [
        'equity_contribution' => 'string',
        'bank_loan_amount' => 'string',
        'grant_amount' => 'string',
        'vat_bridge_loan' => 'string',
        'grant_disbursement_schedule' => 'array',
    ];

    /**
     * @return BelongsTo<InvestmentProject, InvestmentFinancingStructure>
     */
    public function project(): BelongsTo
    {
        return $this->belongsTo(InvestmentProject::class, 'project_id');
    }

    /**
     * @return BelongsTo<Company, InvestmentFinancingStructure>
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
}
