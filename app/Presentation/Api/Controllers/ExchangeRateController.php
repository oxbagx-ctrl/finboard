<?php

declare(strict_types=1);

namespace App\Presentation\Api\Controllers;

use App\Domain\Finance\Exceptions\NbpApiException;
use App\Domain\Finance\Services\NbpExchangeRateService;
use App\Models\ExchangeRate;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

final class ExchangeRateController
{
    public function __construct(
        private readonly NbpExchangeRateService $exchangeRateService
    ) {
    }

    /**
     * Get official NBP exchange rates with Cache-Aside strategy and multipliers dictionary.
     * Supports ?refresh=1 to bypass cache and re-fetch.
     */
    public function index(Request $request): JsonResponse
    {
        $forceRefresh = $request->boolean('refresh') || $request->input('refresh') === '1' || $request->boolean('force');

        try {
            $payload = $this->exchangeRateService->getCachedRatesPayload($forceRefresh);

            return response()->json($payload, Response::HTTP_OK);
        } catch (Throwable $e) {
            return response()->json([
                'error' => 'Błąd pobierania kursów walut NBP',
                'message' => $e->getMessage(),
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Get specific currency exchange rate details and a 100-unit conversion sample.
     */
    public function show(string $currency): JsonResponse
    {
        $code = strtoupper(trim($currency));

        if ($code === 'PLN') {
            return response()->json([
                'currency' => 'PLN',
                'currency_name' => 'złoty polski (waluta bazowa)',
                'mid_rate' => 1.0,
                'multiplier' => 1.0,
                'table_no' => 'N/A',
                'effective_date' => now()->toDateString(),
                'source' => 'NBP',
                'fetched_at' => now()->toIso8601String(),
                'conversion_sample' => [
                    'amount' => 100.0,
                    'from_currency_to_pln' => 100.0,
                    'from_pln_to_currency' => 100.0,
                ],
            ], Response::HTTP_OK);
        }

        $rate = ExchangeRate::findByCurrency($code);

        if ($rate === null) {
            return response()->json([
                'error' => 'Waluta nie znaleziona',
                'message' => "Waluta {$code} nie została odnaleziona w tabeli kursów NBP.",
            ], Response::HTTP_NOT_FOUND);
        }

        $sampleAmount = 100.0;

        return response()->json([
            'id' => $rate->id,
            'currency' => $rate->currency,
            'currency_name' => $rate->currency_name,
            'mid_rate' => (float) $rate->mid_rate,
            'multiplier' => (float) $rate->multiplier,
            'table_no' => $rate->table_no,
            'effective_date' => $rate->effective_date?->format('Y-m-d'),
            'source' => $rate->source,
            'fetched_at' => $rate->fetched_at?->toIso8601String(),
            'conversion_sample' => [
                'amount' => $sampleAmount,
                'from_currency_to_pln' => $rate->convertToPln($sampleAmount),
                'from_pln_to_currency' => $rate->convertFromPln($sampleAmount),
            ],
        ], Response::HTTP_OK);
    }

    /**
     * Trigger on-demand synchronization with official NBP Table A API.
     */
    public function sync(): JsonResponse
    {
        try {
            $result = $this->exchangeRateService->syncRates();

            return response()->json([
                'message' => 'Pomyślnie zsynchronizowano kursy walut z API NBP.',
                'table_no' => $result['table_no'],
                'effective_date' => $result['effective_date'],
                'source' => $result['source'],
                'rates_count' => $result['rates_count'],
                'rates' => $result['rates'],
            ], Response::HTTP_OK);
        } catch (NbpApiException $e) {
            return response()->json([
                'error' => 'Błąd synchronizacji z API NBP',
                'message' => $e->getMessage(),
            ], Response::HTTP_BAD_GATEWAY);
        } catch (Throwable $e) {
            return response()->json([
                'error' => 'Nieoczekiwany błąd serwera podczas synchronizacji',
                'message' => $e->getMessage(),
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }
}
