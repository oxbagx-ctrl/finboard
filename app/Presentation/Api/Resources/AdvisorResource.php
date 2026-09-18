<?php

declare(strict_types=1);

namespace App\Presentation\Api\Resources;

use App\Models\Company;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin User
 */
final class AdvisorResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => (string) $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'role' => $this->role,
            'is_active' => (bool) $this->is_active,
            'created_at' => $this->created_at?->toIso8601String(),
            'assigned_companies' => $this->assignedCompanies->map(function (Company $company) {
                return [
                    'id' => (string) $company->id,
                    'name' => $company->name,
                    'code' => $company->code,
                    'tax_id' => $company->tax_id,
                    'assigned_at' => $company->pivot?->created_at?->toIso8601String(),
                ];
            })->values()->all(),
            'assigned_companies_count' => $this->assignedCompanies->count(),
            'sent_invitations_count' => $this->whenCounted('sentInvitations'),
        ];
    }
}
