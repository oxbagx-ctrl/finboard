import React, { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { DealProvider, useDeal } from '../../context/DealContext';
import { DealContextBar } from '../../components/layout/DealContextBar';
import { ReportConfigurator } from '../../components/reports/ReportConfigurator';
import { ExecutivePdfReport } from '../../components/reports/ExecutivePdfReport';
import apiClient from '../../api/client';

vi.mock('../../api/client', () => ({
    default: {
        get: vi.fn(),
    },
}));

const mockCompany = {
    id: 'comp-100',
    name: 'Helvest Portfolio Co. Sp. z o.o.',
    code: 'HEL-1',
    tax_id: 'PL5259998877',
};

const mockMetrics = {
    period: { start: '2026-01-01', end: '2026-12-31', label: 'FY 2026' },
    pnl: {
        revenue: { amount: 10000000.0, formatted: '10 000 000,00 PLN' },
        cogs: { amount: 5000000.0, formatted: '5 000 000,00 PLN' },
        gross_profit: { amount: 5000000.0, formatted: '5 000 000,00 PLN' },
        gross_margin_pct: 50.0,
        opex: { amount: 2000000.0, formatted: '2 000 000,00 PLN' },
        depreciation: { amount: 500000.0, formatted: '500 000,00 PLN' },
        ebit: { amount: 2500000.0, formatted: '2 500 000,00 PLN' },
        ebitda: { amount: 3000000.0, formatted: '3 000 000,00 PLN' },
        ebitda_margin_pct: 30.0,
        financial_costs: { amount: 100000.0, formatted: '100 000,00 PLN' },
        tax: { amount: 456000.0, formatted: '456 000,00 PLN' },
        net_profit: { amount: 1944000.0, formatted: '1 944 000,00 PLN' },
        net_margin_pct: 19.44,
    },
    balance_sheet: {
        current_assets: { amount: 8000000.0, formatted: '8 000 000,00 PLN' },
        inventory: { amount: 2000000.0, formatted: '2 000 000,00 PLN' },
        quick_assets: { amount: 6000000.0, formatted: '6 000 000,00 PLN' },
        current_liabilities: { amount: 2500000.0, formatted: '2 500 000,00 PLN' },
    },
    ratios: {
        current_ratio: 3.20,
        quick_ratio: 2.40,
    },
};

// Integrated Deal Advisory Suite component linking DealContextBar, ReportConfigurator, and ExecutivePdfReport
const IntegratedDealSuite = () => {
    const { currency, setCurrency, ratesMetadata, currencies, convertAmount } = useDeal();
    const [reportConfig, setReportConfig] = useState({
        periodPreset: '2026',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        currency: currency,
        confidentiality: 'STRICTLY CONFIDENTIAL',
        sections: {
            kpi: true,
            pnl: true,
            liquidity: true,
            opex: true,
            audit: true,
        },
        commentary: 'Spółka kwalifikuje się do wyceny w oparciu o Constant FX.',
    });

    // Synchronize local report currency with global DealContext
    React.useEffect(() => {
        if (currency !== reportConfig.currency) {
            setReportConfig(prev => ({ ...prev, currency }));
        }
    }, [currency, reportConfig.currency]);

    return (
        <div>
            <DealContextBar />
            <div data-testid="converted-revenue">
                {convertAmount(10000000).toFixed(2)} {currency}
            </div>
            <ReportConfigurator
                config={reportConfig}
                onChange={setReportConfig}
                onPrint={vi.fn()}
                onExportJson={vi.fn()}
                onRefresh={vi.fn()}
                loading={false}
            />
            <ExecutivePdfReport
                company={mockCompany}
                currentUser={{ name: 'Lead M&A Partner' }}
                config={reportConfig}
                metrics={mockMetrics}
                trends={[]}
                breakdown={[]}
                reportHash="9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba"
                generatedAt="2026-03-30T12:00:00Z"
                ratesMetadata={ratesMetadata}
            />
        </div>
    );
};

describe('NBP Multi-Currency & FX Engine Full Integration Tests', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('synchronizes live NBP rates across DealContextBar, ReportConfigurator, and ExecutivePdfReport', async () => {
        apiClient.get.mockResolvedValueOnce({
            data: {
                source: 'NBP',
                table_no: '062/A/NBP/2026',
                effective_date: '2026-03-30',
                cached: false,
                rates: [
                    { currency: 'EUR', currency_name: 'euro', mid_rate: 4.3125, multiplier: 0.23188406 },
                    { currency: 'USD', currency_name: 'dolar amerykański', mid_rate: 3.9450, multiplier: 0.25348542 },
                    { currency: 'GBP', currency_name: 'funt szterling', mid_rate: 5.1250, multiplier: 0.19512195 },
                    { currency: 'CHF', currency_name: 'frank szwajcarski', mid_rate: 4.5820, multiplier: 0.21824531 },
                ],
                multipliers: {
                    PLN: 1.0,
                    EUR: 0.23188406,
                    USD: 0.25348542,
                    GBP: 0.19512195,
                    CHF: 0.21824531,
                },
            },
        });

        render(
            <DealProvider>
                <IntegratedDealSuite />
            </DealProvider>
        );

        // 1. Initial State: Offline fallback badge
        expect(screen.getByTestId('nbp-fallback-badge')).toBeInTheDocument();

        // 2. Trigger on-demand NBP synchronization
        const syncButton = screen.getByTestId('refresh-nbp-rates-button');
        await act(async () => {
            fireEvent.click(syncButton);
        });

        // 3. Verify NBP live badge in DealContextBar
        await waitFor(() => {
            expect(screen.getByTestId('nbp-rate-badge')).toBeInTheDocument();
        });
        expect(screen.getByText(/NBP 062\/A\/NBP\/2026/i)).toBeInTheDocument();
        expect(screen.getByText('(2026-03-30)')).toBeInTheDocument();

        // 4. Switch Currency to EUR via DealContextBar primary pill
        const eurPill = screen.getByRole('button', { name: 'EUR' });
        await act(async () => {
            fireEvent.click(eurPill);
        });

        // 5. Verify Active FX badge in bar
        expect(screen.getByTestId('active-fx-rate-badge')).toBeInTheDocument();
        expect(screen.getByText('1 EUR =')).toBeInTheDocument();
        expect(screen.getByText('4.3125 PLN')).toBeInTheDocument();

        // 6. Verify mathematical amount conversion
        expect(screen.getByTestId('converted-revenue').textContent).toContain('2318840.60 EUR');

        // 7. Verify ExecutivePdfReport Header FX Citation
        const headerFxBadge = screen.getByTestId('fx-citation-badge');
        expect(headerFxBadge.textContent).toContain('Tabela NBP: 062/A/NBP/2026');

        // 8. Verify Section 6 Legal Audit Citation (MSR 21 / art. 30 ust. 2 UoR)
        const legalCitation = screen.getByTestId('fx-audit-citation');
        expect(legalCitation.textContent).toContain('MSR 21');
        expect(legalCitation.textContent).toContain('art. 30 ust. 2 Ustawy o rachunkowości (UoR)');
        expect(legalCitation.textContent).toContain('Constant FX');
        expect(legalCitation.textContent).toContain('Tabeli A nr 062/A/NBP/2026');

        // 9. Verify Official Vector Footer Citation
        const footerCitation = screen.getByTestId('fx-footer-citation');
        expect(footerCitation.textContent).toContain('Przeliczenia walutowe zestawienia sporządzono w oparciu o oficjalną Tabelę A kursów średnich NBP nr 062/A/NBP/2026 z dnia 2026-03-30 (1 EUR = 4.3125 PLN).');
        expect(footerCitation.textContent).toContain('MSR 21 / CONSTANT FX');
    });

    it('handles non-primary currency elevation (CHF) from dropdown and updates audit trails', async () => {
        apiClient.get.mockResolvedValueOnce({
            data: {
                source: 'NBP',
                table_no: '062/A/NBP/2026',
                effective_date: '2026-03-30',
                rates: [
                    { currency: 'EUR', currency_name: 'euro', mid_rate: 4.3125, multiplier: 0.23188406 },
                    { currency: 'CHF', currency_name: 'frank szwajcarski', mid_rate: 4.5820, multiplier: 0.21824531 },
                ],
            },
        });

        render(
            <DealProvider>
                <IntegratedDealSuite />
            </DealProvider>
        );

        // Sync rates to populate otherCurrencies
        await act(async () => {
            fireEvent.click(screen.getByTestId('refresh-nbp-rates-button'));
        });

        await waitFor(() => {
            expect(screen.getByTestId('other-currencies-select')).toBeInTheDocument();
        });

        // Select CHF from dropdown
        const select = screen.getByTestId('other-currencies-select');
        await act(async () => {
            fireEvent.change(select, { target: { value: 'CHF' } });
        });

        // CHF becomes elevated active pill button
        const chfButton = screen.getByRole('button', { name: 'CHF' });
        expect(chfButton).toBeInTheDocument();

        // Active rate displayed
        expect(screen.getByTestId('active-fx-rate-badge').textContent).toContain('1 CHF =');
        expect(screen.getByTestId('active-fx-rate-badge').textContent).toContain('4.5820 PLN');

        // Footer citation mentions CHF
        const footerCitation = screen.getByTestId('fx-footer-citation');
        expect(footerCitation.textContent).toContain('1 CHF = 4.5820 PLN');
    });

    it('gracefully survives NBP 500 error and recovers on subsequent successful poll', async () => {
        // First request fails with HTTP 500
        apiClient.get.mockRejectedValueOnce(new Error('NBP API 500 Internal Server Error'));

        render(
            <DealProvider>
                <IntegratedDealSuite />
            </DealProvider>
        );

        await act(async () => {
            fireEvent.click(screen.getByTestId('refresh-nbp-rates-button'));
        });

        // Fallback badge remains active
        expect(screen.getByTestId('nbp-fallback-badge')).toBeInTheDocument();

        // Switch to EUR works with offline reference rate
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'EUR' }));
        });
        expect(screen.getByTestId('converted-revenue').textContent).toContain('2325000.00 EUR');

        // Subsequent poll succeeds
        apiClient.get.mockResolvedValueOnce({
            data: {
                source: 'NBP',
                table_no: '063/A/NBP/2026',
                effective_date: '2026-03-31',
                cached: false,
                rates: [
                    { currency: 'EUR', currency_name: 'euro', mid_rate: 4.2950, multiplier: 0.23282887 },
                ],
            },
        });

        await act(async () => {
            fireEvent.click(screen.getByTestId('refresh-nbp-rates-button'));
        });

        await waitFor(() => {
            expect(screen.getByTestId('nbp-rate-badge')).toBeInTheDocument();
        });
        expect(screen.getByText(/NBP 063\/A\/NBP\/2026/i)).toBeInTheDocument();
        expect(screen.getByTestId('converted-revenue').textContent).toContain('2328288.70 EUR');
    });

    it('verifies mathematical precision and consistency across currency switches', async () => {
        render(
            <DealProvider>
                <IntegratedDealSuite />
            </DealProvider>
        );

        // Base currency PLN -> 1:1
        expect(screen.getByTestId('converted-revenue').textContent).toBe('10000000.00 PLN');

        // EUR default (rate 0.2325)
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'EUR' }));
        });
        expect(screen.getByTestId('converted-revenue').textContent).toBe('2325000.00 EUR');

        // USD default (rate 0.2564)
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'USD' }));
        });
        expect(screen.getByTestId('converted-revenue').textContent).toBe('2564000.00 USD');

        // GBP default (rate 0.1961)
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'GBP' }));
        });
        expect(screen.getByTestId('converted-revenue').textContent).toBe('1961000.00 GBP');

        // Switch back to PLN
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'PLN' }));
        });
        expect(screen.getByTestId('converted-revenue').textContent).toBe('10000000.00 PLN');
    });
});
