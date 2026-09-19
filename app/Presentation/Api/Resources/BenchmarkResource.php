<?php

declare(strict_types=1);

namespace App\Presentation\Api\Resources;

use App\Contexts\Finance\Domain\Model\FinancialBenchmark;
use App\Contexts\Finance\Domain\ValueObjects\BenchmarkMetricType;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

final class BenchmarkResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        if ($this->resource instanceof FinancialBenchmark) {
            $data = $this->resource->toArray();
            $data['is_custom'] = $this->additional['is_custom'] ?? true;
            return $data;
        }

        if (is_array($this->resource)) {
            return $this->resource;
        }

        // Eloquent model fallback
        $metricType = BenchmarkMetricType::from($this->resource->metric_type);
        return [
            'id' => $this->resource->id,
            'company_id' => $this->resource->company_id,
            'metric_type' => $this->resource->metric_type,
            'label' => $metricType->label(),
            'target_value' => (float) $this->resource->target_value,
            'warning_threshold' => (float) $this->resource->warning_threshold,
            'critical_threshold' => $this->resource->critical_threshold !== null ? (float) $this->resource->critical_threshold : null,
            'higher_is_better' => (bool) $this->resource->higher_is_better,
            'unit' => $metricType->unit(),
            'description' => $this->resource->description,
            'updated_by' => $this->resource->updated_by,
            'is_custom' => $this->additional['is_custom'] ?? true,
            'updated_at' => $this->resource->updated_at?->toIso8601String(),
        ];
    }
}
