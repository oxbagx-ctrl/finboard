<?php

declare(strict_types=1);

namespace App\Presentation\Api\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class UpdateFinancialRecordRequest extends FormRequest
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
            'category_id' => ['required', 'string', 'exists:financial_categories,id'],
            'amount' => ['required', 'numeric', 'gt:0'],
            'currency' => ['nullable', 'string', 'in:PLN,EUR,USD,GBP'],
            'record_date' => ['required', 'date_format:Y-m-d'],
            'description' => ['required', 'string', 'max:255'],
        ];
    }
}
