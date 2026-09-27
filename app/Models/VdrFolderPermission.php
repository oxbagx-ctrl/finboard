<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

final class VdrFolderPermission extends Model
{
    use HasFactory;
    use HasUuids;

    protected $table = 'vdr_folder_permissions';

    protected $fillable = [
        'id',
        'company_id',
        'folder_id',
        'subject_type',
        'subject_id',
        'permission_level',
        'watermark_required',
    ];

    protected $casts = [
        'watermark_required' => 'boolean',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class, 'company_id');
    }

    public function folder(): BelongsTo
    {
        return $this->belongsTo(TransactionFolder::class, 'folder_id');
    }
}
