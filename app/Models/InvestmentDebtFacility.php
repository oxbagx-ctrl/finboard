<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

final class InvestmentDebtFacility extends Model
{
    use HasUuids;

    protected $table = 'investment_debt_facilities';

    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = [
        'id',
        'project_id',
        'company_id',
        'facility_name',
        'facility_type',
        'principal_amount',
        'currency',
        'base_rate_type',
        'base_rate_percent',
        'margin_percent',
        'tenor_months',
        'grace_period_months',
        'amortization_type',
        'upfront_fee_percent',
        'commitment_fee_percent',
        'interest_payment_frequency',
        'principal_payment_frequency',
    ];

    protected $casts = [
        'principal_amount' => 'string',
        'base_rate_percent' => 'string',
        'margin_percent' => 'string',
        'tenor_months' => 'integer',
        'grace_period_months' => 'integer',
        'upfront_fee_percent' => 'string',
        'commitment_fee_percent' => 'string',
    ];

    /**
     * @return BelongsTo<InvestmentProject, InvestmentDebtFacility>
     */
    public function project(): BelongsTo
    {
        return $this->belongsTo(InvestmentProject::class, 'project_id');
    }

    /**
     * @return BelongsTo<Company, InvestmentDebtFacility>
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
