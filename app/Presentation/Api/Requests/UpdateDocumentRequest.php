<?php

declare(strict_types=1);

namespace App\Presentation\Api\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class UpdateDocumentRequest extends FormRequest
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
            'title' => ['required', 'string', 'max:255'],
            'type' => ['required', 'string', 'in:financial_report,contract,tax_declaration,audit_report,presentation,other'],
            'folder_id' => ['nullable', 'uuid', 'exists:transaction_folders,id'],
            'index_code' => ['nullable', 'string', 'max:50'],
        ];
    }
}
