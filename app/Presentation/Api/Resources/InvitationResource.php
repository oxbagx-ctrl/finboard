<?php

declare(strict_types=1);

namespace App\Presentation\Api\Resources;

use App\Models\Company;
use App\Models\Invitation;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Invitation
 */
final class InvitationResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $assignedCompanyIds = is_array($this->assigned_companies) ? $this->assigned_companies : [];
        $assignedCompaniesData = [];

        if (!empty($assignedCompanyIds)) {
            $assignedCompaniesData = Company::whereIn('id', $assignedCompanyIds)
                ->get(['id', 'name', 'code'])
                ->map(fn (Company $c) => [
                    'id' => (string) $c->id,
                    'name' => $c->name,
                    'code' => $c->code,
                ])
                ->values()
                ->all();
        }

        return [
            'id' => (string) $this->id,
            'email' => $this->email,
            'role' => $this->role,
            'company_id' => $this->company_id ? (string) $this->company_id : null,
            'company' => $this->company ? [
                'id' => (string) $this->company->id,
                'name' => $this->company->name,
                'code' => $this->company->code,
            ] : null,
            'assigned_companies' => $assignedCompaniesData,
            'assigned_company_ids' => $assignedCompanyIds,
            'status' => $this->status,
            'is_pending' => $this->isPending(),
            'is_accepted' => $this->isAccepted(),
            'is_revoked' => $this->isRevoked(),
            'is_expired' => $this->isExpired(),
            'expires_at' => $this->expires_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
            'accepted_at' => $this->accepted_at?->toIso8601String(),
            'revoked_at' => $this->revoked_at?->toIso8601String(),
            'invited_by' => $this->inviter ? [
                'id' => (string) $this->inviter->id,
                'name' => $this->inviter->name,
                'email' => $this->inviter->email,
            ] : null,
        ];
    }
}
