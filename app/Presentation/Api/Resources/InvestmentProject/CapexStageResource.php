<?php

declare(strict_types=1);

namespace App\Presentation\Api\Resources\InvestmentProject;

use App\Models\InvestmentCapexStage;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin InvestmentCapexStage
 */
final class CapexStageResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'project_id' => $this->project_id,
            'company_id' => $this->company_id,
            'stage_name' => $this->stage_name,
            'net_amount' => (float) $this->net_amount,
            'formatted_net_amount' => number_format((float) $this->net_amount, 2, ',', ' ') . ' ' . $this->currency,
            'currency' => $this->currency,
            'vat_rate_percent' => (float) $this->vat_rate_percent,
            'vat_rate_code' => $this->vat_rate_code,
            'start_date' => $this->start_date?->format('Y-m-d') ?? (string) $this->start_date,
            'completion_date' => $this->completion_date?->format('Y-m-d') ?? (string) $this->completion_date,
            'kst_code' => $this->kst_code,
            'kst_annual_rate' => (float) $this->kst_annual_rate,
            'eligible_for_grant' => (bool) $this->eligible_for_grant,
            'is_grant_eligible' => (bool) $this->eligible_for_grant,
            'grant_eligible_amount' => $this->grant_eligible_amount !== null ? (float) $this->grant_eligible_amount : null,
            'formatted_grant_eligible_amount' => $this->grant_eligible_amount !== null
                ? number_format((float) $this->grant_eligible_amount, 2, ',', ' ') . ' ' . $this->currency
                : null,
            'order_index' => (int) $this->order_index,
            'stage_order' => (int) $this->order_index,
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
