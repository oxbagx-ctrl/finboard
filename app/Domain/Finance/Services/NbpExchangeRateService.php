<?php

declare(strict_types=1);

namespace App\Domain\Finance\Services;

use App\Domain\Finance\Exceptions\NbpApiException;
use App\Models\ExchangeRate;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

class NbpExchangeRateService
{
    public const NBP_TABLE_A_URL = 'https://api.nbp.pl/api/exchangerates/tables/A/?format=json';
    public const CACHE_KEY = 'finance_exchange_rates_table_a';
    public const CACHE_TTL_SECONDS = 3600;
    public const HTTP_TIMEOUT_SECONDS = 10;

    /**
     * Fetch Table A from NBP API and upsert into database.
     *
     * @return array{table_no: string, effective_date: string, source: string, rates_count: int, rates: array<int, ExchangeRate>}
     * @throws NbpApiException
     */
    public function syncRates(): array
    {
        $payload = $this->fetchTableARates();
        $synced = $this->persistRates($payload);
        $this->invalidateCache();

        return $synced;
    }

    /**
     * Fetch Table A raw response from NBP API.
     *
     * @return array{table: string, no: string, effectiveDate: string, rates: array<int, array{currency: string, code: string, mid: float}>}
     * @throws NbpApiException
     */
    public function fetchTableARates(): array
    {
        try {
            $response = Http::timeout(self::HTTP_TIMEOUT_SECONDS)
                ->acceptJson()
                ->get(self::NBP_TABLE_A_URL);
        } catch (Throwable $e) {
            Log::error('NBP API network error', ['error' => $e->getMessage()]);
            throw NbpApiException::networkError(self::NBP_TABLE_A_URL, $e->getMessage());
        }

        if (!$response->successful()) {
            Log::error('NBP API request failed', [
                'status' => $response->status(),
                'body' => $response->body(),
            ]);
            throw NbpApiException::requestFailed(self::NBP_TABLE_A_URL, $response->status(), $response->body());
        }

        $json = $response->json();

        return $this->validateAndNormalizePayload($json);
    }

    /**
     * Validate and normalize NBP JSON structure.
     *
     * @param mixed $json
     * @return array{table: string, no: string, effectiveDate: string, rates: array<int, array{currency: string, code: string, mid: float}>}
     * @throws NbpApiException
     */
    public function validateAndNormalizePayload(mixed $json): array
    {
        if (!is_array($json) || empty($json) || !isset($json[0]) || !is_array($json[0])) {
            throw NbpApiException::invalidPayload('Oczekiwano tablicy z co najmniej jednym elementem tabeli.');
        }

        $tableData = $json[0];

        if (!isset($tableData['table']) || $tableData['table'] !== 'A') {
            throw NbpApiException::invalidPayload('Brak identyfikatora tabeli A.');
        }

        if (empty($tableData['no']) || !is_string($tableData['no'])) {
            throw NbpApiException::invalidPayload('Brak poprawnego numeru tabeli (no).');
        }

        if (empty($tableData['effectiveDate']) || !is_string($tableData['effectiveDate'])) {
            throw NbpApiException::invalidPayload('Brak poprawnej daty publikacji (effectiveDate).');
        }

        if (!isset($tableData['rates']) || !is_array($tableData['rates']) || empty($tableData['rates'])) {
            throw NbpApiException::invalidPayload('Brak pozycji kursowych w tabeli (rates).');
        }

        foreach ($tableData['rates'] as $rate) {
            if (!is_array($rate) || empty($rate['code']) || !isset($rate['mid']) || !is_numeric($rate['mid']) || (float) $rate['mid'] <= 0) {
                throw NbpApiException::invalidPayload('Nieprawidłowa pozycja walutowa w kolekcji rates.');
            }
        }

        return $tableData;
    }

    /**
     * Atomically persist rates into PostgreSQL.
     *
     * @param array{table: string, no: string, effectiveDate: string, rates: array<int, array{currency: string, code: string, mid: float}>} $tableData
     * @return array{table_no: string, effective_date: string, source: string, rates_count: int, rates: array<int, ExchangeRate>}
     */
    public function persistRates(array $tableData): array
    {
        $tableNo = (string) $tableData['no'];
        $effectiveDate = (string) $tableData['effectiveDate'];
        $fetchedAt = Carbon::now();

        return DB::transaction(function () use ($tableData, $tableNo, $effectiveDate, $fetchedAt): array {
            $upserted = [];

            foreach ($tableData['rates'] as $item) {
                $currencyCode = strtoupper(trim((string) $item['code']));
                $currencyName = trim((string) ($item['currency'] ?? $currencyCode));
                $midRate = (float) $item['mid'];
                $multiplier = round(1.0 / $midRate, 8);

                $rate = ExchangeRate::updateOrCreate(
                    ['currency' => $currencyCode],
                    [
                        'currency_name' => $currencyName,
                        'mid_rate' => $midRate,
                        'multiplier' => $multiplier,
                        'table_no' => $tableNo,
                        'effective_date' => $effectiveDate,
                        'source' => 'NBP',
                        'fetched_at' => $fetchedAt,
                    ]
                );

                $upserted[] = $rate;
            }

            return [
                'table_no' => $tableNo,
                'effective_date' => $effectiveDate,
                'source' => 'NBP',
                'rates_count' => count($upserted),
                'rates' => $upserted,
            ];
        });
    }

    /**
     * Convert an amount from PLN to target currency.
     */
    public function convertFromPln(float $amountInPln, string $targetCurrency): float
    {
        $target = strtoupper(trim($targetCurrency));
        if ($target === 'PLN') {
            return round($amountInPln, 4);
        }

        $rate = ExchangeRate::findByCurrency($target);
        if ($rate === null) {
            throw NbpApiException::currencyNotFound($target);
        }

        return $rate->convertFromPln($amountInPln);
    }

    /**
     * Convert an amount from source currency to PLN.
     */
    public function convertToPln(float $amountInForeignCurrency, string $sourceCurrency): float
    {
        $source = strtoupper(trim($sourceCurrency));
        if ($source === 'PLN') {
            return round($amountInForeignCurrency, 4);
        }

        $rate = ExchangeRate::findByCurrency($source);
        if ($rate === null) {
            throw NbpApiException::currencyNotFound($source);
        }

        return $rate->convertToPln($amountInForeignCurrency);
    }

    /**
     * Get rate model for given currency.
     */
    public function getRate(string $currency): ?ExchangeRate
    {
        return ExchangeRate::findByCurrency($currency);
    }

    /**
     * Get multiplier for given currency.
     */
    public function getMultiplier(string $currency): float
    {
        return ExchangeRate::getMultiplierFor($currency);
    }

    /**
     * Invalidate cached Table A exchange rates.
     */
    public function invalidateCache(): void
    {
        Cache::forget(self::CACHE_KEY);
    }

    /**
     * Get cached rates payload according to Cache-Aside strategy.
     *
     * @return array<string, mixed>
     */
    public function getCachedRatesPayload(bool $forceRefresh = false): array
    {
        if ($forceRefresh) {
            $this->invalidateCache();
        }

        $isCached = Cache::has(self::CACHE_KEY);

        if ($isCached && !$forceRefresh) {
            /** @var array<string, mixed> $cachedData */
            $cachedData = Cache::get(self::CACHE_KEY);
            $cachedData['cached'] = true;
            return $cachedData;
        }

        $rates = ExchangeRate::orderBy('currency')->get();

        // If database is completely empty, attempt sync
        if ($rates->isEmpty()) {
            $this->syncRates();
            $rates = ExchangeRate::orderBy('currency')->get();
        }

        $multipliers = ['PLN' => 1.0];
        $ratesArray = [];
        $latestTableNo = 'N/A';
        $latestEffectiveDate = Carbon::today()->toDateString();
        $latestFetchedAt = Carbon::now()->toIso8601String();

        foreach ($rates as $rate) {
            $multipliers[$rate->currency] = (float) $rate->multiplier;
            $ratesArray[] = [
                'id' => $rate->id,
                'currency' => $rate->currency,
                'currency_name' => $rate->currency_name,
                'mid_rate' => (float) $rate->mid_rate,
                'multiplier' => (float) $rate->multiplier,
                'table_no' => $rate->table_no,
                'effective_date' => $rate->effective_date?->format('Y-m-d'),
                'source' => $rate->source,
                'fetched_at' => $rate->fetched_at?->toIso8601String(),
            ];
            $latestTableNo = $rate->table_no;
            if ($rate->effective_date) {
                $latestEffectiveDate = $rate->effective_date->format('Y-m-d');
            }
            if ($rate->fetched_at) {
                $latestFetchedAt = $rate->fetched_at->toIso8601String();
            }
        }

        $payload = [
            'source' => 'NBP',
            'table_no' => $latestTableNo,
            'effective_date' => $latestEffectiveDate,
            'fetched_at' => $latestFetchedAt,
            'cached' => false,
            'rates' => $ratesArray,
            'multipliers' => $multipliers,
        ];

        Cache::put(self::CACHE_KEY, $payload, self::CACHE_TTL_SECONDS);

        return $payload;
    }
}
