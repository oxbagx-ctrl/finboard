<?php

declare(strict_types=1);

namespace App\Presentation\Api\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class StoreInvitationRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();
        return $user !== null && ($user->isAdmin() || $user->isAdvisor());
    }

    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'email' => ['required', 'string', 'email', 'max:255'],
            'role' => ['required', 'string', 'in:super_admin,admin,advisor,client'],
            'company_id' => ['nullable', 'uuid', 'exists:companies,id', 'required_if:role,client'],
            'assigned_company_ids' => ['nullable', 'array'],
            'assigned_company_ids.*' => ['uuid', 'exists:companies,id'],
            'validity_hours' => ['nullable', 'integer', 'min:1', 'max:720'],
        ];
    }
}
