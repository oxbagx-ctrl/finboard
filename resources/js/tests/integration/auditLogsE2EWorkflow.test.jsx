import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
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

const allMockEvents = [
    {
        id: 'fin-del-1',
        company_id: 'comp-acme-1',
        action: 'RECORD_DELETED',
        action_label: 'Usunięcie rekordu finansowego',
        action_color: 'rose',
        action_category: 'finance_records',
        entity_type: 'FinanceRecord',
        entity_id: 'rec-101',
        description: 'Usunięto rekord licencji chmurowych',
        old_values: { amount: 15400, record_type: 'EXPENSE', category: 'Koszty IT', record_date: '2026-03-10' },
        new_values: null,
        user: { id: 'u-1', name: 'Adam Doradca', email: 'adam@helvest.pl', role: 'advisor' },
        ip_address: '10.0.0.1',
        created_at: '2026-03-20T14:00:00Z',
    },
    {
        id: 'fin-del-2',
        company_id: 'comp-acme-1',
        action: 'RECORDS_BATCH_DELETED',
        action_label: 'Masowe usunięcie rekordów',
        action_color: 'rose',
        action_category: 'finance_records',
        entity_type: 'FinanceRecord',
        entity_id: 'batch-01',
        description: 'Masowe usunięcie 8 rekordów operacyjnych',
        old_values: { count: 8, total_amount: 98000, record_ids: ['r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7', 'r8'] },
        new_values: null,
        user: { id: 'u-2', name: 'Jan Zarząd', email: 'jan@acme.com', role: 'admin' },
        ip_address: '10.0.0.2',
        created_at: '2026-03-20T13:30:00Z',
    },
    {
        id: 'fin-upd-1',
        company_id: 'comp-acme-1',
        action: 'RECORD_UPDATED',
        action_label: 'Modyfikacja rekordu finansowego',
        action_color: 'blue',
        action_category: 'finance_records',
        entity_type: 'FinanceRecord',
        entity_id: 'rec-202',
        description: 'Zaktualizowano kwotę faktury klienta',
        old_values: { amount: 45000, description: 'Faktura zaliczkowa' },
        new_values: { amount: 62000, description: 'Faktura końcowa' },
        user: { id: 'u-1', name: 'Adam Doradca', email: 'adam@helvest.pl', role: 'advisor' },
        ip_address: '10.0.0.1',
        created_at: '2026-03-20T12:00:00Z',
    },
    {
        id: 'fin-upd-2',
        company_id: 'comp-acme-1',
        action: 'RECORD_UPDATED',
        action_label: 'Modyfikacja rekordu finansowego',
        action_color: 'blue',
        action_category: 'finance_records',
        entity_type: 'FinanceRecord',
        entity_id: 'rec-203',
        description: 'Zreklasyfikowano koszt do marketingu',
        old_values: { category: 'Inne koszty' },
        new_values: { category: 'Marketing i PR' },
        user: { id: 'u-2', name: 'Jan Zarząd', email: 'jan@acme.com', role: 'admin' },
        ip_address: '10.0.0.2',
        created_at: '2026-03-20T11:00:00Z',
    },
    {
        id: 'fin-imp-1',
        company_id: 'comp-acme-1',
        action: 'CSV_IMPORT_PROCESSED',
        action_label: 'Zakończono import CSV',
        action_color: 'cyan',
        action_category: 'csv_imports',
        entity_type: 'CsvImport',
        entity_id: 'imp-501',
        description: 'Zakończono import pliku import_q1.csv (150 rekordów)',
        old_values: null,
        new_values: { records_count: 150, total_volume: 1250000, file_name: 'import_q1.csv' },
        user: { id: 'u-2', name: 'Jan Zarząd', email: 'jan@acme.com', role: 'admin' },
        ip_address: '10.0.0.2',
        created_at: '2026-03-20T10:00:00Z',
    },
    {
        id: 'fin-imp-2',
        company_id: 'comp-acme-1',
        action: 'CSV_IMPORT_FAILED',
        action_label: 'Błąd importu CSV',
        action_color: 'amber',
        action_category: 'csv_imports',
        entity_type: 'CsvImport',
        entity_id: 'imp-502',
        description: 'Błąd przetwarzania importu uszkodzony.csv',
        old_values: null,
        new_values: { error: 'Nieprawidłowy format kolumny data', file_name: 'uszkodzony.csv' },
        user: { id: 'u-1', name: 'Adam Doradca', email: 'adam@helvest.pl', role: 'advisor' },
        ip_address: '10.0.0.1',
        created_at: '2026-03-20T09:30:00Z',
    },
    {
        id: 'fin-crt-1',
        company_id: 'comp-acme-1',
        action: 'RECORD_CREATED',
        action_label: 'Tworzenie rekordu finansowego',
        action_color: 'emerald',
        action_category: 'finance_records',
        entity_type: 'FinanceRecord',
        entity_id: 'rec-303',
        description: 'Utworzono rekord sprzedaży obrabiarek CNC',
        old_values: null,
        new_values: { amount: 200000, record_type: 'INCOME', category: 'Sprzedaż maszyn' },
        user: { id: 'u-2', name: 'Jan Zarząd', email: 'jan@acme.com', role: 'admin' },
        ip_address: '10.0.0.2',
        created_at: '2026-03-20T08:00:00Z',
    },
];

const mockStats = {
    total_events: 7,
    by_action: {
        RECORD_DELETED: { count: 1, label: 'Usunięcie rekordu', color: 'rose' },
        RECORDS_BATCH_DELETED: { count: 1, label: 'Masowe usunięcie rekordów', color: 'rose' },
        RECORD_UPDATED: { count: 2, label: 'Modyfikacja rekordu', color: 'blue' },
        RECORD_CREATED: { count: 1, label: 'Tworzenie rekordu', color: 'emerald' },
        CSV_IMPORT_PROCESSED: { count: 1, label: 'Zakończono import CSV', color: 'cyan' },
        CSV_IMPORT_FAILED: { count: 1, label: 'Błąd importu CSV', color: 'amber' },
        BENCHMARK_CONFIGURED: { count: 0, label: 'Konfiguracja celu', color: 'indigo' },
        BENCHMARK_RESET: { count: 0, label: 'Reset celu', color: 'indigo' },
    },
    by_category: {
        finance_records: 5,
        csv_imports: 2,
    },
    last_event_at: '2026-03-20T14:00:00Z',
};

const renderView = (authOverrides = {}) => {
    const authValue = {
        user: { id: 'u-1', name: 'Adam Doradca', role: 'advisor' },
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

describe('Financial Audit Trail E2E Workflow Tests', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Implement smart mock that filters allMockEvents according to action and search params
        apiClient.get.mockImplementation((url, config = {}) => {
            if (url === '/finance/audit-logs/stats') {
                return Promise.resolve({ data: { data: mockStats } });
            }

            if (url === '/finance/audit-logs') {
                const params = config.params || {};
                let filtered = [...allMockEvents];

                // Multi-action filter
                if (params.action) {
                    const actions = params.action.split(',').map((a) => a.trim());
                    filtered = filtered.filter((e) => actions.includes(e.action));
                }

                // Fulltext search filter
                if (params.search) {
                    const q = params.search.toLowerCase();
                    filtered = filtered.filter(
                        (e) =>
                            e.description?.toLowerCase().includes(q) ||
                            e.entity_id?.toLowerCase().includes(q) ||
                            e.user?.name?.toLowerCase().includes(q) ||
                            e.user?.email?.toLowerCase().includes(q) ||
                            e.ip_address?.includes(q)
                    );
                }

                const page = params.page || 1;
                const perPage = params.per_page || 25;
                const total = filtered.length;
                const lastPage = Math.max(1, Math.ceil(total / perPage));

                return Promise.resolve({
                    data: {
                        data: filtered,
                        meta: {
                            current_page: page,
                            last_page: lastPage,
                            total,
                            per_page: perPage,
                        },
                    },
                });
            }

            if (url === '/documents/audit-logs') {
                return Promise.resolve({ data: { data: [], meta: { total: 0, current_page: 1, last_page: 1 } } });
            }

            return Promise.reject(new Error(`Unhandled route ${url}`));
        });
    });

    it('orchestrates complete deletion audit workflow: filters single & batch deletions, inspects red warning banners and JSON diffs', async () => {
        renderView();

        // 1. Initial State verification
        await waitFor(() => {
            expect(screen.getByTestId('audit-stat-total')).toHaveTextContent('7');
            expect(screen.getByTestId('audit-stat-deletions')).toHaveTextContent('2');
            expect(screen.getByTestId('audit-stat-deletions')).toHaveTextContent('1 MASOWE');
        });

        // 2. Select Deletions Filter Pill
        const deletionsPill = screen.getByTestId('action-pill-deletions');
        expect(deletionsPill).toHaveTextContent('2');
        fireEvent.click(deletionsPill);

        // Wait for table to update with only deletion records
        await waitFor(() => {
            expect(screen.getByTestId('finance-audit-row-fin-del-1')).toBeInTheDocument();
            expect(screen.getByTestId('finance-audit-row-fin-del-2')).toBeInTheDocument();
            expect(screen.queryByTestId('finance-audit-row-fin-upd-1')).not.toBeInTheDocument();
            expect(screen.queryByTestId('finance-audit-row-fin-crt-1')).not.toBeInTheDocument();
        });

        expect(screen.getByText('Usunięto rekord licencji chmurowych')).toBeInTheDocument();
        expect(screen.getByText('Masowe usunięcie 8 rekordów operacyjnych')).toBeInTheDocument();

        // 3. Inspect Single Deletion via Row Inspect Button
        fireEvent.click(screen.getByTestId('audit-row-inspect-fin-del-1'));

        expect(screen.getByTestId('financial-audit-detail-modal')).toBeInTheDocument();
        expect(screen.getByTestId('audit-modal-action-badge')).toHaveTextContent('Usunięcie rekordu finansowego');
        const delBanner = screen.getByTestId('audit-modal-deleted-summary');
        expect(delBanner).toBeInTheDocument();
        expect(delBanner).toHaveTextContent(/15[\s\u00A0]?400,00[\s\u00A0]?zł/);
        expect(delBanner).toHaveTextContent('Koszty IT');
        expect(screen.getByTestId('audit-modal-new-values')).toHaveTextContent('Brak nowych wartości');

        // Close modal
        fireEvent.click(screen.getByTestId('audit-modal-close-btn'));
        await waitFor(() => {
            expect(screen.queryByTestId('financial-audit-detail-modal')).not.toBeInTheDocument();
        });

        // 4. Inspect Batch Deletion via clicking directly on the row
        fireEvent.click(screen.getByTestId('finance-audit-row-fin-del-2'));

        expect(screen.getByTestId('financial-audit-detail-modal')).toBeInTheDocument();
        expect(screen.getByTestId('audit-modal-action-badge')).toHaveTextContent('Masowe usunięcie rekordów');
        const batchBanner = screen.getByTestId('audit-modal-deleted-summary');
        expect(batchBanner).toHaveTextContent('8 rekordów');
        expect(batchBanner).toHaveTextContent(/98[\s\u00A0]?000,00[\s\u00A0]?zł/);

        // Close modal via Escape
        fireEvent.keyDown(window, { key: 'Escape' });
        await waitFor(() => {
            expect(screen.queryByTestId('financial-audit-detail-modal')).not.toBeInTheDocument();
        });
    });

    it('orchestrates complete modification audit workflow: filters updates, inspects side-by-side JSON snapshots, and tests text search', async () => {
        renderView();

        await waitFor(() => {
            expect(screen.getByTestId('action-pill-updates')).toBeInTheDocument();
        });

        // 1. Select Updates Filter Pill
        fireEvent.click(screen.getByTestId('action-pill-updates'));

        await waitFor(() => {
            expect(screen.getByTestId('finance-audit-row-fin-upd-1')).toBeInTheDocument();
            expect(screen.getByTestId('finance-audit-row-fin-upd-2')).toBeInTheDocument();
            expect(screen.queryByTestId('finance-audit-row-fin-del-1')).not.toBeInTheDocument();
        });

        expect(screen.getByText('Zaktualizowano kwotę faktury klienta')).toBeInTheDocument();
        expect(screen.getByText('Zreklasyfikowano koszt do marketingu')).toBeInTheDocument();

        // 2. Open Modification Details Modal
        fireEvent.click(screen.getByTestId('audit-row-inspect-fin-upd-1'));

        expect(screen.getByTestId('financial-audit-detail-modal')).toBeInTheDocument();
        expect(screen.getByTestId('audit-modal-action-badge')).toHaveTextContent('Modyfikacja rekordu finansowego');
        expect(screen.getByText('Stan Początkowy (old_values)')).toBeInTheDocument();
        expect(screen.getByText('Stan Końcowy (new_values)')).toBeInTheDocument();

        // Check operators profile and IP
        const modal = screen.getByTestId('financial-audit-detail-modal');
        expect(within(modal).getByText('Adam Doradca')).toBeInTheDocument();
        expect(within(modal).getByText('adam@helvest.pl')).toBeInTheDocument();
        expect(within(modal).getByText('10.0.0.1')).toBeInTheDocument();

        // Close modal
        fireEvent.click(screen.getByTestId('audit-modal-footer-close-btn'));
        await waitFor(() => {
            expect(screen.queryByTestId('financial-audit-detail-modal')).not.toBeInTheDocument();
        });

        // 3. Search within active Updates filter
        const searchInput = screen.getByTestId('finance-search-input');
        fireEvent.change(searchInput, { target: { value: 'marketing' } });

        await waitFor(() => {
            expect(screen.queryByTestId('finance-audit-row-fin-upd-1')).not.toBeInTheDocument();
            expect(screen.getByTestId('finance-audit-row-fin-upd-2')).toBeInTheDocument();
        }, { timeout: 1500 });

        expect(screen.getByText('Zreklasyfikowano koszt do marketingu')).toBeInTheDocument();

        // 4. Clear Search restores all updates
        fireEvent.click(screen.getByTestId('finance-search-clear'));

        await waitFor(() => {
            expect(screen.getByTestId('finance-audit-row-fin-upd-1')).toBeInTheDocument();
            expect(screen.getByTestId('finance-audit-row-fin-upd-2')).toBeInTheDocument();
        });
    });

    it('orchestrates complete CSV import audit workflow: filters processed & failed imports and inspects error payloads', async () => {
        renderView();

        await waitFor(() => {
            expect(screen.getByTestId('action-pill-imports')).toBeInTheDocument();
        });

        // 1. Select CSV Imports Filter Pill
        fireEvent.click(screen.getByTestId('action-pill-imports'));

        await waitFor(() => {
            expect(screen.getByTestId('finance-audit-row-fin-imp-1')).toBeInTheDocument();
            expect(screen.getByTestId('finance-audit-row-fin-imp-2')).toBeInTheDocument();
            expect(screen.queryByTestId('finance-audit-row-fin-upd-1')).not.toBeInTheDocument();
        });

        expect(screen.getByText('Zakończono import pliku import_q1.csv (150 rekordów)')).toBeInTheDocument();
        expect(screen.getByText('Błąd przetwarzania importu uszkodzony.csv')).toBeInTheDocument();

        // 2. Inspect Successful Import
        fireEvent.click(screen.getByTestId('audit-row-inspect-fin-imp-1'));

        expect(screen.getByTestId('financial-audit-detail-modal')).toBeInTheDocument();
        expect(screen.getByTestId('audit-modal-action-badge')).toHaveTextContent('Zakończono import CSV');
        expect(screen.getByTestId('audit-modal-old-values')).toHaveTextContent('Brak wartości początkowych');
        expect(screen.getByText('Stan Końcowy (new_values)')).toBeInTheDocument();

        // Close modal
        fireEvent.click(screen.getByTestId('audit-modal-close-btn'));
        await waitFor(() => {
            expect(screen.queryByTestId('financial-audit-detail-modal')).not.toBeInTheDocument();
        });

        // 3. Inspect Failed Import with Error Metadata
        fireEvent.click(screen.getByTestId('audit-row-inspect-fin-imp-2'));

        expect(screen.getByTestId('financial-audit-detail-modal')).toBeInTheDocument();
        expect(screen.getByTestId('audit-modal-action-badge')).toHaveTextContent('Błąd importu CSV');
        expect(screen.getByText(/Nieprawidłowy format kolumny data/)).toBeInTheDocument();

        // Close modal
        fireEvent.keyDown(window, { key: 'Escape' });
        await waitFor(() => {
            expect(screen.queryByTestId('financial-audit-detail-modal')).not.toBeInTheDocument();
        });

        // 4. Return to All events
        fireEvent.click(screen.getByTestId('action-pill-all'));

        await waitFor(() => {
            expect(screen.getByTestId('finance-audit-row-fin-del-1')).toBeInTheDocument();
            expect(screen.getByTestId('finance-audit-row-fin-upd-1')).toBeInTheDocument();
            expect(screen.getByTestId('finance-audit-row-fin-imp-1')).toBeInTheDocument();
            expect(screen.getByTestId('finance-audit-row-fin-crt-1')).toBeInTheDocument();
        });
    });
});
