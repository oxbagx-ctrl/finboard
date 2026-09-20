import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DashboardView } from '../../views/DashboardView';
import { DealProvider, useDeal } from '../../context/DealContext';
import { AuthContext } from '../../context/AuthContext';
import { NotificationProvider } from '../../context/NotificationContext';
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
    tax_id: 'PL5250011222',
};

const mockAvailableYears = [2024, 2025, 2026];

const mockMetrics = {
    pnl: {
        revenue: { amount: 2400000 },
        cogs: { amount: 1200000 },
        gross_profit: { amount: 1200000 },
        gross_margin_pct: 50.0,
        opex: { amount: 600000 },
        depreciation: { amount: 80000 },
        ebit: { amount: 520000 },
        operating_margin_pct: 21.67,
        ebitda: { amount: 600000 },
        ebitda_margin_pct: 25.0,
        tax: { amount: 98800 },
        net_profit: { amount: 421200 },
        net_margin_pct: 17.55,
    },
    liquidity: {
        current_ratio: 2.10,
        quick_ratio: 1.65,
        working_capital: { amount: 650000 },
    },
    solvency: {
        debt_to_assets: 0.32,
    },
    dynamics: {
        yoy: {
            revenue_growth_pct: 16.8,
            gross_profit_growth_pct: 14.2,
            ebitda_growth_pct: 18.5,
            ebit_growth_pct: 19.1,
            net_profit_growth_pct: 20.4,
            opex_growth_pct: 8.0,
            cogs_growth_pct: 19.5,
            depreciation_growth_pct: 5.0,
            tax_growth_pct: 15.0,
            current_ratio_diff: 0.25,
            quick_ratio_diff: 0.20,
        },
        mom: {
            revenue_growth_pct: 2.5,
            ebitda_growth_pct: 3.1,
        },
    },
    benchmarks: {
        current_ratio: {
            target: 1.40,
            current_value: 2.10,
            status: 'OPT',
            status_label: 'Optymalny',
        },
        quick_ratio: {
            target: 1.10,
            current_value: 1.65,
            status: 'OPT',
            status_label: 'Optymalny',
        },
        gross_margin: {
            target: 45.0,
            current_value: 50.0,
            status: 'OPT',
            status_label: 'Optymalny',
        },
        ebitda_margin: {
            target: 20.0,
            current_value: 25.0,
            status: 'OPT',
            status_label: 'Optymalny',
        },
        operating_margin: {
            target: 15.0,
            current_value: 21.67,
            status: 'OPT',
            status_label: 'Optymalny',
        },
        net_margin: {
            target: 12.0,
            current_value: 17.55,
            status: 'OPT',
            status_label: 'Optymalny',
        },
        debt_to_assets: {
            target: 0.45,
            current_value: 0.32,
            status: 'OPT',
            status_label: 'Optymalny',
        },
    },
};

const mockTrends = [
    {
        month: '2026-01',
        label: 'STY 2026',
        revenue: 190000,
        opex: 48000,
        ebitda: 48000,
        net_profit: 34000,
    },
    {
        month: '2026-02',
        label: 'LUT 2026',
        revenue: 210000,
        opex: 52000,
        ebitda: 54000,
        net_profit: 38000,
    },
];

const mockExpenseBreakdown = [
    {
        category_id: 'cat-sal-1',
        category_code: 'OPEX-HR',
        category_name: 'Wynagrodzenia zespołu inżynierskiego',
        amount: 350000,
        percentage: 58.33,
    },
    {
        category_id: 'cat-it-1',
        category_code: 'OPEX-CLOUD',
        category_name: 'Usługi Cloud & DevOps AWS',
        amount: 120000,
        percentage: 20.0,
    },
];

const mockRevenueBreakdown = [
    {
        category_id: 'rev-lic-1',
        category_code: 'REV-LIC',
        category_name: 'Licencje Enterprise SaaS',
        amount: 1800000,
        percentage: 75.0,
    },
    {
        category_id: 'rev-svc-1',
        category_code: 'REV-IMPL',
        category_name: 'Wdrożenia i integracje API',
        amount: 600000,
        percentage: 25.0,
    },
];

const mockLiquidityTrends = [
    {
        month: '2026-01',
        label: 'STY 2026',
        current_ratio: 2.05,
        quick_ratio: 1.60,
    },
    {
        month: '2026-02',
        label: 'LUT 2026',
        current_ratio: 2.10,
        quick_ratio: 1.65,
    },
];

const mockAuditLogs = [
    {
        id: 'audit-e2e-1',
        company_id: 'comp-acme-1',
        created_at: '2026-03-20T08:00:00Z',
        action: 'BENCHMARK_CONFIGURED',
        action_label: 'Konfiguracja celu finansowego',
        action_color: 'sky',
        action_category: 'BENCHMARKS',
        entity_type: 'financial_benchmark',
        entity_id: 'bench-cr-1',
        description: 'Zaktualizowano próg wskaźnika Current Ratio do 1.40x',
        user: { name: 'Adam Doradca', email: 'advisor@helvest.com' },
    },
];

// Helper controller component to allow programmatic currency and year switches in test
const TestWorkspaceWrapper = ({ children }) => {
    const { currency, setCurrency, setDateRange } = useDeal();

    return (
        <div>
            <div data-testid="test-controls" className="hidden">
                <button data-testid="set-eur" onClick={() => setCurrency('EUR')}>EUR</button>
                <button data-testid="set-usd" onClick={() => setCurrency('USD')}>USD</button>
                <button
                    data-testid="set-q1"
                    onClick={() => setDateRange({
                        startDate: '2026-01-01',
                        endDate: '2026-03-31',
                        label: 'Q1 2026',
                    })}
                >
                    Set Q1
                </button>
            </div>
            {children}
        </div>
    );
};

const renderE2EDashboard = (role = 'advisor') => {
    return render(
        <NotificationProvider>
            <AuthContext.Provider
                value={{
                    user: { id: 'u-e2e', name: 'Adam Doradca', role },
                    activeCompany: mockCompany,
                    isAdmin: role === 'admin',
                    isSuperAdmin: false,
                    isAdvisor: role === 'advisor',
                    isClient: role === 'client',
                }}
            >
                <DealProvider>
                    <TestWorkspaceWrapper>
                        <DashboardView />
                    </TestWorkspaceWrapper>
                </DealProvider>
            </AuthContext.Provider>
        </NotificationProvider>
    );
};

describe('E2E DashboardView Integration: Analytics, FX, P&L Hierarchy & Reactive Events', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        apiClient.get.mockImplementation((url, config) => {
            if (url === '/finance/analytics/years') {
                return Promise.resolve({ data: { data: mockAvailableYears } });
            }
            if (url === '/finance/analytics/metrics') {
                return Promise.resolve({ data: { data: mockMetrics } });
            }
            if (url === '/finance/analytics/trends') {
                return Promise.resolve({ data: { data: mockTrends } });
            }
            if (url === '/finance/analytics/breakdown') {
                const type = config?.params?.record_type;
                if (type === 'REVENUE') {
                    return Promise.resolve({ data: { data: mockRevenueBreakdown } });
                }
                return Promise.resolve({ data: { data: mockExpenseBreakdown } });
            }
            if (url === '/finance/analytics/liquidity') {
                return Promise.resolve({ data: { data: mockLiquidityTrends } });
            }
            if (url === '/finance/audit-logs') {
                return Promise.resolve({ data: { data: mockAuditLogs } });
            }
            return Promise.resolve({ data: { data: [] } });
        });
    });

    it('orchestrates complete dashboard lifecycle with live API metrics and benchmark strip', async () => {
        renderE2EDashboard('advisor');

        // 1. Verify API calls dispatched
        await waitFor(() => {
            expect(apiClient.get).toHaveBeenCalledWith('/finance/analytics/metrics', expect.any(Object));
            expect(apiClient.get).toHaveBeenCalledWith('/finance/analytics/trends', expect.any(Object));
            expect(apiClient.get).toHaveBeenCalledWith('/finance/analytics/liquidity', expect.any(Object));
            expect(apiClient.get).toHaveBeenCalledWith('/finance/audit-logs', expect.any(Object));
        });

        // 2. Header and metadata verification
        expect(screen.getByText('Acme Manufacturing S.A.')).toBeInTheDocument();
        expect(screen.getByText('NIP: PL5250011222')).toBeInTheDocument();
        expect(screen.getAllByText(/WALUTA: PLN/i).length).toBeGreaterThanOrEqual(1);

        // 3. KPI Cards and YoY Badges
        expect(screen.getByText(/DYNAMIKA R\/R \(\+16.8%\)/i)).toBeInTheDocument();
        expect(screen.getByText('Wynik EBITDA')).toBeInTheDocument();
        expect(screen.getByText(/MARŻA: 25.0%/i)).toBeInTheDocument();
        expect(screen.getByText('Zysk Operacyjny (EBIT)')).toBeInTheDocument();
        expect(screen.getByText(/MARŻA: 21.7%/i)).toBeInTheDocument();
        expect(screen.getByText('Wskaźnik Płynności Bieżącej')).toBeInTheDocument();
        expect(screen.getByText('2.10x')).toBeInTheDocument();
        expect(screen.getByText('CEL DORADCY: >1.4x')).toBeInTheDocument();

        // 4. Multiples Strip
        expect(screen.getByText('BENCHMARKI DORADCY & STATUSY KPI')).toBeInTheDocument();
        expect(screen.getByText('Cel: >1.4x')).toBeInTheDocument();
        expect(screen.getByText('Cel: >20%')).toBeInTheDocument();

        // 5. Audit Feed Snippet
        expect(screen.getByText('Konfiguracja celu finansowego')).toBeInTheDocument();
        expect(screen.getByText('Zaktualizowano próg wskaźnika Current Ratio do 1.40x')).toBeInTheDocument();
    });

    it('dynamically adapts to currency switching and recalculates values across dashboard', async () => {
        renderE2EDashboard('advisor');

        await waitFor(() => {
            expect(screen.getAllByText(/WALUTA: PLN/i).length).toBeGreaterThanOrEqual(1);
        });

        // Switch to EUR via test controller
        const eurButton = screen.getByTestId('set-eur');
        fireEvent.click(eurButton);

        await waitFor(() => {
            expect(screen.getAllByText(/WALUTA: EUR/i).length).toBeGreaterThanOrEqual(1);
        });

        // Switch to USD
        const usdButton = screen.getByTestId('set-usd');
        fireEvent.click(usdButton);

        await waitFor(() => {
            expect(screen.getAllByText(/WALUTA: USD/i).length).toBeGreaterThanOrEqual(1);
        });
    });

    it('handles interactive chart view toggle between P&L trends and liquidity', async () => {
        renderE2EDashboard('advisor');

        await waitFor(() => {
            expect(screen.getByText('TREND P&L')).toBeInTheDocument();
            expect(screen.getByText('PŁYNNOŚĆ CR/QR')).toBeInTheDocument();
        });

        // Default is P&L
        expect(screen.getByText(/DYNAMIKA WYNIKOWA P&L/i)).toBeInTheDocument();

        // Toggle to Liquidity
        fireEvent.click(screen.getByText('PŁYNNOŚĆ CR/QR'));
        expect(screen.getByText(/EWOLUCJA WSKAŹNIKÓW PŁYNNOŚCI/i)).toBeInTheDocument();

        // Toggle back to P&L
        fireEvent.click(screen.getByText('TREND P&L'));
        expect(screen.getByText(/DYNAMIKA WYNIKOWA P&L/i)).toBeInTheDocument();
    });

    it('renders hierarchical P&L table rows with multi-category breakdown and toggle collapse/expand', async () => {
        renderE2EDashboard('advisor');

        await waitFor(() => {
            expect(screen.getByText('Rachunek Zysków i Strat (P&L Konsolidowany)')).toBeInTheDocument();
        });

        // 1. Verify accounting standards footer
        expect(screen.getByText(/POLSKIE STANDARDY RACHUNKOWOŚCI \(PSR\) \/ MSR 1/i)).toBeInTheDocument();
        expect(screen.getByText(/KALKULATOR DOMENOWY BCMATH \(SCALE 4\)/i)).toBeInTheDocument();

        // 2. Verify Final Result Net Profit row
        expect(screen.getByText(/9\. ZYSK NETTO OKRESU/i)).toBeInTheDocument();
        expect(screen.getByText('WYNIK KOŃCOWY')).toBeInTheDocument();

        // 3. Child items are expanded by default
        await waitFor(() => {
            expect(screen.getByText('Licencje Enterprise SaaS')).toBeInTheDocument();
            expect(screen.getByText('Wdrożenia i integracje API')).toBeInTheDocument();
            expect(screen.getAllByText('Wynagrodzenia zespołu inżynierskiego').length).toBeGreaterThanOrEqual(1);
            expect(screen.getAllByText('Usługi Cloud & DevOps AWS').length).toBeGreaterThanOrEqual(1);
        });

        // 4. Click Revenue group to collapse
        const revenueGroup = screen.getByText(/1\. Przychody ze Sprzedaży/i);
        fireEvent.click(revenueGroup);

        await waitFor(() => {
            expect(screen.queryByText('Licencje Enterprise SaaS')).not.toBeInTheDocument();
        });

        // 5. Click Revenue group to re-expand
        fireEvent.click(revenueGroup);

        await waitFor(() => {
            expect(screen.getByText('Licencje Enterprise SaaS')).toBeInTheDocument();
        });
    });

    it('reacts to window event finboard:benchmarks-updated by refetching analytics', async () => {
        renderE2EDashboard('advisor');

        await waitFor(() => {
            expect(apiClient.get).toHaveBeenCalledWith('/finance/analytics/metrics', expect.any(Object));
        });

        const initialCallCount = apiClient.get.mock.calls.length;

        // Fire custom window event dispatched when benchmarks are modified in modal
        window.dispatchEvent(new CustomEvent('finboard:benchmarks-updated'));

        await waitFor(() => {
            expect(apiClient.get.mock.calls.length).toBeGreaterThan(initialCallCount);
        });
    });
});
