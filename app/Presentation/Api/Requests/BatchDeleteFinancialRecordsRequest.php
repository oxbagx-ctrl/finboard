<?php

declare(strict_types=1);

namespace App\Presentation\Api\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class BatchDeleteFinancialRecordsRequest extends FormRequest
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
            'record_ids' => ['required', 'array', 'min:1', 'max:500'],
            'record_ids.*' => ['required', 'uuid'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'record_ids.required' => 'Pole record_ids jest wymagane.',
            'record_ids.array' => 'Pole record_ids musi być tablicą identyfikatorów.',
            'record_ids.min' => 'Należy przekazać co najmniej jeden identyfikator do usunięcia.',
            'record_ids.max' => 'Maksymalna wielkość paczki do jednorazowego usunięcia wynosi 500 rekordów.',
            'record_ids.*.uuid' => 'Każdy identyfikator rekordu musi być poprawnym identyfikatorem UUID.',
        ];
    }
}
