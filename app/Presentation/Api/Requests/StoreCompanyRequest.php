<?php

declare(strict_types=1);

namespace App\Presentation\Api\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class StoreCompanyRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();
        return $user !== null && ($user->isAdmin() || $user->isSuperAdmin());
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('code') && is_string($this->input('code'))) {
            $this->merge([
                'code' => strtoupper(trim((string) $this->input('code'))),
            ]);
        }

        if ($this->has('name') && is_string($this->input('name'))) {
            $this->merge([
                'name' => trim((string) $this->input('name')),
            ]);
        }

        if ($this->has('tax_id') && is_string($this->input('tax_id'))) {
            $this->merge([
                'tax_id' => trim((string) $this->input('tax_id')),
            ]);
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'min:2', 'max:255'],
            'code' => [
                'required',
                'string',
                'min:2',
                'max:16',
                'regex:/^[A-Z0-9_-]+$/',
                Rule::unique('companies', 'code'),
            ],
            'tax_id' => ['nullable', 'string', 'max:32'],
            'assigned_advisor_ids' => ['nullable', 'array'],
            'assigned_advisor_ids.*' => [
                'uuid',
                Rule::exists('users', 'id')->where(function ($query) {
                    $query->whereIn('role', ['advisor', 'admin', 'super_admin']);
                }),
            ],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'name.required' => 'Nazwa spółki jest wymagana.',
            'name.min' => 'Nazwa spółki musi mieć co najmniej 2 znaki.',
            'code.required' => 'Kod identyfikacyjny spółki jest wymagany.',
            'code.min' => 'Kod identyfikacyjny spółki musi mieć co najmniej 2 znaki.',
            'code.max' => 'Kod identyfikacyjny spółki może mieć maksymalnie 16 znaków.',
            'code.unique' => 'Spółka o podanym kodzie już istnieje w systemie.',
            'code.regex' => 'Kod spółki może zawierać tylko wielkie litery, cyfry, myślniki i podkreślenia.',
            'assigned_advisor_ids.array' => 'Lista przypisanych doradców musi być tablicą.',
            'assigned_advisor_ids.*.exists' => 'Wskazany doradca nie istnieje w systemie lub nie posiada uprawnień doradcy.',
        ];
    }
}
