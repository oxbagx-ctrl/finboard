<?php

declare(strict_types=1);

namespace App\Presentation\Api\Requests\InvestmentProject;

use Illuminate\Foundation\Http\FormRequest;

final class InvestmentAppraisalQueryRequest extends FormRequest
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

            // Terminal value parameters
            'tv_method' => ['nullable', 'string', 'in:EXIT_MULTIPLE,GORDON_GROWTH,BOOK_VALUE,exit_multiple,gordon_growth,book_value'],
            'tv_parameter' => ['nullable', 'numeric'],

            // WACC parameters
            'risk_free_rate_percent' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'equity_risk_premium_percent' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'levered_beta' => ['nullable', 'numeric', 'min:0', 'max:10'],
            'cost_of_equity_percent' => ['nullable', 'numeric', 'min:0', 'max:100'],

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
            'tax_loss_settlement_mode' => ['nullable', 'string', 'in:standard_loss_cap,one_off_5m,ebt_cap'],
            'tax_loss_one_off_cap_amount' => ['nullable', 'numeric', 'min:0'],
        ];
    }
}
