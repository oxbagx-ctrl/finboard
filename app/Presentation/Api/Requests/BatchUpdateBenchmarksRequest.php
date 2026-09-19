<?php

declare(strict_types=1);

namespace App\Presentation\Api\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class BatchUpdateBenchmarksRequest extends FormRequest
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
            'benchmarks' => ['required', 'array', 'min:1'],
            'benchmarks.*.metric_type' => ['required', 'string'],
            'benchmarks.*.target_value' => ['required', 'numeric'],
            'benchmarks.*.warning_threshold' => ['required', 'numeric'],
            'benchmarks.*.critical_threshold' => ['nullable', 'numeric'],
            'benchmarks.*.higher_is_better' => ['nullable', 'boolean'],
            'benchmarks.*.description' => ['nullable', 'string', 'max:255'],
        ];
    }
}
