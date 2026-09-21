<?php

declare(strict_types=1);

namespace App\Presentation\Api\Resources;

use App\Contexts\Finance\Domain\ValueObjects\RecordType;
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
        $rawType = strtolower(trim((string) $this->record_type));
        if ($rawType === 'income') {
            $rawType = RecordType::REVENUE->value;
        }
        $recordTypeEnum = RecordType::tryFrom($rawType);
        $canonicalType = $recordTypeEnum?->value ?? strtolower((string) $this->record_type);
        $recordTypeLabel = $recordTypeEnum?->label() ?? ucfirst((string) $this->record_type);

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
            'record_type' => $canonicalType,
            'record_type_label' => $recordTypeLabel,
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
