<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

final class FinancialCategory extends Model
{
    protected $table = 'financial_categories';

    protected $primaryKey = 'id';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'name',
        'type',
        'code',
        'description',
    ];

    /**
     * @return HasMany<FinancialRecord>
     */
    public function records(): HasMany
    {
        return $this->hasMany(FinancialRecord::class, 'category_id');
    }
}
