import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { AnalyticsView } from '../../views/AnalyticsView';
import { NotificationProvider } from '../../context/NotificationContext';
import { AuthContext } from '../../context/AuthContext';
import { DealProvider } from '../../context/DealContext';
import apiClient from '../../api/client';

// Mock apiClient
vi.mock('../../api/client', () => ({
    default: {
        get: vi.fn(),
        put: vi.fn(),
        patch: vi.fn(),
        post: vi.fn(),
        delete: vi.fn(),
    },
}));

// Mock Recharts responsive container
vi.mock('recharts', async () => {
    const original = await vi.importActual('recharts');
    return {
        ...original,
        ResponsiveContainer: ({ children }) => <div className="responsive-container">{children}</div>,
    };
});

const mockCompany = {
    id: 'comp-acme-1',
    name: 'Acme Manufacturing S.A.',
    code: 'ACME',
    tax_id: '525-00-11-222',
};

const mockMetrics = {
    pnl: {
        revenue: { amount: 1500000 },
        cogs: { amount: 825000 },
        gross_profit: { amount: 675000 },
        opex: { amount: 375000 },
        ebitda: { amount: 300000 },
        ebit: { amount: 240000 },
        net_profit: { amount: 180000 },
        gross_margin: 0.45,
        ebitda_margin: 0.20,
        operating_margin: 0.16,
        net_margin: 0.12,
    },
    liquidity: {
        current_ratio: 1.85,
        quick_ratio: 1.42,
        working_capital: { amount: 450000 },
    },
};

const mockTrends = [
    {
        month: '2026-01',
        label: 'STY 2026',
        revenue: 120000,
        opex: 30000,
        ebitda: 25000,
        net_profit: 15000,
    },
    {
        month: '2026-02',
        label: 'LUT 2026',
        revenue: 135000,
        opex: 32000,
        ebitda: 28000,
        net_profit: 18000,
    },
];

const mockExpenses = [
    {
        category_id: 'cat-1',
        category_code: 'OPEX-SAL',
        category_name: 'Wynagrodzenia i świadczenia',
        amount: 200000,
        percentage: 53.3,
    },
    {
        category_id: 'cat-2',
        category_code: 'OPEX-IT',
        category_name: 'Infrastruktura IT i chmura',
        amount: 80000,
        percentage: 21.3,
    },
];

const mockRevenues = [
    {
        category_id: 'cat-rev-1',
        category_code: 'REV-PROD',
        category_name: 'Sprzedaż maszyn produkcyjnych',
        amount: 1100000,
        percentage: 73.3,
    },
    {
        category_id: 'cat-rev-2',
        category_code: 'REV-SERV',
        category_name: 'Usługi serwisowe SLA',
        amount: 400000,
        percentage: 26.7,
    },
];

const mockLiquidityTrends = [
    {
        month: '2026-01',
        label: 'STY 2026',
        current_ratio: 1.82,
        quick_ratio: 1.40,
    },
    {
        month: '2026-02',
        label: 'LUT 2026',
        current_ratio: 1.85,
        quick_ratio: 1.42,
    },
];

const renderWithProviders = (ui) => {
    return render(
        <NotificationProvider>
            <AuthContext.Provider
                value={{
                    user: { id: 'u1', name: 'Jan Kowalski', role: 'client' },
                    activeCompany: mockCompany,
                    isAdmin: false,
                    isSuperAdmin: false,
                    isAdvisor: false,
                    isClient: true,
                }}
            >
                <DealProvider>
                    {ui}
                </DealProvider>
            </AuthContext.Provider>
        </NotificationProvider>
    );
};

describe('AnalyticsView Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        apiClient.get.mockImplementation((url, config) => {
            if (url === '/finance/analytics/metrics') {
                return Promise.resolve({ data: { data: mockMetrics } });
            }
            if (url === '/finance/analytics/trends') {
                return Promise.resolve({ data: { data: mockTrends } });
            }
            if (url === '/finance/analytics/breakdown') {
                const type = config?.params?.record_type;
                if (type === 'REVENUE') {
                    return Promise.resolve({ data: { data: mockRevenues } });
                }
                return Promise.resolve({ data: { data: mockExpenses } });
            }
            if (url === '/finance/analytics/liquidity') {
                return Promise.resolve({ data: { data: mockLiquidityTrends } });
            }
            return Promise.resolve({ data: { data: [] } });
        });
    });

    it('fetches analytics endpoints on mount and renders Overview tab', async () => {
        renderWithProviders(<AnalyticsView />);

        await waitFor(() => {
            expect(apiClient.get).toHaveBeenCalledWith('/finance/analytics/metrics', expect.any(Object));
            expect(apiClient.get).toHaveBeenCalledWith('/finance/analytics/trends', expect.any(Object));
            expect(apiClient.get).toHaveBeenCalledWith('/finance/analytics/liquidity', expect.any(Object));
        });

        // Check header & company info
        expect(screen.getByText('Acme Manufacturing S.A.')).toBeInTheDocument();
        expect(screen.getByText(/ANALIZA FINANSOWA & TRENDY/i)).toBeInTheDocument();

        // Check KPI cards on overview tab
        expect(screen.getByText('Przychody ze Sprzedaży')).toBeInTheDocument();
        expect(screen.getByText('Wynik EBITDA')).toBeInTheDocument();
        expect(screen.getByText('Zysk Operacyjny (EBIT)')).toBeInTheDocument();
        expect(screen.getByText('Zysk Netto (EAT)')).toBeInTheDocument();

        // Check titles of charts
        expect(screen.getByText(/Wielowymiarowy Trend Wynikowy P&L/i)).toBeInTheDocument();
        expect(screen.getByText(/Struktura Kosztów Operacyjnych/i)).toBeInTheDocument();
    });

    it('switches to Rentowność i Marże tab and renders margin metrics and chronological table', async () => {
        renderWithProviders(<AnalyticsView />);

        await waitFor(() => {
            expect(screen.getByText('Rentowność i Marże')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('Rentowność i Marże'));

        // Check Rentowność KPI cards
        expect(screen.getByText('Marża Brutto ze Sprzedaży')).toBeInTheDocument();
        expect(screen.getByText('Marża Operacyjna EBITDA')).toBeInTheDocument();
        expect(screen.getByText('Marża Operacyjna EBIT')).toBeInTheDocument();
        expect(screen.getByText('Marża Zysku Netto')).toBeInTheDocument();

        // Check chronological table headers
        expect(screen.getByText('Okres (Miesiąc)')).toBeInTheDocument();
        expect(screen.getByText('STY 2026')).toBeInTheDocument();
        expect(screen.getByText('LUT 2026')).toBeInTheDocument();
    });

    it('switches to Płynność i Wskaźniki tab and displays CR, QR, NWC and Commentary', async () => {
        renderWithProviders(<AnalyticsView />);

        await waitFor(() => {
            expect(screen.getByText('Płynność i Wskaźniki')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('Płynność i Wskaźniki'));

        expect(screen.getByText('Current Ratio (Wskaźnik Bieżący)')).toBeInTheDocument();
        expect(screen.getAllByText('1.85x').length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText('Quick Ratio (Wskaźnik Szybki)')).toBeInTheDocument();
        expect(screen.getAllByText('1.42x').length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText('Kapitał Obrotowy Netto (NWC)')).toBeInTheDocument();
        expect(screen.getByText('Komentarz Analityka M&A')).toBeInTheDocument();
        expect(screen.getByText('STABILNY / LOW RISK')).toBeInTheDocument();
    });

    it('switches to Dekompozycja Przychodów / Kosztów and toggles between OPEX and REV', async () => {
        renderWithProviders(<AnalyticsView />);

        await waitFor(() => {
            expect(screen.getByText(/Dekompozycja Przychodów \/ Kosztów/i)).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText(/Dekompozycja Przychodów \/ Kosztów/i));

        // Default OPEX
        await waitFor(() => {
            expect(screen.getAllByText('Wynagrodzenia i świadczenia').length).toBeGreaterThanOrEqual(1);
            expect(screen.getAllByText('OPEX-SAL').length).toBeGreaterThanOrEqual(1);
            expect(screen.getAllByText('53.3%').length).toBeGreaterThanOrEqual(1);
        });

        // Switch to REVENUE
        const revBtn = screen.getByRole('button', { name: /Przychody ze Sprzedaży \(REV\)/i });
        fireEvent.click(revBtn);

        await waitFor(() => {
            expect(screen.getAllByText('Sprzedaż maszyn produkcyjnych').length).toBeGreaterThanOrEqual(1);
            expect(screen.getAllByText('REV-PROD').length).toBeGreaterThanOrEqual(1);
            expect(screen.getAllByText('73.3%').length).toBeGreaterThanOrEqual(1);
        });
    });

    it('re-fetches analytics data when clicking Odśwież button', async () => {
        renderWithProviders(<AnalyticsView />);

        await waitFor(() => {
            expect(apiClient.get).toHaveBeenCalledTimes(5);
            expect(screen.getByRole('button', { name: /Odśwież/i })).not.toBeDisabled();
        });

        const refreshBtn = screen.getByRole('button', { name: /Odśwież/i });
        fireEvent.click(refreshBtn);

        await waitFor(() => {
            expect(apiClient.get).toHaveBeenCalledTimes(10);
        });
    });

    it('renders accessible Tooltips and InfoTooltips across Analityka P&L, Marże i Wskaźniki Płynności view (Phase 56 Commit 274)', async () => {
        renderWithProviders(<AnalyticsView />);

        await waitFor(() => {
            expect(apiClient.get).toHaveBeenCalledWith('/finance/analytics/metrics', expect.any(Object));
        });

        // 1. Overview tab: Check InfoTooltips on MetricCards and Chart Headers
        expect(screen.getByRole('button', { name: /Informacje o: Przychody ze Sprzedaży/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Informacje o: Wynik EBITDA/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Informacje o: Zysk Operacyjny \(EBIT\)/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Informacje o: Zysk Netto \(EAT\)/i })).toBeInTheDocument();

        // Chart header InfoTooltip
        expect(screen.getByRole('button', { name: /Informacje o wykresie trendu wynikowego P&L/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Informacje o strukturze kosztów operacyjnych/i })).toBeInTheDocument();

        // 2. Switch to Rentowność i Marże tab
        fireEvent.click(screen.getByText('Rentowność i Marże'));
        expect(screen.getByText('Marża Brutto ze Sprzedaży')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Więcej o marży brutto ze sprzedaży/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Więcej o marży operacyjnej EBITDA/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Więcej o marży operacyjnej EBIT$/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Więcej o marży zysku netto/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Więcej o dzienniku rentowności M&A/i })).toBeInTheDocument();

        // 3. Switch to Płynność i Wskaźniki tab
        act(() => {
            fireEvent.click(screen.getByText('Płynność i Wskaźniki'));
        });
        await waitFor(() => {
            expect(screen.getByRole('button', { name: /Definicja wskaźnika Current Ratio/i })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /Definicja wskaźnika Quick Ratio/i })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /Definicja kapitału obrotowego netto/i })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /Więcej o wykresie ewolucji płynności/i })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /Więcej o ocenie solwencji i zadłużenia/i })).toBeInTheDocument();
        });

        // 4. Switch to Dekompozycja Przychodów / Kosztów tab
        act(() => {
            fireEvent.click(screen.getByText(/Dekompozycja Przychodów \/ Kosztów/i));
        });
        await waitFor(() => {
            expect(screen.getByRole('button', { name: /Więcej o wykresie udziału procentowego/i })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /Więcej o tabeli pozycji analitycznych/i })).toBeInTheDocument();
        });

        // 5. Switch to Cele i Benchmarki (M&A) tab
        act(() => {
            fireEvent.click(screen.getByText(/Cele i Benchmarki \(M&A\)/i));
        });
        await waitFor(() => {
            expect(screen.getByRole('button', { name: /Więcej o Health Score/i })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /Więcej o spełnionych celach/i })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /Więcej o progach ostrzegawczych/i })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /Więcej o przekroczeniach krytycznych/i })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /Więcej o macierzy celów M&A/i })).toBeInTheDocument();
        });
    });
});
