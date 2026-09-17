<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

final class FinancialRecord extends Model
{
    use HasUuids;

    protected $table = 'financial_records';

    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = [
        'id',
        'company_id',
        'category_id',
        'record_type',
        'amount',
        'currency',
        'record_date',
        'description',
        'source',
    ];

    protected $casts = [
        'record_date' => 'date:Y-m-d',
        'amount' => 'string', // Preserve bcmath scale 4 precision
    ];

    /**
     * @return BelongsTo<Company, FinancialRecord>
     */
    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class, 'company_id');
    }

    /**
     * @return BelongsTo<FinancialCategory, FinancialRecord>
     */
    public function category(): BelongsTo
    {
        return $this->belongsTo(FinancialCategory::class, 'category_id');
    }

    public function scopeForCompany(Builder $query, string $companyId): Builder
    {
        return $query->where('company_id', $companyId);
    }

    public function scopeForDateRange(Builder $query, string $startDate, string $endDate): Builder
    {
        return $query->whereBetween('record_date', [$startDate, $endDate]);
    }

    public function scopeForType(Builder $query, string $type): Builder
    {
        return $query->where('record_type', $type);
    }
}
