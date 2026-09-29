import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { DealContextBar } from '../../components/layout/DealContextBar';
import { DealProvider } from '../../context/DealContext';
import apiClient from '../../api/client';

vi.mock('../../api/client', () => ({
    default: {
        get: vi.fn(),
    },
}));

describe('DealContextBar Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        apiClient.get.mockImplementation((url) => {
            if (url === '/finance/exchange-rates') {
                return Promise.resolve({
                    data: {
                        source: 'NBP',
                        table_no: '055/A/NBP/2026',
                        effective_date: '2026-03-20',
                        cached: false,
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
                    },
                });
            }
            return Promise.resolve({ data: { data: [] } });
        });
    });

    it('renders dynamic fiscal year options from DealContext', () => {
        render(
            <DealProvider initialYears={['2026', '2025', '2024', '2023']}>
                <DealContextBar />
            </DealProvider>
        );

        expect(screen.getByText('HISTORIA (2023-2026)')).toBeInTheDocument();
        expect(screen.getByText('FY 2026')).toBeInTheDocument();
        expect(screen.getByText('FY 2025')).toBeInTheDocument();
        expect(screen.getByText('FY 2024')).toBeInTheDocument();
        expect(screen.getByText('FY 2023')).toBeInTheDocument();
    });

    it('allows switching fiscal year and reveals quarter selector', () => {
        render(
            <DealProvider initialYears={['2026', '2025', '2024', '2023']}>
                <DealContextBar />
            </DealProvider>
        );

        const yearSelect = screen.getByRole('combobox');
        expect(screen.queryByText('KWARTAŁ:')).not.toBeInTheDocument();

        fireEvent.change(yearSelect, { target: { value: '2024' } });

        expect(screen.getByText('KWARTAŁ:')).toBeInTheDocument();
        expect(screen.getByText('RESET')).toBeInTheDocument();
    });

    it('resets filters when RESET button is clicked', () => {
        render(
            <DealProvider initialYears={['2026', '2025', '2024', '2023']}>
                <DealContextBar />
            </DealProvider>
        );

        const yearSelect = screen.getByRole('combobox');
        fireEvent.change(yearSelect, { target: { value: '2025' } });

        const resetBtn = screen.getByRole('button', { name: /RESET/i });
        fireEvent.click(resetBtn);

        expect(screen.queryByText('RESET')).not.toBeInTheDocument();
        expect(screen.queryByText('KWARTAŁ:')).not.toBeInTheDocument();
    });

    it('renders fallback badge initially and switches to NBP rate badge upon synchronization', async () => {
        render(
            <DealProvider>
                <DealContextBar />
            </DealProvider>
        );

        // Initially fallback badge is rendered
        expect(screen.getByTestId('nbp-fallback-badge')).toBeInTheDocument();
        expect(screen.getByText('OFFLINE FX')).toBeInTheDocument();

        // Trigger on-demand sync
        const syncButton = screen.getByTestId('refresh-nbp-rates-button');
        await act(async () => {
            fireEvent.click(syncButton);
        });

        await waitFor(() => {
            expect(screen.getByTestId('nbp-rate-badge')).toBeInTheDocument();
        });

        expect(screen.getByText(/NBP 055\/A\/NBP\/2026/i)).toBeInTheDocument();
        expect(screen.getByText('(2026-03-20)')).toBeInTheDocument();
    });

    it('displays active FX rate conversion badge when foreign currency is selected', async () => {
        render(
            <DealProvider>
                <DealContextBar />
            </DealProvider>
        );

        // Before selection, active FX rate badge is hidden for base currency PLN
        expect(screen.queryByTestId('active-fx-rate-badge')).not.toBeInTheDocument();

        // Switch to EUR
        const eurButton = screen.getByRole('button', { name: 'EUR' });
        fireEvent.click(eurButton);

        expect(screen.getByTestId('active-fx-rate-badge')).toBeInTheDocument();
        expect(screen.getByText('1 EUR =')).toBeInTheDocument();
        expect(screen.getByText(/4\.3000 PLN/)).toBeInTheDocument();
    });

    it('triggers on-demand rates refresh with forceRefresh parameter when clicked', async () => {
        render(
            <DealProvider>
                <DealContextBar />
            </DealProvider>
        );

        const syncButton = screen.getByTestId('refresh-nbp-rates-button');
        await act(async () => {
            fireEvent.click(syncButton);
        });

        expect(apiClient.get).toHaveBeenCalledWith('/finance/exchange-rates', { params: { refresh: 1 } });
    });

    it('allows selecting extended NBP currencies from dropdown and elevates selected currency as active pill', async () => {
        apiClient.get.mockResolvedValueOnce({
            data: {
                source: 'NBP',
                table_no: '055/A/NBP/2026',
                effective_date: '2026-03-20',
                rates: [
                    { currency: 'EUR', currency_name: 'euro', mid_rate: 4.3125, multiplier: 0.23188406 },
                    { currency: 'JPY', currency_name: 'jen japoński', mid_rate: 0.0245, multiplier: 40.816326 },
                ],
            },
        });

        render(
            <DealProvider>
                <DealContextBar />
            </DealProvider>
        );

        const syncButton = screen.getByTestId('refresh-nbp-rates-button');
        await act(async () => {
            fireEvent.click(syncButton);
        });

        await waitFor(() => {
            expect(screen.getByTestId('other-currencies-select')).toBeInTheDocument();
        });

        const select = screen.getByTestId('other-currencies-select');
        await act(async () => {
            fireEvent.change(select, { target: { value: 'JPY' } });
        });

        expect(screen.getByRole('button', { name: 'JPY' })).toBeInTheDocument();
        expect(screen.getByTestId('active-fx-rate-badge')).toBeInTheDocument();
        expect(screen.getByText('1 JPY =')).toBeInTheDocument();
    });
});

