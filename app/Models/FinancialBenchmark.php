<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

final class FinancialBenchmark extends Model
{
    use HasUuids;

    protected $table = 'financial_benchmarks';

    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = [
        'id',
        'company_id',
        'metric_type',
        'target_value',
        'warning_threshold',
        'critical_threshold',
        'higher_is_better',
        'description',
        'updated_by',
    ];

    protected $casts = [
        'target_value' => 'float',
        'warning_threshold' => 'float',
        'critical_threshold' => 'float',
        'higher_is_better' => 'boolean',
    ];

    /**
     * @return BelongsTo<Company, FinancialBenchmark>
     */
    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class, 'company_id');
    }

    /**
     * @return BelongsTo<User, FinancialBenchmark>
     */
    public function updater(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }
}
