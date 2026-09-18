<?php

declare(strict_types=1);

namespace App\Presentation\Api\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class AssignCompanyRequest extends FormRequest
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
            'company_id' => ['required_without:company_ids', 'uuid', 'exists:companies,id'],
            'company_ids' => ['required_without:company_id', 'array'],
            'company_ids.*' => ['uuid', 'exists:companies,id'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'company_id.required_without' => 'Identyfikator spółki (company_id) lub lista (company_ids) jest wymagana.',
            'company_id.uuid' => 'Identyfikator spółki musi być prawidłowym UUID.',
            'company_id.exists' => 'Wskazana spółka nie istnieje w systemie.',
            'company_ids.required_without' => 'Lista spółek lub pojedyncze ID jest wymagane.',
            'company_ids.array' => 'Lista spółek musi być tablicą identyfikatorów UUID.',
            'company_ids.*.uuid' => 'Każdy identyfikator spółki musi być prawidłowym UUID.',
            'company_ids.*.exists' => 'Jedna lub więcej wskazanych spółek nie istnieje w systemie.',
        ];
    }
}
