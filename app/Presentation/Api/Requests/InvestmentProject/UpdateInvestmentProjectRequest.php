<?php

declare(strict_types=1);

namespace App\Presentation\Api\Requests\InvestmentProject;

use Illuminate\Foundation\Http\FormRequest;

final class UpdateInvestmentProjectRequest extends FormRequest
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
            'name' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:1000'],
            'status' => ['nullable', 'string', 'in:draft,active,completed,archived'],
            'commercial_operation_date' => ['nullable', 'date_format:Y-m-d'],
            'equity_contribution' => ['nullable', 'numeric', 'min:0'],
            'grant_amount' => ['nullable', 'numeric', 'min:0'],
            'grant_intensity_percent' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'vat_bridge_loan' => ['nullable', 'numeric', 'min:0'],
            'bank_loan_principal' => ['nullable', 'numeric', 'min:0'],
            'bank_base_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'bank_margin' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'bank_tenor_months' => ['nullable', 'integer', 'min:1', 'max:480'],
            'bank_grace_period_months' => ['nullable', 'integer', 'min:0'],
            'amortization_type' => ['nullable', 'string', 'in:ANNUITY,LINEAR,BULLET,annuity,linear,bullet'],
            'upfront_fee_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'facility_name' => ['nullable', 'string', 'max:255'],
            'base_rate_type' => ['nullable', 'string', 'max:32'],
            'operating_assumptions' => ['nullable', 'array'],
            'operating_assumptions.annual_revenue_base' => ['nullable', 'numeric', 'min:0'],
            'operating_assumptions.revenue_growth_rate_percent' => ['nullable', 'numeric'],
            'operating_assumptions.variable_cost_percent' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'operating_assumptions.annual_fixed_costs_base' => ['nullable', 'numeric', 'min:0'],
            'operating_assumptions.fixed_cost_growth_rate_percent' => ['nullable', 'numeric'],
            'operating_assumptions.annual_payroll_base' => ['nullable', 'numeric', 'min:0'],
            'operating_assumptions.payroll_growth_rate_percent' => ['nullable', 'numeric'],
            'operating_assumptions.revenue_lines' => ['nullable', 'array'],
            'operating_assumptions.headcount_matrix' => ['nullable', 'array'],
            'operating_assumptions.capacity_ramp_up' => ['nullable', 'array'],
            'operating_assumptions.cit_rate_percent' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'operating_assumptions.tax_loss_carry_forward_enabled' => ['nullable', 'boolean'],
            'operating_assumptions.tax_loss_offset_cap_percent' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'operating_assumptions.dso' => ['nullable', 'integer', 'min:0', 'max:365'],
            'operating_assumptions.dpo' => ['nullable', 'integer', 'min:0', 'max:365'],
            'operating_assumptions.dio' => ['nullable', 'integer', 'min:0', 'max:365'],
        ];
    }
}
