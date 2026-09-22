<?php

declare(strict_types=1);

namespace App\Presentation\Api\Resources\InvestmentProject;

use App\Models\InvestmentProject;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin InvestmentProject
 */
final class InvestmentProjectResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'company_id' => $this->company_id,
            'name' => $this->name,
            'description' => $this->description,
            'status' => $this->status,
            'currency' => $this->currency,
            'commercial_operation_date' => $this->commercial_operation_date?->format('Y-m-d') ?? (string) $this->commercial_operation_date,
            'created_by' => $this->created_by,
            'capex_stages' => CapexStageResource::collection($this->whenLoaded('capexStages')),
            'financing_structure' => $this->whenLoaded('financingStructure', function () {
                $fs = $this->financingStructure;
                if ($fs === null) {
                    return null;
                }

                return [
                    'id' => $fs->id,
                    'equity_contribution' => (float) $fs->equity_contribution,
                    'bank_loan_amount' => (float) $fs->bank_loan_amount,
                    'grant_amount' => (float) $fs->grant_amount,
                    'vat_bridge_loan' => (float) $fs->vat_bridge_loan,
                    'currency' => $fs->currency,
                    'grant_disbursement_schedule' => $fs->grant_disbursement_schedule,
                ];
            }),
            'debt_facilities' => $this->whenLoaded('debtFacilities', function () {
                return $this->debtFacilities->map(function ($df) {
                    return [
                        'id' => $df->id,
                        'facility_name' => $df->facility_name,
                        'principal_amount' => (float) $df->principal_amount,
                        'base_rate_type' => $df->base_rate_type,
                        'base_rate_percent' => (float) ($df->base_rate_percent ?? $df->base_rate_value ?? 0),
                        'base_rate_value' => (float) ($df->base_rate_percent ?? $df->base_rate_value ?? 0),
                        'margin_percent' => (float) ($df->margin_percent ?? $df->interest_margin ?? 0),
                        'interest_margin' => (float) ($df->margin_percent ?? $df->interest_margin ?? 0),
                        'tenor_months' => (int) $df->tenor_months,
                        'grace_period_months' => (int) $df->grace_period_months,
                        'amortization_type' => $df->amortization_type,
                        'upfront_fee_percent' => (float) $df->upfront_fee_percent,
                        'currency' => $df->currency,
                    ];
                });
            }),
            'operating_assumptions' => $this->operating_assumptions,
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
