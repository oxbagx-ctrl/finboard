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

    protected function prepareForValidation(): void
    {
        if ($this->has('include_yoy')) {
            $val = $this->query('include_yoy');
            if (is_string($val)) {
                $lower = strtolower(trim($val));
                if (in_array($lower, ['true', '1'], true)) {
                    $this->merge(['include_yoy' => true]);
                } elseif (in_array($lower, ['false', '0'], true)) {
                    $this->merge(['include_yoy' => false]);
                }
            }
        }
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
            'currency' => ['nullable', 'string', 'size:3'],
            'record_type' => ['nullable', 'string', 'in:EXPENSE,expense,REVENUE,revenue,ASSET,asset,LIABILITY,liability'],
            'category_type' => ['nullable', 'string'],
            'include_yoy' => ['nullable', 'boolean'],
            'comparison_start_date' => ['nullable', 'date_format:Y-m-d'],
            'comparison_end_date' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:comparison_start_date'],
        ];
    }
}
