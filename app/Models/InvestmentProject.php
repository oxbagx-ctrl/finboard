<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

final class InvestmentProject extends Model
{
    use HasUuids;

    protected $table = 'investment_projects';

    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = [
        'id',
        'company_id',
        'name',
        'description',
        'status',
        'currency',
        'commercial_operation_date',
        'created_by',
    ];

    protected $casts = [
        'commercial_operation_date' => 'date:Y-m-d',
    ];

    /**
     * @return BelongsTo<Company, InvestmentProject>
     */
    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class, 'company_id');
    }

    /**
     * @return BelongsTo<User, InvestmentProject>
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * @return HasMany<InvestmentCapexStage>
     */
    public function capexStages(): HasMany
    {
        return $this->hasMany(InvestmentCapexStage::class, 'project_id')->orderBy('order_index');
    }

    /**
     * @return HasOne<InvestmentFinancingStructure>
     */
    public function financingStructure(): HasOne
    {
        return $this->hasOne(InvestmentFinancingStructure::class, 'project_id');
    }

    /**
     * @return HasMany<InvestmentDebtFacility>
     */
    public function debtFacilities(): HasMany
    {
        return $this->hasMany(InvestmentDebtFacility::class, 'project_id');
    }

    /**
     * @return HasMany<InvestmentGrantAllocation>
     */
    public function grantAllocations(): HasMany
    {
        return $this->hasMany(InvestmentGrantAllocation::class, 'project_id');
    }

    public function scopeForCompany(Builder $query, string $companyId): Builder
    {
        return $query->where('company_id', $companyId);
    }

    public function scopeByStatus(Builder $query, string $status): Builder
    {
        return $query->where('status', $status);
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('status', 'active');
    }
}
