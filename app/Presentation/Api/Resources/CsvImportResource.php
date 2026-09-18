<?php

declare(strict_types=1);

namespace App\Presentation\Api\Resources;

use App\Models\CsvImport;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin CsvImport
 */
final class CsvImportResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'company_id' => $this->company_id,
            'user_id' => $this->user_id,
            'file_name' => $this->file_name,
            'status' => $this->status,
            'total_rows' => $this->total_rows,
            'imported_rows' => $this->imported_rows,
            'error_count' => $this->error_count,
            'errors' => $this->errors,
            'completed_at' => $this->completed_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
