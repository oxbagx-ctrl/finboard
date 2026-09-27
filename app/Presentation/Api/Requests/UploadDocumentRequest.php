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
            'file' => [
                'required',
                'file',
                'max:51200',
                'mimes:pdf,xlsx,xls,doc,docx,zip',
            ],
            'title' => ['required', 'string', 'max:255'],
            'type' => ['required', 'string', 'in:financial_report,contract,tax_declaration,audit_report,presentation,other'],
            'folder_id' => ['nullable', 'uuid', 'exists:transaction_folders,id'],
            'index_code' => ['nullable', 'string', 'max:50'],
            'company_id' => ['nullable', 'uuid', 'exists:companies,id'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'file.required' => 'Plik dokumentu jest wymagany.',
            'file.file' => 'Przesłany zasób musi być poprawnym plikiem.',
            'file.max' => 'Rozmiar pliku nie może przekraczać 50 MB.',
            'file.mimes' => 'Dozwolone są wyłącznie pliki w formatach: PDF, XLSX, XLS, DOC, DOCX, ZIP.',
        ];
    }
}
