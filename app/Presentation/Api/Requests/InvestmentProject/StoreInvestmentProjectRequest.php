<?php

declare(strict_types=1);

namespace App\Presentation\Api\Requests\InvestmentProject;

use Illuminate\Foundation\Http\FormRequest;

final class StoreInvestmentProjectRequest extends FormRequest
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
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:1000'],
            'start_date' => ['required', 'date_format:Y-m-d'],
            'planning_horizon_years' => ['nullable', 'integer', 'min:1', 'max:30'],
            'currency' => ['nullable', 'string', 'in:PLN,EUR,USD,GBP'],

            // Montaż finansowy (Financing Structure)
            'equity_contribution' => ['nullable', 'numeric', 'min:0'],
            'grant_amount' => ['nullable', 'numeric', 'min:0'],
            'grant_intensity_percent' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'vat_bridge_loan' => ['nullable', 'numeric', 'min:0'],

            // Instrument dłużny (Debt Facility)
            'bank_loan_principal' => ['nullable', 'numeric', 'min:0'],
            'bank_base_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'bank_margin' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'bank_tenor_months' => ['nullable', 'integer', 'min:1', 'max:360'],
            'bank_grace_period_months' => ['nullable', 'integer', 'min:0', 'lt:bank_tenor_months'],
            'amortization_type' => ['nullable', 'string', 'in:ANNUITY,annuity,LINEAR,linear,BULLET,bullet'],
            'upfront_fee_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],

            // Parametry podatkowe i operacyjne
            'vat_rate_percent' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'dso' => ['nullable', 'integer', 'min:0', 'max:365'],
            'dpo' => ['nullable', 'integer', 'min:0', 'max:365'],
            'dio' => ['nullable', 'integer', 'min:0', 'max:365'],
            'capitalization_rate_percent' => ['nullable', 'numeric', 'gt:0', 'max:100'],
            'valuation_multiple' => ['nullable', 'numeric', 'gt:0', 'max:100'],
        ];
    }
}
