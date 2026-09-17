<?php

declare(strict_types=1);

namespace App\Contexts\Finance\Application\Services;

use App\Contexts\Finance\Domain\Repositories\CategoryRepositoryInterface;
use App\Contexts\Finance\Domain\ValueObjects\Currency;
use DateTimeImmutable;
use Exception;

final class CsvFinancialDataParser
{
    private const REQUIRED_COLUMNS = ['category', 'amount', 'date', 'description'];

    public function __construct(
        private readonly CategoryRepositoryInterface $categoryRepository
    ) {
    }

    /**
     * Parse CSV string content or stream into structured records with validation.
     */
    public function parse(string $csvContent, string $defaultCurrency = 'PLN'): CsvParseResult
    {
        $lines = preg_split('/\r\n|\r|\n/', trim($csvContent));
        if (empty($lines) || (count($lines) === 1 && trim($lines[0]) === '')) {
            return new CsvParseResult([], [['line' => 1, 'message' => 'Plik CSV jest pusty.']], 0);
        }

        $delimiter = $this->detectDelimiter($lines[0]);
        $rawHeaders = str_getcsv($lines[0], $delimiter);
        $headerMap = $this->mapHeaders($rawHeaders);

        $missingHeaders = $this->checkMissingHeaders($headerMap);
        if (!empty($missingHeaders)) {
            return new CsvParseResult([], [[
                'line' => 1,
                'message' => 'Brak wymaganych kolumn w nagłówku CSV: ' . implode(', ', $missingHeaders),
            ]], 0);
        }

        // Cache categories by id, code, and slug
        $categories = $this->getCategoriesLookup();

        $validRecords = [];
        $errors = [];
        $totalRows = 0;

        for ($i = 1, $lineCount = count($lines); $i < $lineCount; $i++) {
            $line = trim($lines[$i]);
            if ($line === '') {
                continue; // Skip empty rows
            }

            $totalRows++;
            $lineNumber = $i + 1; // 1-based index including header
            $row = str_getcsv($line, $delimiter);

            $parsedRow = $this->parseRow($row, $headerMap, $categories, $lineNumber, $defaultCurrency);

            if ($parsedRow['error'] !== null) {
                $errors[] = $parsedRow['error'];
            } else {
                $validRecords[] = $parsedRow['data'];
            }
        }

        return new CsvParseResult($validRecords, $errors, $totalRows);
    }

    /**
     * Detect CSV delimiter (comma, semicolon, or tab).
     */
    private function detectDelimiter(string $firstLine): string
    {
        $semicolons = substr_count($firstLine, ';');
        $commas = substr_count($firstLine, ',');
        $tabs = substr_count($firstLine, "\t");

        if ($semicolons > $commas && $semicolons > $tabs) {
            return ';';
        }

        if ($tabs > $commas && $tabs > $semicolons) {
            return "\t";
        }

        return ',';
    }

    /**
     * Map raw header labels to canonical column names.
     *
     * @param array<int, string> $rawHeaders
     * @return array<string, int> Map canonical column to index
     */
    private function mapHeaders(array $rawHeaders): array
    {
        $map = [];
        $aliases = [
            'category' => ['category', 'kategoria', 'kod', 'category_code', 'category_id', 'typ', 'symbol'],
            'amount' => ['amount', 'kwota', 'wartosc', 'wartość', 'cena', 'suma', 'saldo'],
            'date' => ['date', 'data', 'record_date', 'data_operacji', 'data_ksiegowania', 'data_dokumentu'],
            'description' => ['description', 'opis', 'tytul', 'tytuł', 'nazwa', 'kontrahent', 'szczegoly', 'szczegóły'],
            'currency' => ['currency', 'waluta', 'iso'],
        ];

        foreach ($rawHeaders as $index => $rawHeader) {
            $cleaned = mb_strtolower(trim($rawHeader), 'UTF-8');
            // Remove BOM or extra quotes
            $cleaned = preg_replace('/[\x00-\x1F\x7F\xEF\xBB\xBF"]/', '', $cleaned);

            foreach ($aliases as $canonical => $synonyms) {
                if (in_array($cleaned, $synonyms, true) && !isset($map[$canonical])) {
                    $map[$canonical] = $index;
                    break;
                }
            }
        }

        return $map;
    }

    /**
     * @param array<string, int> $headerMap
     * @return array<string>
     */
    private function checkMissingHeaders(array $headerMap): array
    {
        $missing = [];
        foreach (self::REQUIRED_COLUMNS as $required) {
            if (!isset($headerMap[$required])) {
                $missing[] = $required;
            }
        }

        return $missing;
    }

    /**
     * @return array<string, string> Map category token to category ID
     */
    private function getCategoriesLookup(): array
    {
        $lookup = [];
        foreach ($this->categoryRepository->all() as $category) {
            $lookup[strtolower($category->id())] = $category->id();
            $lookup[strtolower($category->code())] = $category->id();
            $lookup[str_replace('-', '_', strtolower($category->id()))] = $category->id();
        }

        return $lookup;
    }

    /**
     * @param array<int, string> $row
     * @param array<string, int> $headerMap
     * @param array<string, string> $categories
     * @return array{data: array<string, mixed>|null, error: array<string, mixed>|null}
     */
    private function parseRow(
        array $row,
        array $headerMap,
        array $categories,
        int $lineNumber,
        string $defaultCurrency
    ): array {
        // Validate category
        $rawCategory = trim($row[$headerMap['category']] ?? '');
        if ($rawCategory === '') {
            return [
                'data' => null,
                'error' => [
                    'line' => $lineNumber,
                    'column' => 'category',
                    'message' => 'Pole kategorii nie może być puste.',
                    'raw_value' => $rawCategory,
                ],
            ];
        }

        $normalizedCatKey = strtolower($rawCategory);
        if (!isset($categories[$normalizedCatKey])) {
            return [
                'data' => null,
                'error' => [
                    'line' => $lineNumber,
                    'column' => 'category',
                    'message' => sprintf('Nieznany kod lub identyfikator kategorii: "%s".', $rawCategory),
                    'raw_value' => $rawCategory,
                ],
            ];
        }
        $categoryId = $categories[$normalizedCatKey];

        // Validate amount
        $rawAmount = trim($row[$headerMap['amount']] ?? '');
        $amount = $this->sanitizeAndValidateAmount($rawAmount);
        if ($amount === null) {
            return [
                'data' => null,
                'error' => [
                    'line' => $lineNumber,
                    'column' => 'amount',
                    'message' => sprintf('Niepoprawny format kwoty lub wartość ujemna: "%s".', $rawAmount),
                    'raw_value' => $rawAmount,
                ],
            ];
        }

        // Validate date
        $rawDate = trim($row[$headerMap['date']] ?? '');
        $date = $this->parseDate($rawDate);
        if ($date === null) {
            return [
                'data' => null,
                'error' => [
                    'line' => $lineNumber,
                    'column' => 'date',
                    'message' => sprintf('Niepoprawny format daty: "%s" (oczekiwany format: RRRR-MM-DD lub DD.MM.RRRR).', $rawDate),
                    'raw_value' => $rawDate,
                ],
            ];
        }

        // Validate description
        $description = trim($row[$headerMap['description']] ?? '');
        if ($description === '') {
            return [
                'data' => null,
                'error' => [
                    'line' => $lineNumber,
                    'column' => 'description',
                    'message' => 'Opis transakcji nie może być pusty.',
                    'raw_value' => '',
                ],
            ];
        }

        // Currency
        $currencyCode = $defaultCurrency;
        if (isset($headerMap['currency']) && !empty(trim($row[$headerMap['currency']] ?? ''))) {
            $rawCurrency = strtoupper(trim($row[$headerMap['currency']]));
            if (Currency::tryFrom($rawCurrency) === null) {
                return [
                    'data' => null,
                    'error' => [
                        'line' => $lineNumber,
                        'column' => 'currency',
                        'message' => sprintf('Nieobsługiwana waluta: "%s".', $rawCurrency),
                        'raw_value' => $rawCurrency,
                    ],
                ];
            }
            $currencyCode = $rawCurrency;
        }

        return [
            'data' => [
                'category_id' => $categoryId,
                'amount' => $amount,
                'currency' => $currencyCode,
                'record_date' => $date,
                'description' => $description,
                'source' => 'csv_import',
            ],
            'error' => null,
        ];
    }

    /**
     * Sanitize and format amount string using bcmath.
     */
    private function sanitizeAndValidateAmount(string $raw): ?string
    {
        // Strip out non-numeric currency symbols and whitespace
        $cleaned = preg_replace('/[^\d.,\-+]/u', '', $raw);
        if ($cleaned === null || $cleaned === '') {
            return null;
        }

        // Handle European thousand/decimal separators:
        // If it contains both dot and comma (e.g. "1,234.56" or "1.234,56")
        if (str_contains($cleaned, '.') && str_contains($cleaned, ',')) {
            $lastDot = strrpos($cleaned, '.');
            $lastComma = strrpos($cleaned, ',');
            if ($lastComma > $lastDot) {
                // Semicolon/European style: 1.250,50
                $cleaned = str_replace('.', '', $cleaned);
                $cleaned = str_replace(',', '.', $cleaned);
            } else {
                // US style: 1,250.50
                $cleaned = str_replace(',', '', $cleaned);
            }
        } else {
            // Only comma present, treat as decimal separator: "15000,50" -> "15000.50"
            $cleaned = str_replace(',', '.', $cleaned);
        }

        if (!is_numeric($cleaned)) {
            return null;
        }

        // Validate non-negative
        if (bccomp($cleaned, '0.0000', 4) < 0) {
            return null;
        }

        return bcadd($cleaned, '0', 4);
    }

    /**
     * Parse date string to YYYY-MM-DD.
     */
    private function parseDate(string $raw): ?string
    {
        $formats = [
            'Y-m-d',
            'd.m.Y',
            'd-m-Y',
            'Y/m/d',
            'd/m/Y',
        ];

        foreach ($formats as $format) {
            $dateTime = DateTimeImmutable::createFromFormat('!' . $format, $raw);
            if ($dateTime !== false && $dateTime->format($format) === $raw) {
                return $dateTime->format('Y-m-d');
            }
        }

        // Fallback to strtotime for lenient parse if valid
        try {
            $time = strtotime($raw);
            if ($time !== false && $time > 0) {
                $dt = (new DateTimeImmutable())->setTimestamp($time);
                // Sanity check year between 2000 and 2100
                $year = (int) $dt->format('Y');
                if ($year >= 2000 && $year <= 2100) {
                    return $dt->format('Y-m-d');
                }
            }
        } catch (Exception) {
            return null;
        }

        return null;
    }
}
