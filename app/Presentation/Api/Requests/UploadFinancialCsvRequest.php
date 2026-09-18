<?php

declare(strict_types=1);

namespace App\Presentation\Api\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class UploadFinancialCsvRequest extends FormRequest
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
            'file' => ['required', 'file', 'mimes:csv,txt', 'max:10240'],
            'company_id' => ['nullable', 'uuid', 'exists:companies,id'],
            'currency' => ['nullable', 'string', 'in:PLN,EUR,USD,GBP'],
        ];
    }
}
