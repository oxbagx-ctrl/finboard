<?php

declare(strict_types=1);

namespace App\Presentation\Api\Resources;

use App\Models\Company;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Company
 */
final class CompanyAssignmentResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => (string) $this->id,
            'name' => $this->name,
            'code' => $this->code,
            'tax_id' => $this->tax_id,
            'created_at' => $this->created_at?->toIso8601String(),
            'assigned_advisors_count' => $this->assigned_advisors_count ?? $this->assignedAdvisors()->count(),
            'clients_count' => $this->clients_count ?? $this->users()->where('role', 'client')->count(),
            'assigned_advisors' => $this->whenLoaded('assignedAdvisors', function () {
                return $this->assignedAdvisors->map(fn ($advisor) => [
                    'id' => (string) $advisor->id,
                    'name' => $advisor->name,
                    'email' => $advisor->email,
                    'is_active' => (bool) $advisor->is_active,
                ])->values()->all();
            }),
        ];
    }
}
