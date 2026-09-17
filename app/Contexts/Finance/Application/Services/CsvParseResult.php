<?php

declare(strict_types=1);

namespace App\Contexts\Finance\Application\Services;

final readonly class CsvParseResult
{
    /**
     * @param array<int, array{
     *     category_id: string,
     *     amount: string,
     *     currency: string,
     *     record_date: string,
     *     description: string,
     *     source: string
     * }> $validRecords
     * @param array<int, array{
     *     line: int,
     *     column?: string,
     *     message: string,
     *     raw_value?: mixed
     * }> $errors
     */
    public function __construct(
        public array $validRecords,
        public array $errors,
        public int $totalRows
    ) {
    }

    public function isValid(): bool
    {
        return empty($this->errors);
    }

    public function successCount(): int
    {
        return count($this->validRecords);
    }

    public function errorCount(): int
    {
        return count($this->errors);
    }

    /**
     * @return array<string, mixed>
     */
    public function toSummary(): array
    {
        return [
            'is_valid' => $this->isValid(),
            'total_rows' => $this->totalRows,
            'success_count' => $this->successCount(),
            'error_count' => $this->errorCount(),
            'errors' => $this->errors,
        ];
    }
}
