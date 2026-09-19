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

describe('DealContext & Currency Engine', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('initializes with default PLN currency and full history period', () => {
        const { result } = renderHook(() => useDeal(), { wrapper });

        expect(result.current.currency).toBe('PLN');
        expect(result.current.currentCurrencyObj.rate).toBe(1.0);
        expect(result.current.selectedYear).toBe('all');
        expect(result.current.selectedQuarter).toBe('all');
        expect(result.current.dateRange.startDate).toBeNull();
        expect(result.current.dateRange.endDate).toBeNull();
        expect(result.current.availableYears).toEqual(['2026', '2025']);
    });

    it('converts amounts according to selected currency rates', () => {
        const { result } = renderHook(() => useDeal(), { wrapper });

        // Default PLN (rate 1.0)
        expect(result.current.convertAmount(10000)).toBe(10000);

        // Switch to EUR (rate 0.2325)
        act(() => {
            result.current.setCurrency('EUR');
        });
        expect(result.current.currency).toBe('EUR');
        expect(result.current.convertAmount(10000)).toBeCloseTo(2325, 2);

        // Switch to USD (rate 0.2564)
        act(() => {
            result.current.setCurrency('USD');
        });
        expect(result.current.currency).toBe('USD');
        expect(result.current.convertAmount(10000)).toBeCloseTo(2564, 2);
    });

    it('handles invalid numbers gracefully in convertAmount', () => {
        const { result } = renderHook(() => useDeal(), { wrapper });

        expect(result.current.convertAmount(null)).toBe(0);
        expect(result.current.convertAmount(undefined)).toBe(0);
        expect(result.current.convertAmount('invalid')).toBe(0);
    });

    it('correctly calculates quarterly fiscal date ranges', () => {
        const { result } = renderHook(() => useDeal(), { wrapper });

        act(() => {
            result.current.setSelectedYear('2026');
            result.current.setSelectedQuarter('Q2');
        });

        expect(result.current.dateRange.startDate).toBe('2026-04-01');
        expect(result.current.dateRange.endDate).toBe('2026-06-30');
        expect(result.current.dateRange.label).toContain('Q2 2026');

        act(() => {
            result.current.setSelectedQuarter('Q3');
        });

        expect(result.current.dateRange.startDate).toBe('2026-07-01');
        expect(result.current.dateRange.endDate).toBe('2026-09-30');
    });

    it('resets filters back to base defaults', () => {
        const { result } = renderHook(() => useDeal(), { wrapper });

        act(() => {
            result.current.setSelectedYear('2026');
            result.current.setSelectedQuarter('Q3');
            result.current.setCurrency('EUR');
        });

        expect(result.current.currency).toBe('EUR');

        act(() => {
            result.current.resetFilters();
        });

        expect(result.current.currency).toBe('PLN');
        expect(result.current.selectedYear).toBe('all');
        expect(result.current.selectedQuarter).toBe('all');
    });

    it('dynamically adapts history date range label to custom available fiscal years span', () => {
        const customWrapper = ({ children }) => (
            <DealProvider initialYears={['2026', '2025', '2024', '2023']}>
                {children}
            </DealProvider>
        );

        const { result } = renderHook(() => useDeal(), { wrapper: customWrapper });

        expect(result.current.availableYears).toEqual(['2026', '2025', '2024', '2023']);
        expect(result.current.dateRange.label).toBe('Pełna historia (2023 – 2026)');
    });

    it('fetches dynamic available years from API and updates state', async () => {
        apiClient.get.mockResolvedValueOnce({
            data: {
                status: 'success',
                count: 4,
                data: [2026, 2025, 2024, 2023],
            },
        });

        const { result } = renderHook(() => useDeal(), { wrapper });

        await act(async () => {
            await result.current.refreshAvailableYears();
        });

        expect(apiClient.get).toHaveBeenCalledWith('/finance/analytics/years', expect.any(Object));
        expect(result.current.availableYears).toEqual(['2026', '2025', '2024', '2023']);
        expect(result.current.dateRange.label).toBe('Pełna historia (2023 – 2026)');
    });

    it('resets selectedYear to all if active year is no longer in available years', () => {
        const { result } = renderHook(() => useDeal(), { wrapper });

        act(() => {
            result.current.setSelectedYear('2025');
        });
        expect(result.current.selectedYear).toBe('2025');

        act(() => {
            result.current.setAvailableYears(['2026']);
        });

        expect(result.current.selectedYear).toBe('all');
    });
});
