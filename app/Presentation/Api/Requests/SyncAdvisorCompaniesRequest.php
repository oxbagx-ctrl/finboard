<?php

declare(strict_types=1);

namespace App\Presentation\Api\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class SyncAdvisorCompaniesRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();
        return $user !== null && ($user->isSuperAdmin() || $user->isAdmin());
    }

    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'company_ids' => ['present', 'array'],
            'company_ids.*' => ['uuid', 'exists:companies,id'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'company_ids.present' => 'Pole company_ids jest wymagane (może być pustą tablicą).',
            'company_ids.array' => 'Pole company_ids musi być tablicą identyfikatorów UUID.',
            'company_ids.*.uuid' => 'Każdy identyfikator spółki musi być prawidłowym UUID.',
            'company_ids.*.exists' => 'Jedna lub więcej wskazanych spółek nie istnieje w systemie.',
        ];
    }
}
