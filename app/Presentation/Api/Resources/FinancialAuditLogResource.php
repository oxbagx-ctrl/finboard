<?php

declare(strict_types=1);

namespace App\Presentation\Api\Resources;

use App\Contexts\Finance\Domain\ValueObjects\AuditAction;
use App\Models\FinancialAuditLog;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin FinancialAuditLog
 */
final class FinancialAuditLogResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $actionEnum = AuditAction::tryFrom((string) $this->action);

        return [
            'id' => $this->id,
            'company_id' => $this->company_id,
            'action' => $this->action,
            'action_label' => $actionEnum?->label() ?? $this->action,
            'action_color' => $actionEnum?->color() ?? 'gray',
            'action_category' => $actionEnum?->category() ?? 'other',
            'entity_type' => $this->entity_type,
            'entity_id' => $this->entity_id,
            'description' => $this->description,
            'old_values' => $this->old_values,
            'new_values' => $this->new_values,
            'user_id' => $this->user_id,
            'user' => $this->user !== null ? [
                'id' => $this->user->id,
                'name' => $this->user->name,
                'email' => $this->user->email,
                'role' => $this->user->role,
            ] : null,
            'ip_address' => $this->ip_address,
            'user_agent' => $this->user_agent,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
