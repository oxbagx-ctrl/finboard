<?php

declare(strict_types=1);

namespace App\Presentation\Api\Requests\InvestmentProject;

use Illuminate\Foundation\Http\FormRequest;

final class UpdateInvestmentProjectRequest extends FormRequest
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
            'company_id' => ['nullable', 'uuid', 'exists:companies,id'],
            'name' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:1000'],
            'status' => ['nullable', 'string', 'in:draft,active,completed,archived'],
            'commercial_operation_date' => ['nullable', 'date_format:Y-m-d'],
        ];
    }
}
