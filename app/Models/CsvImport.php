<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

final class CsvImport extends Model
{
    use HasUuids;

    protected $table = 'csv_imports';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'company_id',
        'user_id',
        'file_name',
        'file_path',
        'status',
        'total_rows',
        'imported_rows',
        'error_count',
        'errors',
        'completed_at',
    ];

    protected $casts = [
        'errors' => 'array',
        'total_rows' => 'integer',
        'imported_rows' => 'integer',
        'error_count' => 'integer',
        'completed_at' => 'datetime',
    ];

    /**
     * @return BelongsTo<Company, CsvImport>
     */
    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class, 'company_id');
    }

    /**
     * @return BelongsTo<User, CsvImport>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function isCompleted(): bool
    {
        return $this->status === 'completed';
    }

    public function isFailed(): bool
    {
        return $this->status === 'failed';
    }
}
