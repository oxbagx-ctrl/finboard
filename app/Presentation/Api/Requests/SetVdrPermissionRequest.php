<?php

declare(strict_types=1);

namespace App\Presentation\Api\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class SetVdrPermissionRequest extends FormRequest
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
            'subject_type' => ['required', 'string', 'in:role,user'],
            'subject_id' => ['required', 'string', 'max:255'],
            'permission_level' => ['required', 'string', 'in:none,view,download,manage'],
            'watermark_required' => ['nullable', 'boolean'],
            'company_id' => ['nullable', 'uuid', 'exists:companies,id'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'subject_type.in' => 'Typ podmiotu musi mieć wartość "role" lub "user".',
            'permission_level.in' => 'Poziom uprawnień musi mieć wartość: none, view, download lub manage.',
        ];
    }
}
