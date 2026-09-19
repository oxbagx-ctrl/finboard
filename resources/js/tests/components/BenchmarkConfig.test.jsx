import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BenchmarkConfigModal, evaluateStatusChip } from '../../components/benchmarks/BenchmarkConfigModal';
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

// Mock Recharts
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

const mockBenchmarksList = [
    {
        id: 'bench-1',
        metric_type: 'CURRENT_RATIO',
        metric_key: 'current_ratio',
        label: 'Wskaźnik Płynności Bieżącej (Current Ratio)',
        unit: 'x',
        higher_is_better: true,
        target_value: 1.30,
        warning_threshold: 1.10,
        critical_threshold: 0.90,
        is_custom: true,
    },
    {
        id: 'bench-2',
        metric_type: 'QUICK_RATIO',
        metric_key: 'quick_ratio',
        label: 'Wskaźnik Płynności Szybkiej (Quick Ratio)',
        unit: 'x',
        higher_is_better: true,
        target_value: 1.05,
        warning_threshold: 0.85,
        critical_threshold: 0.70,
        is_custom: false,
    },
    {
        id: 'bench-3',
        metric_type: 'GROSS_MARGIN',
        metric_key: 'gross_margin',
        label: 'Marża Brutto ze Sprzedaży (Gross Margin)',
        unit: '%',
        higher_is_better: true,
        target_value: 40.0,
        warning_threshold: 25.0,
        critical_threshold: 15.0,
        is_custom: true,
    },
    {
        id: 'bench-4',
        metric_type: 'EBITDA_MARGIN',
        metric_key: 'ebitda_margin',
        label: 'Marża Operacyjna EBITDA (EBITDA Margin)',
        unit: '%',
        higher_is_better: true,
        target_value: 18.0,
        warning_threshold: 12.0,
        critical_threshold: 6.0,
        is_custom: false,
    },
    {
        id: 'bench-5',
        metric_type: 'OPERATING_MARGIN',
        metric_key: 'operating_margin',
        label: 'Marża Operacyjna EBIT (Operating Margin)',
        unit: '%',
        higher_is_better: true,
        target_value: 12.0,
        warning_threshold: 6.0,
        critical_threshold: 1.0,
        is_custom: false,
    },
    {
        id: 'bench-6',
        metric_type: 'NET_MARGIN',
        metric_key: 'net_margin',
        label: 'Marża Zysku Netto (Net Margin)',
        unit: '%',
        higher_is_better: true,
        target_value: 10.0,
        warning_threshold: 4.0,
        critical_threshold: 0.0,
        is_custom: false,
    },
    {
        id: 'bench-7',
        metric_type: 'DEBT_TO_ASSETS',
        metric_key: 'debt_to_assets',
        label: 'Wskaźnik Ogólnego Zadłużenia (Debt-to-Assets)',
        unit: 'x',
        higher_is_better: false,
        target_value: 0.50,
        warning_threshold: 0.70,
        critical_threshold: 0.90,
        is_custom: true,
    },
];

const mockMetrics = {
    pnl: {
        revenue: { amount: 2000000 },
        cogs: { amount: 1100000 },
        gross_profit: { amount: 900000 },
        gross_margin_pct: 45.0,
        ebitda: { amount: 400000 },
        ebitda_margin_pct: 20.0,
        ebit: { amount: 340000 },
        operating_margin_pct: 17.0,
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
    benchmark_summary: {
        health_score: 92.5,
        overall_status: 'OPT',
        overall_status_label: 'OPTYMALNA',
        optimal_count: 7,
        warning_count: 0,
        critical_count: 0,
        total_evaluated: 7,
    },
};

const renderWithRole = (ui, role = 'advisor') => {
    const isSuperAdmin = role === 'super_admin';
    const isAdvisor = role === 'advisor';
    const isClient = role === 'client';

    return render(
        <NotificationProvider>
            <AuthContext.Provider
                value={{
                    user: { id: 'u1', name: 'Adam Doradca', role },
                    activeCompany: mockCompany,
                    isAdmin: isSuperAdmin,
                    isSuperAdmin,
                    isAdvisor,
                    isClient,
                }}
            >
                <DealProvider>
                    {ui}
                </DealProvider>
            </AuthContext.Provider>
        </NotificationProvider>
    );
};

describe('Benchmark Configuration & Dynamic Status Chips', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        apiClient.get.mockImplementation((url) => {
            if (url === '/finance/benchmarks') {
                return Promise.resolve({ data: { data: mockBenchmarksList } });
            }
            if (url === '/finance/analytics/metrics') {
                return Promise.resolve({ data: { data: mockMetrics } });
            }
            return Promise.resolve({ data: { data: [] } });
        });
        apiClient.put.mockResolvedValue({ data: { status: 'success' } });
        apiClient.post.mockResolvedValue({ data: { status: 'success' } });
    });

    describe('evaluateStatusChip Helper Unit Tests', () => {
        it('evaluates higher-is-better metric statuses accurately', () => {
            // Actual: 1.95, Target: 1.30, Warning: 1.10
            expect(evaluateStatusChip(1.95, 1.30, 1.10, true).status).toBe('OPT');
            // Actual: 1.20 (between 1.10 warning and 1.30 target)
            expect(evaluateStatusChip(1.20, 1.30, 1.10, true).status).toBe('WARN');
            // Actual: 0.95 (below 1.10 warning)
            expect(evaluateStatusChip(0.95, 1.30, 1.10, true).status).toBe('CRIT');
        });

        it('evaluates lower-is-better metric statuses accurately (Debt-to-Assets)', () => {
            // Actual: 0.35, Target: 0.50, Warning: 0.70
            expect(evaluateStatusChip(0.35, 0.50, 0.70, false).status).toBe('OPT');
            // Actual: 0.60 (between 0.50 target and 0.70 warning)
            expect(evaluateStatusChip(0.60, 0.50, 0.70, false).status).toBe('WARN');
            // Actual: 0.85 (above 0.70 warning)
            expect(evaluateStatusChip(0.85, 0.50, 0.70, false).status).toBe('CRIT');
        });
    });

    describe('BenchmarkConfigModal Component', () => {
        it('renders benchmark modal with editable inputs for Advisor and live status chip', async () => {
            const onSavedMock = vi.fn();
            const onCloseMock = vi.fn();

            renderWithRole(
                <BenchmarkConfigModal
                    isOpen={true}
                    onClose={onCloseMock}
                    onSaved={onSavedMock}
                    currentMetrics={mockMetrics}
                />,
                'advisor'
            );

            await waitFor(() => {
                expect(apiClient.get).toHaveBeenCalledWith('/finance/benchmarks');
            });

            expect(screen.getByText(/Konfigurator Celów i Benchmarków M&A/i)).toBeInTheDocument();
            expect(screen.getByText('Wskaźnik Płynności Bieżącej (Current Ratio)')).toBeInTheDocument();

            // Find Current Ratio Target input (1.30)
            const inputs = screen.getAllByRole('spinbutton');
            expect(inputs.length).toBeGreaterThanOrEqual(14); // 7 metrics * at least 2 inputs

            // Click save
            const saveBtn = screen.getByRole('button', { name: /Zapisz Cele Benchmarków/i });
            expect(saveBtn).toBeInTheDocument();
            fireEvent.click(saveBtn);

            await waitFor(() => {
                expect(apiClient.put).toHaveBeenCalledWith('/finance/benchmarks', expect.any(Object));
                expect(onSavedMock).toHaveBeenCalled();
                expect(onCloseMock).toHaveBeenCalled();
            });
        });

        it('calls reset endpoint when Advisor clicks reset to defaults', async () => {
            window.confirm = () => true;

            renderWithRole(
                <BenchmarkConfigModal
                    isOpen={true}
                    onClose={vi.fn()}
                    onSaved={vi.fn()}
                    currentMetrics={mockMetrics}
                />,
                'advisor'
            );

            await waitFor(() => {
                expect(screen.getByText(/Przywróć domyślne rynkowe/i)).toBeInTheDocument();
            });

            fireEvent.click(screen.getByText(/Przywróć domyślne rynkowe/i));

            await waitFor(() => {
                expect(apiClient.post).toHaveBeenCalledWith('/finance/benchmarks/reset');
            });
        });
    });

    describe('AnalyticsView Benchmarks Tab', () => {
        it('renders Cele i Benchmarki M&A tab with interactive editable matrix for Advisor', async () => {
            renderWithRole(<AnalyticsView />, 'advisor');

            await waitFor(() => {
                expect(screen.getByText(/Cele i Benchmarki \(M&A\)/i)).toBeInTheDocument();
            });

            // Switch to benchmarks tab
            fireEvent.click(screen.getByText(/Cele i Benchmarki \(M&A\)/i));

            await waitFor(() => {
                expect(screen.getByText(/Macierz Celów i Benchmarków Finansowych/i)).toBeInTheDocument();
            });

            // Advisor edit mode banner
            expect(screen.getByText(/TRYB EDYCJI DLA DORADCY/i)).toBeInTheDocument();
            expect(screen.getByText('Zapisz Wszystkie Cele')).toBeInTheDocument();
            expect(screen.getByText('Resetuj do Rynkowych')).toBeInTheDocument();

            // Find current ratio input and change value
            const currentRatioTargetInput = screen.getByLabelText(/Cel docelowy Wskaźnik Płynności Bieżącej/i);
            expect(currentRatioTargetInput).toBeInTheDocument();
            expect(currentRatioTargetInput).not.toBeDisabled();

            // Trigger change
            fireEvent.change(currentRatioTargetInput, { target: { value: '2.50' } });

            // Click save all
            fireEvent.click(screen.getByText('Zapisz Wszystkie Cele'));

            await waitFor(() => {
                expect(apiClient.put).toHaveBeenCalledWith('/finance/benchmarks', expect.objectContaining({
                    benchmarks: expect.any(Array),
                }));
            });
        });

        it('renders read-only view for Client without editable inputs or save buttons', async () => {
            renderWithRole(<AnalyticsView />, 'client');

            await waitFor(() => {
                expect(screen.getByText(/Cele i Benchmarki \(M&A\)/i)).toBeInTheDocument();
            });

            // Switch to benchmarks tab
            fireEvent.click(screen.getByText(/Cele i Benchmarki \(M&A\)/i));

            await waitFor(() => {
                expect(screen.getByText(/Macierz Celów i Benchmarków Finansowych/i)).toBeInTheDocument();
            });

            // Client read-only banner
            expect(screen.getByText(/TRYB PODGLĄDU DLA KLIENTA/i)).toBeInTheDocument();
            expect(screen.queryByText('Zapisz Wszystkie Cele')).not.toBeInTheDocument();
            expect(screen.queryByText('Resetuj do Rynkowych')).not.toBeInTheDocument();

            // Inputs should NOT exist for client
            expect(screen.queryByLabelText(/Cel docelowy Wskaźnik Płynności Bieżącej/i)).not.toBeInTheDocument();
        });
    });
});
