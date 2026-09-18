import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { DealProvider, useDeal, CURRENCIES } from '../../context/DealContext';

const wrapper = ({ children }) => <DealProvider>{children}</DealProvider>;

describe('DealContext & Currency Engine', () => {
    it('initializes with default PLN currency and full history period', () => {
        const { result } = renderHook(() => useDeal(), { wrapper });

        expect(result.current.currency).toBe('PLN');
        expect(result.current.currentCurrencyObj.rate).toBe(1.0);
        expect(result.current.selectedYear).toBe('all');
        expect(result.current.selectedQuarter).toBe('all');
        expect(result.current.dateRange.startDate).toBeNull();
        expect(result.current.dateRange.endDate).toBeNull();
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
});
