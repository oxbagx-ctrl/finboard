<?php

declare(strict_types=1);

namespace App\Presentation\Api\Resources;

use App\Models\FinancialRecord;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin FinancialRecord
 */
final class FinancialRecordResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'company_id' => $this->company_id,
            'category_id' => $this->category_id,
            'category' => $this->whenLoaded('category', function () {
                return [
                    'id' => $this->category?->id,
                    'name' => $this->category?->name,
                    'type' => $this->category?->type,
                    'code' => $this->category?->code,
                ];
            }, [
                'id' => $this->category_id,
                'name' => $this->category?->name,
                'type' => $this->category?->type,
                'code' => $this->category?->code,
            ]),
            'record_type' => $this->record_type,
            'amount' => (float) $this->amount,
            'formatted_amount' => number_format((float) $this->amount, 2, ',', ' ') . ' ' . $this->currency,
            'currency' => $this->currency,
            'record_date' => $this->record_date?->format('Y-m-d') ?? (string) $this->record_date,
            'description' => $this->description,
            'source' => $this->source,
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
