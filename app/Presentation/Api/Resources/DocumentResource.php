<?php

declare(strict_types=1);

namespace App\Presentation\Api\Resources;

use App\Contexts\DocumentManagement\Domain\ValueObjects\DocumentType;
use App\Models\Document;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Document
 */
final class DocumentResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $docType = DocumentType::tryFrom((string) $this->type);

        return [
            'id' => $this->id,
            'company_id' => $this->company_id,
            'uploaded_by_user_id' => $this->uploaded_by_user_id,
            'uploader' => $this->whenLoaded('uploader', function () {
                return [
                    'id' => $this->uploader?->id,
                    'name' => $this->uploader?->name,
                    'email' => $this->uploader?->email,
                ];
            }, [
                'id' => $this->uploaded_by_user_id,
                'name' => $this->uploader?->name,
                'email' => $this->uploader?->email,
            ]),
            'title' => $this->title,
            'type' => $this->type,
            'type_label' => $docType ? $docType->label() : $this->type,
            'original_name' => $this->original_name,
            'mime_type' => $this->mime_type,
            'size_bytes' => (int) $this->size_bytes,
            'formatted_size' => $this->formatBytes((int) $this->size_bytes),
            'checksum_sha256' => $this->checksum_sha256,
            'download_count' => (int) $this->download_count,
            'is_archived' => (bool) $this->is_archived,
            'folder_id' => $this->folder_id,
            'index_code' => $this->index_code,
            'folder' => $this->whenLoaded('folder', fn () => $this->folder ? [
                'id' => $this->folder->id,
                'name' => $this->folder->name,
                'index_code' => $this->folder->index_code,
            ] : null),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }

    private function formatBytes(int $bytes): string
    {
        if ($bytes >= 1048576) {
            return number_format($bytes / 1048576, 2, ',', ' ') . ' MB';
        }

        if ($bytes >= 1024) {
            return number_format($bytes / 1024, 1, ',', ' ') . ' KB';
        }

        return $bytes . ' B';
    }
}
