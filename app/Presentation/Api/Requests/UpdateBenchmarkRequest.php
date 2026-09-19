<?php

declare(strict_types=1);

namespace App\Presentation\Api\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class UpdateBenchmarkRequest extends FormRequest
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
            'target_value' => ['required', 'numeric'],
            'warning_threshold' => ['required', 'numeric'],
            'critical_threshold' => ['nullable', 'numeric'],
            'higher_is_better' => ['nullable', 'boolean'],
            'description' => ['nullable', 'string', 'max:255'],
        ];
    }
}
