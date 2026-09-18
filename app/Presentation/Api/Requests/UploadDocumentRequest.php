<?php

declare(strict_types=1);

namespace App\Presentation\Api\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class UploadDocumentRequest extends FormRequest
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
            'file' => ['required', 'file', 'max:25600'],
            'title' => ['required', 'string', 'max:255'],
            'type' => ['required', 'string', 'in:financial_report,contract,tax_declaration,audit_report,presentation,other'],
            'company_id' => ['nullable', 'uuid', 'exists:companies,id'],
        ];
    }
}
