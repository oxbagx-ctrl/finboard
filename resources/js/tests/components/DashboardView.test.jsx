import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DashboardView } from '../../views/DashboardView';
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
        revenue: { amount: 2000000 },
        cogs: { amount: 1100000 },
        gross_profit: { amount: 900000 },
        gross_margin_pct: 45.0,
        opex: { amount: 500000 },
        depreciation: { amount: 60000 },
        ebit: { amount: 340000 },
        operating_margin_pct: 17.0,
        ebitda: { amount: 400000 },
        ebitda_margin_pct: 20.0,
        tax: { amount: 64600 },
        net_profit: { amount: 275400 },
        net_margin_pct: 13.77,
    },
    liquidity: {
        current_ratio: 1.95,
        quick_ratio: 1.48,
        working_capital: { amount: 480000 },
    },
    solvency: {
        debt_to_assets: 0.35,
    },
    dynamics: {
        yoy: {
            revenue_growth_pct: 14.5,
            gross_profit_growth_pct: 12.0,
            ebitda_growth_pct: 9.8,
            ebit_growth_pct: 8.5,
            net_profit_growth_pct: 15.2,
            opex_growth_pct: 7.3,
            current_ratio_diff: 0.15,
        },
        mom: {
            revenue_growth_pct: 2.1,
            ebitda_growth_pct: 1.4,
        },
    },
    benchmarks: {
        current_ratio: {
            target: 1.30,
            current_value: 1.95,
            status: 'OPT',
            status_label: 'Optymalny',
        },
        quick_ratio: {
            target: 1.05,
            current_value: 1.48,
            status: 'OPT',
            status_label: 'Optymalny',
        },
        gross_margin: {
            target: 40.0,
            current_value: 45.0,
            status: 'OPT',
            status_label: 'Optymalny',
        },
        ebitda_margin: {
            target: 18.0,
            current_value: 20.0,
            status: 'OPT',
            status_label: 'Optymalny',
        },
        operating_margin: {
            target: 12.0,
            current_value: 17.0,
            status: 'OPT',
            status_label: 'Optymalny',
        },
        net_margin: {
            target: 10.0,
            current_value: 13.77,
            status: 'OPT',
            status_label: 'Optymalny',
        },
        debt_to_assets: {
            target: 0.50,
            current_value: 0.35,
            status: 'OPT',
            status_label: 'Optymalny',
        },
    },
};

const mockTrends = [
    {
        month: '2026-01',
        label: 'STY 2026',
        revenue: 160000,
        opex: 40000,
        ebitda: 32000,
        net_profit: 22000,
    },
    {
        month: '2026-02',
        label: 'LUT 2026',
        revenue: 175000,
        opex: 42000,
        ebitda: 36000,
        net_profit: 25000,
    },
];

const mockExpenseBreakdown = [
    {
        category_id: 'cat-sal',
        category_code: 'OPEX-HR',
        category_name: 'Wynagrodzenia i świadczenia',
        amount: 270000,
        percentage: 54.0,
    },
    {
        category_id: 'cat-it',
        category_code: 'OPEX-IT',
        category_name: 'Infrastruktura IT i SaaS',
        amount: 80000,
        percentage: 16.0,
    },
];

const mockRevenueBreakdown = [
    {
        category_id: 'rev-prod',
        category_code: 'REV-01',
        category_name: 'Sprzedaż maszyn i urządzeń',
        amount: 1440000,
        percentage: 72.0,
    },
    {
        category_id: 'rev-serv',
        category_code: 'REV-02',
        category_name: 'Usługi serwisowe SLA',
        amount: 560000,
        percentage: 28.0,
    },
];

const mockLiquidityTrends = [
    {
        month: '2026-01',
        label: 'STY 2026',
        current_ratio: 1.90,
        quick_ratio: 1.45,
    },
    {
        month: '2026-02',
        label: 'LUT 2026',
        current_ratio: 1.95,
        quick_ratio: 1.48,
    },
];

const mockAuditLogs = [
    {
        id: 'log-1',
        company_id: 'comp-acme-1',
        created_at: '2026-03-15T10:30:00Z',
        action: 'BENCHMARK_CONFIGURED',
        action_label: 'Konfiguracja celu finansowego',
        action_color: 'sky',
        action_category: 'BENCHMARKS',
        entity_type: 'financial_benchmark',
        entity_id: 'bench-12345678',
        description: 'Zaktualizowano próg wskaźnika EBITDA Margin',
        user: { name: 'Adam Doradca', email: 'advisor@helvest.com' },
    },
    {
        id: 'log-2',
        company_id: 'comp-acme-1',
        created_at: '2026-03-15T09:15:00Z',
        action: 'RECORD_CREATED',
        action_label: 'Utworzenie rekordu finansowego',
        action_color: 'emerald',
        action_category: 'RECORDS',
        entity_type: 'financial_record',
        entity_id: 'rec-87654321',
        description: 'Dodano zapis księgowy przychodów SLA',
        user: { name: 'Jan CFO', email: 'client@acme.com' },
    },
];

const renderWithProviders = (ui) => {
    return render(
        <NotificationProvider>
            <AuthContext.Provider
                value={{
                    user: { id: 'u1', name: 'Jan CFO', role: 'client' },
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

describe('DashboardView Component', () => {
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

    it('fetches backend API data on mount and displays company details', async () => {
        renderWithProviders(<DashboardView />);

        await waitFor(() => {
            expect(apiClient.get).toHaveBeenCalledWith('/finance/analytics/metrics', expect.any(Object));
            expect(apiClient.get).toHaveBeenCalledWith('/finance/analytics/trends', expect.any(Object));
            expect(apiClient.get).toHaveBeenCalledWith('/finance/analytics/liquidity', expect.any(Object));
            expect(apiClient.get).toHaveBeenCalledWith('/finance/audit-logs', expect.any(Object));
        });

        expect(screen.getByText('Acme Manufacturing S.A.')).toBeInTheDocument();
        expect(screen.getByText('NIP: 525-00-11-222')).toBeInTheDocument();
        expect(screen.getByText(/ENGINE: CQRS \/ DDD/i)).toBeInTheDocument();
    });

    it('renders dynamic KPI cards with live YoY dynamics from backend', async () => {
        renderWithProviders(<DashboardView />);

        await waitFor(() => {
            expect(screen.getByText(/DYNAMIKA R\/R \(\+14.5%\)/i)).toBeInTheDocument();
        });

        // Revenue dynamic YoY growth badge and subtitle
        expect(screen.getAllByText('+14.5%').length).toBeGreaterThanOrEqual(1);

        // EBITDA Card
        expect(screen.getByText('Wynik EBITDA')).toBeInTheDocument();
        expect(screen.getAllByText('+9.8%').length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText(/MARŻA: 20.0%/i)).toBeInTheDocument();

        // EBIT Card
        expect(screen.getByText('Zysk Operacyjny (EBIT)')).toBeInTheDocument();
        expect(screen.getAllByText('+8.5%').length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText(/MARŻA: 17.0%/i)).toBeInTheDocument();

        // Current Ratio Card
        expect(screen.getByText('Wskaźnik Płynności Bieżącej')).toBeInTheDocument();
        expect(screen.getAllByText('1.95x').length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText(/CEL DORADCY: >1.3x/i)).toBeInTheDocument();
    });

    it('renders FinancialMultiplesStrip with live benchmark targets and OPT chips', async () => {
        renderWithProviders(<DashboardView />);

        await waitFor(() => {
            expect(screen.getByText('BENCHMARKI DORADCY & STATUSY KPI')).toBeInTheDocument();
        });

        expect(screen.getByText(/WSKAŹNIKI PŁYNNOŚCI I RENTOWNOŚCI/i)).toBeInTheDocument();
        expect(screen.getByText('CURRENT RATIO')).toBeInTheDocument();
        expect(screen.getByText('Cel: >1.3x')).toBeInTheDocument();
        expect(screen.getByText('QUICK RATIO')).toBeInTheDocument();
        expect(screen.getByText('Cel: >1.05x')).toBeInTheDocument();
        expect(screen.getByText('MARŻA EBITDA')).toBeInTheDocument();
        expect(screen.getByText('Cel: >18%')).toBeInTheDocument();
    });

    it('toggles chart view between P&L trends and liquidity', async () => {
        renderWithProviders(<DashboardView />);

        await waitFor(() => {
            expect(screen.getByText('TREND P&L')).toBeInTheDocument();
            expect(screen.getByText('PŁYNNOŚĆ CR/QR')).toBeInTheDocument();
        });

        expect(screen.getByText(/DYNAMIKA WYNIKOWA P&L/i)).toBeInTheDocument();

        fireEvent.click(screen.getByText('PŁYNNOŚĆ CR/QR'));
        expect(screen.getByText(/EWOLUCJA WSKAŹNIKÓW PŁYNNOŚCI/i)).toBeInTheDocument();

        fireEvent.click(screen.getByText('TREND P&L'));
        expect(screen.getByText(/DYNAMIKA WYNIKOWA P&L/i)).toBeInTheDocument();
    });

    it('renders live audit trail snippet with actual records from backend', async () => {
        renderWithProviders(<DashboardView />);

        await waitFor(() => {
            expect(screen.getByText(/Live Audit Feed/i)).toBeInTheDocument();
        });

        expect(screen.getByText('Konfiguracja celu finansowego')).toBeInTheDocument();
        expect(screen.getByText('Adam Doradca')).toBeInTheDocument();
        expect(screen.getByText('Zaktualizowano próg wskaźnika EBITDA Margin')).toBeInTheDocument();

        expect(screen.getByText('Utworzenie rekordu finansowego')).toBeInTheDocument();
        expect(screen.getByText('Jan CFO')).toBeInTheDocument();
        expect(screen.getByText('Dodano zapis księgowy przychodów SLA')).toBeInTheDocument();
    });

    it('renders standardized P&L financial table with full PSR/MSR hierarchy and deduction markers', async () => {
        renderWithProviders(<DashboardView />);

        await waitFor(() => {
            expect(screen.getByText('Rachunek Zysków i Strat (P&L Konsolidowany)')).toBeInTheDocument();
        });

        // 1. Check all 9 standardized hierarchy rows
        expect(screen.getByText(/1\. Przychody ze Sprzedaży/i)).toBeInTheDocument();
        expect(screen.getByText(/2\. Koszt Wytworzenia Sprzedanych Produktów \(COGS\)/i)).toBeInTheDocument();
        expect(screen.getByText(/3\. ZYSK BRUTTO ZE SPRZEDAŻY/i)).toBeInTheDocument();
        expect(screen.getByText(/4\. Koszty Działalności Operacyjnej \(OPEX\)/i)).toBeInTheDocument();
        expect(screen.getByText(/5\. WYNIK OPERACYJNY EBITDA/i)).toBeInTheDocument();
        expect(screen.getByText(/6\. Amortyzacja Rzeczowa i Niematerialna \(D&A\)/i)).toBeInTheDocument();
        expect(screen.getByText(/7\. ZYSK OPERACYJNY \(EBIT\)/i)).toBeInTheDocument();
        expect(screen.getByText(/8\. Podatek Dochodowy od Osób Prawnych \(CIT\)/i)).toBeInTheDocument();
        expect(screen.getByText(/9\. ZYSK NETTO OKRESU/i)).toBeInTheDocument();

        // 2. Check deduction indicators (-) for direct operating deductions
        const deductionMarkers = screen.getAllByText('(-)');
        expect(deductionMarkers.length).toBeGreaterThanOrEqual(3); // COGS, D&A, CIT

        // 3. Check final net profit result badge
        expect(screen.getByText('WYNIK KOŃCOWY')).toBeInTheDocument();

        // 4. Check expandable groups with category counters
        const categoryBadges = screen.getAllByText('2 kat.');
        expect(categoryBadges.length).toBeGreaterThanOrEqual(1);

        // 5. Expand OPEX group and verify child items with tree branches
        const opexRow = screen.getByText(/4\. Koszty Działalności Operacyjnej \(OPEX\)/i);
        fireEvent.click(opexRow);

        await waitFor(() => {
            expect(screen.getByText('Wynagrodzenia i świadczenia')).toBeInTheDocument();
            expect(screen.getByText('Infrastruktura IT i SaaS')).toBeInTheDocument();
        });
    });
});
