import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { DealProvider, useDeal, CURRENCIES } from '../../context/DealContext';
import apiClient from '../../api/client';

vi.mock('../../api/client', () => ({
    default: {
        get: vi.fn(),
    },
}));

const wrapper = ({ children }) => <DealProvider>{children}</DealProvider>;

describe('DealContext - NBP Exchange Rates & Multi-Currency Engine', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('initializes with default fallback rates and metadata', () => {
        const { result } = renderHook(() => useDeal(), { wrapper });

        expect(result.current.currency).toBe('PLN');
        expect(result.current.currentCurrencyObj.rate).toBe(1.0);
        expect(result.current.ratesMetadata.isFallback).toBe(true);
        expect(result.current.ratesMetadata.source).toBe('NBP');
        expect(result.current.loadingRates).toBe(false);
        expect(result.current.ratesError).toBeNull();
        expect(result.current.currencies.length).toBeGreaterThanOrEqual(3);
    });

    it('asynchronously loads NBP exchange rates from API and populates dynamic currencies', async () => {
        apiClient.get.mockImplementation((url) => {
            if (url === '/finance/exchange-rates') {
                return Promise.resolve({
                    data: {
                        source: 'NBP',
                        table_no: '055/A/NBP/2026',
                        effective_date: '2026-03-20',
                        fetched_at: '2026-03-20T10:00:00Z',
                        cached: true,
                        rates: [
                            {
                                currency: 'EUR',
                                currency_name: 'euro',
                                mid_rate: 4.3125,
                                multiplier: 0.23188406,
                                table_no: '055/A/NBP/2026',
                                effective_date: '2026-03-20',
                            },
                            {
                                currency: 'USD',
                                currency_name: 'dolar amerykański',
                                mid_rate: 3.9450,
                                multiplier: 0.25348542,
                                table_no: '055/A/NBP/2026',
                                effective_date: '2026-03-20',
                            },
                        ],
                        multipliers: {
                            PLN: 1.0,
                            EUR: 0.23188406,
                            USD: 0.25348542,
                        },
                    },
                });
            }
            return Promise.resolve({ data: { data: [] } });
        });

        const { result } = renderHook(() => useDeal(), { wrapper });

        await act(async () => {
            await result.current.refreshRates();
        });

        expect(apiClient.get).toHaveBeenCalledWith('/finance/exchange-rates', { params: {} });
        expect(result.current.ratesMetadata.isFallback).toBe(false);
        expect(result.current.ratesMetadata.tableNo).toBe('055/A/NBP/2026');
        expect(result.current.ratesMetadata.effectiveDate).toBe('2026-03-20');
        expect(result.current.ratesMetadata.cached).toBe(true);

        const eurObj = result.current.currencies.find(c => c.code === 'EUR');
        expect(eurObj).toBeDefined();
        expect(eurObj.midRate).toBe(4.3125);
        expect(eurObj.rate).toBeCloseTo(0.23188406, 6);
        expect(eurObj.label).toContain('4.3125');

        // Test dynamic conversion with live NBP rate
        act(() => {
            result.current.setCurrency('EUR');
        });
        expect(result.current.currency).toBe('EUR');
        expect(result.current.convertAmount(10000)).toBeCloseTo(2318.84, 2);
    });

    it('supports forced cache refresh via refreshRates(true)', async () => {
        apiClient.get.mockResolvedValueOnce({
            data: {
                source: 'NBP',
                table_no: '056/A/NBP/2026',
                effective_date: '2026-03-21',
                cached: false,
                rates: [
                    {
                        currency: 'EUR',
                        currency_name: 'euro',
                        mid_rate: 4.3000,
                        multiplier: 0.23255814,
                        table_no: '056/A/NBP/2026',
                        effective_date: '2026-03-21',
                    },
                ],
            },
        });

        const { result } = renderHook(() => useDeal(), { wrapper });

        await act(async () => {
            await result.current.refreshRates(true);
        });

        expect(apiClient.get).toHaveBeenCalledWith('/finance/exchange-rates', { params: { refresh: 1 } });
        expect(result.current.ratesMetadata.tableNo).toBe('056/A/NBP/2026');
        expect(result.current.ratesMetadata.cached).toBe(false);
    });

    it('falls back gracefully to offline defaults on API error', async () => {
        apiClient.get.mockRejectedValueOnce(new Error('Network Gateway Timeout'));

        const { result } = renderHook(() => useDeal(), { wrapper });

        await act(async () => {
            await result.current.refreshRates();
        });

        expect(result.current.ratesError).toBe('Network Gateway Timeout');
        expect(result.current.ratesMetadata.isFallback).toBe(true);

        // Offline fallback conversion still functions properly
        act(() => {
            result.current.setCurrency('EUR');
        });
        expect(result.current.convertAmount(10000)).toBeCloseTo(2325, 1);
    });
});
