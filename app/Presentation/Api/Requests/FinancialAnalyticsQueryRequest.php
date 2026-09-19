<?php

declare(strict_types=1);

namespace App\Presentation\Api\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class FinancialAnalyticsQueryRequest extends FormRequest
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
            'start_date' => ['nullable', 'date_format:Y-m-d'],
            'end_date' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:start_date'],
            'currency' => ['nullable', 'string', 'in:PLN,EUR,USD,GBP'],
            'record_type' => ['nullable', 'string', 'in:EXPENSE,expense,REVENUE,revenue,ASSET,asset,LIABILITY,liability'],
            'category_type' => ['nullable', 'string'],
        ];
    }
}
