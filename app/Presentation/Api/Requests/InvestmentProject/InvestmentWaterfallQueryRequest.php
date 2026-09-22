<?php

declare(strict_types=1);

namespace App\Presentation\Api\Requests\InvestmentProject;

use Illuminate\Foundation\Http\FormRequest;

final class InvestmentWaterfallQueryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'company_id' => ['nullable', 'uuid', 'exists:companies,id'],
            'horizon_years' => ['nullable', 'integer', 'min:1', 'max:30'],

            // Waterfall structure
            'structure_type' => ['nullable', 'string', 'in:PARI_PASSU,TWO_TIER,THREE_TIER,FOUR_TIER,pari_passu,two_tier,three_tier,four_tier'],
            'hurdle_1_irr_percent' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'hurdle_2_irr_percent' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'tier_2_investor1_share' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'tier_2_investor2_share' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'tier_3_investor1_share' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'tier_3_investor2_share' => ['nullable', 'numeric', 'min:0', 'max:100'],

            // Target IRR solver parameters
            'target_investor' => ['nullable', 'integer', 'in:1,2'],
            'target_irr_percent' => ['nullable', 'numeric', 'min:0', 'max:200'],

            // Terminal value parameters
            'tv_method' => ['nullable', 'string', 'in:EXIT_MULTIPLE,GORDON_GROWTH,BOOK_VALUE,exit_multiple,gordon_growth,book_value'],
            'tv_parameter' => ['nullable', 'numeric'],

            // Operating assumptions overrides
            'annual_revenue_base' => ['nullable', 'numeric', 'min:0'],
            'revenue_growth_rate_percent' => ['nullable', 'numeric', 'min:-100', 'max:1000'],
            'variable_cost_percent' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'annual_fixed_costs_base' => ['nullable', 'numeric', 'min:0'],
            'fixed_cost_growth_rate_percent' => ['nullable', 'numeric', 'min:-100', 'max:1000'],
            'annual_payroll_base' => ['nullable', 'numeric', 'min:0'],
            'payroll_growth_rate_percent' => ['nullable', 'numeric', 'min:-100', 'max:1000'],
            'capacity_ramp_up' => ['nullable', 'array'],
            'capacity_ramp_up.*' => ['numeric', 'min:0', 'max:200'],
            'cit_rate_percent' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'tax_loss_carry_forward_enabled' => ['nullable', 'boolean'],
            'tax_loss_offset_cap_percent' => ['nullable', 'numeric', 'min:0', 'max:100'],
        ];
    }
}
