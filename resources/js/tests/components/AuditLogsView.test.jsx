import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { AuditLogsView } from '../../views/AuditLogsView';
import { AuthContext } from '../../context/AuthContext';
import { NotificationProvider } from '../../context/NotificationContext';
import apiClient from '../../api/client';

// Mock apiClient
vi.mock('../../api/client', () => ({
    default: {
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
    },
}));

const mockCompany = {
    id: 'comp-acme-1',
    name: 'Acme Manufacturing S.A.',
    code: 'ACME',
};

const mockFinanceStats = {
    total_events: 35,
    by_action: {
        RECORD_CREATED: { count: 15, label: 'Tworzenie rekordu', color: 'emerald' },
        RECORD_UPDATED: { count: 10, label: 'Modyfikacja rekordu', color: 'blue' },
        RECORD_DELETED: { count: 4, label: 'Usunięcie rekordu', color: 'rose' },
        RECORDS_BATCH_DELETED: { count: 2, label: 'Masowe usunięcie rekordów', color: 'rose' },
        CSV_IMPORT_PROCESSED: { count: 3, label: 'Zakończono import CSV', color: 'cyan' },
        CSV_IMPORT_FAILED: { count: 1, label: 'Błąd importu CSV', color: 'amber' },
        BENCHMARK_CONFIGURED: { count: 0, label: 'Konfiguracja celu', color: 'indigo' },
        BENCHMARK_RESET: { count: 0, label: 'Reset celu', color: 'indigo' },
    },
    by_category: {
        finance_records: 31,
        csv_imports: 4,
    },
    last_event_at: '2026-03-20T15:30:00Z',
};

const mockFinanceLogs = [
    {
        id: 'fin-log-1',
        company_id: 'comp-acme-1',
        action: 'RECORD_UPDATED',
        action_label: 'Modyfikacja rekordu finansowego',
        action_color: 'blue',
        action_category: 'finance_records',
        entity_type: 'FinanceRecord',
        entity_id: 'rec-100',
        description: 'Zaktualizowano kwotę przychodu z 50000 do 65000 PLN',
        old_values: { amount: 50000, description: 'Stara faktura' },
        new_values: { amount: 65000, description: 'Nowa faktura' },
        user_id: 'usr-1',
        user: { id: 'usr-1', name: 'Adam Kowalski', email: 'adam@acme.com', role: 'advisor' },
        ip_address: '192.168.1.10',
        user_agent: 'Mozilla/5.0 Chrome/120.0',
        created_at: '2026-03-20T14:30:00Z',
    },
    {
        id: 'fin-log-2',
        company_id: 'comp-acme-1',
        action: 'RECORD_DELETED',
        action_label: 'Usunięcie rekordu finansowego',
        action_color: 'rose',
        action_category: 'finance_records',
        entity_type: 'FinanceRecord',
        entity_id: 'rec-200',
        description: 'Usunięto rekord kosztowy amortyzacji',
        old_values: { amount: 8500, category_name: 'Amortyzacja maszyn', record_type: 'EXPENSE' },
        new_values: null,
        user_id: 'usr-2',
        user: { id: 'usr-2', name: 'Ewa Nowak', email: 'ewa@acme.com', role: 'admin' },
        ip_address: '192.168.1.20',
        user_agent: 'Mozilla/5.0 Safari/17.0',
        created_at: '2026-03-20T13:00:00Z',
    },
    {
        id: 'fin-log-3',
        company_id: 'comp-acme-1',
        action: 'RECORDS_BATCH_DELETED',
        action_label: 'Masowe usunięcie rekordów',
        action_color: 'rose',
        action_category: 'finance_records',
        entity_type: 'FinanceRecord',
        entity_id: 'batch-del-01',
        description: 'Masowe usunięcie 5 rekordów o łącznej wartości 45 000,00 zł',
        old_values: { batch_count: 5, total_amount: 45000, ids: ['r1', 'r2', 'r3', 'r4', 'r5'] },
        new_values: null,
        user_id: 'usr-2',
        user: { id: 'usr-2', name: 'Ewa Nowak', email: 'ewa@acme.com', role: 'admin' },
        ip_address: '192.168.1.20',
        user_agent: 'Mozilla/5.0 Safari/17.0',
        created_at: '2026-03-20T12:00:00Z',
    },
];

const mockVdrLogs = [
    {
        id: 'vdr-log-1',
        document_id: 'doc-vdr-1',
        document_title: 'Sprawozdanie Finansowe Q4.pdf',
        action: 'download',
        user: { id: 'usr-1', name: 'Adam Kowalski', email: 'adam@acme.com', role: 'advisor' },
        ip_address: '192.168.1.10',
        created_at: '2026-03-20T11:00:00Z',
    },
    {
        id: 'vdr-log-2',
        document_id: 'doc-vdr-2',
        document_title: 'Umowa Spółki.pdf',
        action: 'upload',
        user: { id: 'usr-2', name: 'Ewa Nowak', email: 'ewa@acme.com', role: 'admin' },
        ip_address: '192.168.1.20',
        created_at: '2026-03-20T10:00:00Z',
    },
];

const renderComponent = (authOverrides = {}) => {
    const authValue = {
        user: { id: 'usr-1', name: 'Adam Kowalski', role: 'advisor' },
        activeCompany: mockCompany,
        companies: [mockCompany],
        switchCompany: vi.fn(),
        ...authOverrides,
    };

    return render(
        <AuthContext.Provider value={authValue}>
            <NotificationProvider>
                <AuditLogsView />
            </NotificationProvider>
        </AuthContext.Provider>
    );
};

describe('AuditLogsView Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        apiClient.get.mockImplementation((url) => {
            if (url === '/finance/audit-logs/stats') {
                return Promise.resolve({ data: { data: mockFinanceStats } });
            }
            if (url === '/finance/audit-logs') {
                return Promise.resolve({
                    data: {
                        data: mockFinanceLogs,
                        meta: {
                            current_page: 1,
                            last_page: 2,
                            total: 35,
                            per_page: 25,
                        },
                    },
                });
            }
            if (url === '/documents/audit-logs') {
                return Promise.resolve({
                    data: {
                        data: mockVdrLogs,
                        meta: {
                            current_page: 1,
                            last_page: 1,
                            total: 2,
                            per_page: 25,
                        },
                    },
                });
            }
            return Promise.reject(new Error(`Unhandled URL: ${url}`));
        });
    });

    it('renders financial audit view by default with stats cards, filter pills, and table rows', async () => {
        renderComponent();

        // Verify Header
        expect(screen.getByText(/Dziennik Nadzoru & Ścieżka Audytowa/i)).toBeInTheDocument();
        expect(screen.getByTestId('audit-active-company-badge')).toHaveTextContent('Acme Manufacturing S.A.');

        // Verify Tab switchers
        expect(screen.getByTestId('audit-tab-finance')).toBeInTheDocument();
        expect(screen.getByTestId('audit-tab-vdr')).toBeInTheDocument();

        // Wait for stats & logs to load
        await waitFor(() => {
            expect(screen.getByTestId('audit-stat-total')).toBeInTheDocument();
        });

        // Verify KPI stat cards
        expect(screen.getByTestId('audit-stat-total')).toHaveTextContent('35');
        expect(screen.getByTestId('audit-stat-deletions')).toHaveTextContent('6');
        expect(screen.getByTestId('audit-stat-deletions')).toHaveTextContent('2 MASOWE');
        expect(screen.getByTestId('audit-stat-updates-imports')).toHaveTextContent('14');

        // Verify Action filter pills
        expect(screen.getByTestId('action-pill-all')).toHaveTextContent('Wszystkie');
        expect(screen.getByTestId('action-pill-all')).toHaveTextContent('35');
        expect(screen.getByTestId('action-pill-deletions')).toHaveTextContent('Usunięcia');
        expect(screen.getByTestId('action-pill-deletions')).toHaveTextContent('6');
        expect(screen.getByTestId('action-pill-updates')).toHaveTextContent('Modyfikacje');
        expect(screen.getByTestId('action-pill-updates')).toHaveTextContent('10');

        // Verify Table rows
        await waitFor(() => {
            expect(screen.getByTestId('finance-audit-row-fin-log-1')).toBeInTheDocument();
            expect(screen.getByTestId('finance-audit-row-fin-log-2')).toBeInTheDocument();
            expect(screen.getByTestId('finance-audit-row-fin-log-3')).toBeInTheDocument();
        });

        expect(screen.getByText('Zaktualizowano kwotę przychodu z 50000 do 65000 PLN')).toBeInTheDocument();
        expect(screen.getByText('Usunięto rekord kosztowy amortyzacji')).toBeInTheDocument();
        expect(screen.getByText('Masowe usunięcie 5 rekordów o łącznej wartości 45 000,00 zł')).toBeInTheDocument();
        expect(screen.getAllByText('Modyfikacja rekordu finansowego')[0]).toBeInTheDocument();
    });

    it('filters financial audit logs when clicking action filter pills', async () => {
        renderComponent();

        await waitFor(() => {
            expect(screen.getByTestId('action-pill-deletions')).toBeInTheDocument();
        });

        // Click Deletions pill
        fireEvent.click(screen.getByTestId('action-pill-deletions'));

        await waitFor(() => {
            expect(apiClient.get).toHaveBeenCalledWith('/finance/audit-logs', expect.objectContaining({
                params: expect.objectContaining({
                    action: 'RECORD_DELETED,RECORDS_BATCH_DELETED',
                    company_id: 'comp-acme-1',
                }),
            }));
        });

        // Click Updates pill
        fireEvent.click(screen.getByTestId('action-pill-updates'));

        await waitFor(() => {
            expect(apiClient.get).toHaveBeenCalledWith('/finance/audit-logs', expect.objectContaining({
                params: expect.objectContaining({
                    action: 'RECORD_UPDATED',
                    company_id: 'comp-acme-1',
                }),
            }));
        });

        // Click All pill
        fireEvent.click(screen.getByTestId('action-pill-all'));

        await waitFor(() => {
            expect(apiClient.get).toHaveBeenCalledWith('/finance/audit-logs', expect.objectContaining({
                params: expect.not.objectContaining({
                    action: expect.anything(),
                }),
            }));
        });
    });

    it('debounces text search input and updates query', async () => {
        renderComponent();

        await waitFor(() => {
            expect(screen.getByTestId('finance-search-input')).toBeInTheDocument();
        });

        const searchInput = screen.getByTestId('finance-search-input');
        fireEvent.change(searchInput, { target: { value: 'Nowak' } });

        await waitFor(() => {
            expect(apiClient.get).toHaveBeenCalledWith('/finance/audit-logs', expect.objectContaining({
                params: expect.objectContaining({
                    search: 'Nowak',
                }),
            }));
        }, { timeout: 1500 });

        // Clear search using clear button
        const clearBtn = screen.getByTestId('finance-search-clear');
        fireEvent.click(clearBtn);

        expect(searchInput.value).toBe('');

        await waitFor(() => {
            expect(apiClient.get).toHaveBeenCalledWith('/finance/audit-logs', expect.objectContaining({
                params: expect.not.objectContaining({
                    search: 'Nowak',
                }),
            }));
        });
    });

    it('handles pagination navigation in financial audit table', async () => {
        renderComponent();

        await waitFor(() => {
            expect(screen.getByTestId('finance-pagination')).toBeInTheDocument();
        });

        expect(screen.getByTestId('finance-page-info')).toHaveTextContent('Strona 1 z 2');
        expect(screen.getByTestId('finance-prev-page')).toBeDisabled();
        expect(screen.getByTestId('finance-next-page')).not.toBeDisabled();

        // Click next page
        fireEvent.click(screen.getByTestId('finance-next-page'));

        await waitFor(() => {
            expect(apiClient.get).toHaveBeenCalledWith('/finance/audit-logs', expect.objectContaining({
                params: expect.objectContaining({
                    page: 2,
                }),
            }));
        });
    });

    it('opens FinancialAuditDetailModal when clicking inspect button or table row', async () => {
        renderComponent();

        await waitFor(() => {
            expect(screen.getByTestId('audit-row-inspect-fin-log-1')).toBeInTheDocument();
        });

        // Click inspect button
        fireEvent.click(screen.getByTestId('audit-row-inspect-fin-log-1'));

        // Modal should be open
        expect(screen.getByTestId('financial-audit-detail-modal')).toBeInTheDocument();
        expect(screen.getByText('Inspekcja Wpisu Audytowego')).toBeInTheDocument();
        expect(screen.getByText('rec-100')).toBeInTheDocument();

        // Close modal via close button
        const closeBtn = screen.getByTestId('audit-modal-close-btn');
        fireEvent.click(closeBtn);

        await waitFor(() => {
            expect(screen.queryByTestId('financial-audit-detail-modal')).not.toBeInTheDocument();
        });

        // Click directly on the second row (Single deletion)
        fireEvent.click(screen.getByTestId('finance-audit-row-fin-log-2'));

        expect(screen.getByTestId('financial-audit-detail-modal')).toBeInTheDocument();
        const summary = screen.getByTestId('audit-modal-deleted-summary');
        expect(summary).toBeInTheDocument();
        expect(summary).toHaveTextContent(/8[\s\u00A0]?500,00[\s\u00A0]?zł/);

        // Close modal via Escape key
        fireEvent.keyDown(window, { key: 'Escape' });

        await waitFor(() => {
            expect(screen.queryByTestId('financial-audit-detail-modal')).not.toBeInTheDocument();
        });
    });

    it('switches to VDR audit tab and back with preserved VDR logs and actions', async () => {
        renderComponent();

        await waitFor(() => {
            expect(screen.getByTestId('audit-tab-vdr')).toBeInTheDocument();
        });

        // Switch to VDR tab
        fireEvent.click(screen.getByTestId('audit-tab-vdr'));

        await waitFor(() => {
            expect(apiClient.get).toHaveBeenCalledWith('/documents/audit-logs', expect.objectContaining({
                params: expect.objectContaining({
                    company_id: 'comp-acme-1',
                }),
            }));
            expect(screen.getByTestId('vdr-audit-container')).toBeInTheDocument();
        });

        expect(screen.getByText('Sprawozdanie Finansowe Q4.pdf')).toBeInTheDocument();
        expect(screen.getByText('Umowa Spółki.pdf')).toBeInTheDocument();
        expect(screen.getByText('Pobranie')).toBeInTheDocument();
        expect(screen.getByText('Upload')).toBeInTheDocument();

        // Switch back to Finance tab
        fireEvent.click(screen.getByTestId('audit-tab-finance'));

        await waitFor(() => {
            expect(screen.getByTestId('finance-audit-container')).toBeInTheDocument();
        });
    });

    it('handles graceful fallback states for missing company, empty results, and reset filters button', async () => {
        // 1. Missing active company
        const { unmount } = renderComponent({ activeCompany: null });

        expect(screen.getByTestId('audit-no-company-state')).toBeInTheDocument();
        expect(screen.getByText(/Brak wybranego podmiotu/i)).toBeInTheDocument();

        unmount();

        // 2. Empty results with active filters
        apiClient.get.mockImplementation((url) => {
            if (url === '/finance/audit-logs/stats') {
                return Promise.resolve({ data: { data: mockFinanceStats } });
            }
            if (url === '/finance/audit-logs') {
                return Promise.resolve({
                    data: {
                        data: [],
                        meta: { current_page: 1, last_page: 1, total: 0, per_page: 25 },
                    },
                });
            }
            return Promise.resolve({ data: { data: [] } });
        });

        renderComponent();

        await waitFor(() => {
            expect(screen.getByTestId('action-pill-deletions')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByTestId('action-pill-deletions'));

        await waitFor(() => {
            expect(screen.getByTestId('finance-audit-empty')).toBeInTheDocument();
        });

        expect(screen.getByText('Brak zdarzeń audytowych pasujących do wybranych filtrów')).toBeInTheDocument();
        expect(screen.getByTestId('finance-clear-filters-btn')).toBeInTheDocument();

        // Click clear filters button
        fireEvent.click(screen.getByTestId('finance-clear-filters-btn'));

        await waitFor(() => {
            expect(apiClient.get).toHaveBeenCalledWith('/finance/audit-logs', expect.objectContaining({
                params: expect.not.objectContaining({
                    action: expect.anything(),
                }),
            }));
        });
    });

    it('resets state and refetches on finboard:company-changed window event', async () => {
        renderComponent();

        await waitFor(() => {
            expect(screen.getByTestId('finance-audit-row-fin-log-1')).toBeInTheDocument();
        });

        // Open detail modal
        fireEvent.click(screen.getByTestId('audit-row-inspect-fin-log-1'));
        expect(screen.getByTestId('financial-audit-detail-modal')).toBeInTheDocument();

        // Trigger global company change event
        act(() => {
            window.dispatchEvent(new CustomEvent('finboard:company-changed'));
        });

        // Modal should automatically close and refetch should occur
        await waitFor(() => {
            expect(screen.queryByTestId('financial-audit-detail-modal')).not.toBeInTheDocument();
            expect(apiClient.get).toHaveBeenCalledWith('/finance/audit-logs', expect.objectContaining({
                params: expect.objectContaining({
                    page: 1,
                    company_id: 'comp-acme-1',
                }),
            }));
        });
    });

    it('handles VDR server-side action filtering, debounced search, and pagination without client truncation', async () => {
        // Mock with pagination for VDR (last_page: 2, total: 30)
        apiClient.get.mockImplementation((url, config) => {
            if (url === '/documents/audit-logs') {
                const page = config?.params?.page || 1;
                return Promise.resolve({
                    data: {
                        data: mockVdrLogs,
                        meta: {
                            current_page: page,
                            last_page: 2,
                            total: 30,
                            per_page: 25,
                        },
                    },
                });
            }
            if (url === '/finance/audit-logs/stats') {
                return Promise.resolve({ data: { data: mockFinanceStats } });
            }
            if (url === '/finance/audit-logs') {
                return Promise.resolve({
                    data: { data: mockFinanceLogs, meta: { current_page: 1, last_page: 1, total: 3, per_page: 25 } },
                });
            }
            return Promise.resolve({ data: { data: [] } });
        });

        renderComponent();

        // Switch to VDR tab
        fireEvent.click(screen.getByTestId('audit-tab-vdr'));

        await waitFor(() => {
            expect(screen.getByTestId('vdr-audit-container')).toBeInTheDocument();
        });

        // 1. Action filtering: Click 'Pobrania' (id: 'download')
        const downloadFilterBtn = screen.getByTestId('vdr-action-filter-download');
        fireEvent.click(downloadFilterBtn);

        await waitFor(() => {
            expect(apiClient.get).toHaveBeenCalledWith('/documents/audit-logs', expect.objectContaining({
                params: expect.objectContaining({
                    action: 'download',
                    page: 1,
                }),
            }));
        });

        // 2. Search debouncing: Type into VDR search input
        const searchInput = screen.getByTestId('vdr-search-input');
        fireEvent.change(searchInput, { target: { value: 'Umowa' } });

        await waitFor(() => {
            expect(apiClient.get).toHaveBeenCalledWith('/documents/audit-logs', expect.objectContaining({
                params: expect.objectContaining({
                    action: 'download',
                    search: 'Umowa',
                }),
            }));
        }, { timeout: 1500 });

        // 3. Pagination: Click next page
        const nextPageBtn = screen.getByTestId('vdr-next-page');
        await waitFor(() => {
            expect(nextPageBtn).not.toBeDisabled();
        });
        fireEvent.click(nextPageBtn);

        await waitFor(() => {
            expect(apiClient.get).toHaveBeenCalledWith('/documents/audit-logs', expect.objectContaining({
                params: expect.objectContaining({
                    page: 2,
                    action: 'download',
                    search: 'Umowa',
                }),
            }));
        });

        // 4. Clear search
        const clearSearchBtn = screen.getByTestId('vdr-search-clear');
        fireEvent.click(clearSearchBtn);
        expect(searchInput.value).toBe('');

        await waitFor(() => {
            expect(apiClient.get).toHaveBeenCalledWith('/documents/audit-logs', expect.objectContaining({
                params: expect.not.objectContaining({
                    search: 'Umowa',
                }),
            }));
        });
    });

    it('handles VDR empty results and clear filters button', async () => {
        apiClient.get.mockImplementation((url) => {
            if (url === '/documents/audit-logs') {
                return Promise.resolve({
                    data: {
                        data: [],
                        meta: { current_page: 1, last_page: 1, total: 0, per_page: 25 },
                    },
                });
            }
            if (url === '/finance/audit-logs/stats') {
                return Promise.resolve({ data: { data: mockFinanceStats } });
            }
            return Promise.resolve({ data: { data: [] } });
        });

        renderComponent();

        // Switch to VDR tab
        fireEvent.click(screen.getByTestId('audit-tab-vdr'));

        await waitFor(() => {
            expect(screen.getByTestId('vdr-audit-container')).toBeInTheDocument();
        });

        // Type search to trigger empty state with active filter
        const searchInput = screen.getByTestId('vdr-search-input');
        fireEvent.change(searchInput, { target: { value: 'NonExistent' } });

        await waitFor(() => {
            expect(screen.getByTestId('vdr-audit-empty')).toBeInTheDocument();
            expect(screen.getByTestId('vdr-clear-filters-btn')).toBeInTheDocument();
        });

        // Click clear filters button
        fireEvent.click(screen.getByTestId('vdr-clear-filters-btn'));

        expect(searchInput.value).toBe('');

        await waitFor(() => {
            expect(apiClient.get).toHaveBeenCalledWith('/documents/audit-logs', expect.objectContaining({
                params: expect.not.objectContaining({
                    search: 'NonExistent',
                    action: expect.anything(),
                }),
            }));
        });
    });
});

