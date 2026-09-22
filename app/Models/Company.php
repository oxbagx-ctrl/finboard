<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Company extends Model
{
    use HasFactory, HasUuids;

    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'id',
        'name',
        'code',
        'tax_id',
    ];

    public function users(): HasMany
    {
        return $this->hasMany(User::class, 'company_id');
    }

    /**
     * @return HasMany<FinancialRecord>
     */
    public function financialRecords(): HasMany
    {
        return $this->hasMany(FinancialRecord::class, 'company_id');
    }

    /**
     * @return HasMany<Document>
     */
    public function documents(): HasMany
    {
        return $this->hasMany(Document::class, 'company_id');
    }

    /**
     * Advisors assigned to this company.
     *
     * @return BelongsToMany<User>
     */
    public function assignedAdvisors(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'advisor_company', 'company_id', 'advisor_id')
            ->withPivot(['assigned_by'])
            ->withTimestamps();
    }

    /**
     * Invitations for this company.
     *
     * @return HasMany<Invitation>
     */
    public function invitations(): HasMany
    {
        return $this->hasMany(Invitation::class, 'company_id');
    }

    /**
     * Investment projects for this company.
     *
     * @return HasMany<InvestmentProject>
     */
    public function investmentProjects(): HasMany
    {
        return $this->hasMany(InvestmentProject::class, 'company_id');
    }
}
