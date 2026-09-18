<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Str;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable, HasUuids;

    /**
     * The primary key type and incrementing settings for UUID.
     */
    protected $keyType = 'string';
    public $incrementing = false;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'id',
        'name',
        'email',
        'password',
        'role',
        'company_id',
        'is_active',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'is_active' => 'boolean',
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
        ];
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class, 'company_id');
    }

    /**
     * Companies assigned to this advisor.
     *
     * @return BelongsToMany<Company>
     */
    public function assignedCompanies(): BelongsToMany
    {
        return $this->belongsToMany(Company::class, 'advisor_company', 'advisor_id', 'company_id')
            ->withPivot(['assigned_by'])
            ->withTimestamps();
    }

    /**
     * Invitations sent by this user.
     *
     * @return HasMany<Invitation>
     */
    public function sentInvitations(): HasMany
    {
        return $this->hasMany(Invitation::class, 'invited_by');
    }

    public function isSuperAdmin(): bool
    {
        return $this->role === 'super_admin';
    }

    public function isAdvisor(): bool
    {
        return $this->role === 'advisor';
    }

    public function isClient(): bool
    {
        return $this->role === 'client';
    }

    public function isAdmin(): bool
    {
        return $this->role === 'super_admin' || $this->role === 'admin';
    }

    /**
     * Multi-tenant security check:
     * - SuperAdmin / Admin has global access to all companies.
     * - Advisor can only access explicitly assigned companies.
     * - Client can only access their designated company_id.
     */
    public function canAccessCompany(string $companyId): bool
    {
        if (!$this->is_active) {
            return false;
        }

        if ($this->isAdmin()) {
            return true;
        }

        if (!Str::isUuid($companyId)) {
            return false;
        }

        if ($this->isAdvisor()) {
            return $this->assignedCompanies()->where('companies.id', $companyId)->exists();
        }

        return $this->company_id !== null && (string) $this->company_id === (string) $companyId;
    }
}
