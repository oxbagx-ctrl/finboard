<?php

declare(strict_types=1);

namespace App\Presentation\Api\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class CreateTransactionFolderRequest extends FormRequest
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
            'name' => ['required', 'string', 'max:255'],
            'index_code' => ['required', 'string', 'max:50', 'regex:/^\d+(\.\d+)*$/'],
            'parent_id' => ['nullable', 'uuid', 'exists:transaction_folders,id'],
            'description' => ['nullable', 'string', 'max:1000'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'company_id' => ['nullable', 'uuid', 'exists:companies,id'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'index_code.regex' => 'Kod indeksu Dewey musi mieć postać np. 01.00 lub 01.01.02.',
        ];
    }
}
