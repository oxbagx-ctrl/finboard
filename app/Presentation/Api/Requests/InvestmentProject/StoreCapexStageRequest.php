<?php

declare(strict_types=1);

namespace App\Presentation\Api\Requests\InvestmentProject;

use Illuminate\Foundation\Http\FormRequest;

final class StoreCapexStageRequest extends FormRequest
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
            'stage_name' => ['required', 'string', 'max:255'],
            'net_amount' => ['required', 'numeric', 'gt:0'],
            'currency' => ['nullable', 'string', 'in:PLN,EUR,USD,GBP'],
            'start_date' => ['nullable', 'date_format:Y-m-d'],
            'duration_months' => ['nullable', 'integer', 'min:1', 'max:120'],
            'kst_code' => ['nullable', 'string', 'max:50'],
            'is_grant_eligible' => ['nullable', 'boolean'],
            'grant_eligible_amount' => ['nullable', 'numeric', 'min:0'],
            'stage_order' => ['nullable', 'integer', 'min:1'],
        ];
    }
}
