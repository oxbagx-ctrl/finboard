<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

final class FinancialCategory extends Model
{
    public const OPEX_GENERIC = 'cat-opex';
    public const OPEX_PAYROLL = 'cat-opex-payroll';
    public const OPEX_SERVICES = 'cat-opex-services';
    public const OPEX_OFFICE = 'cat-opex-office';
    public const OPEX_SOFTWARE = 'cat-opex-software';
    public const OPEX_MARKETING = 'cat-opex-marketing';
    public const OPEX_LEGAL = 'cat-opex-legal';

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
