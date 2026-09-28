import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuditLogsView } from '../../views/AuditLogsView';
import { FinancialAuditDetailModal } from '../../components/audit/FinancialAuditDetailModal';
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
    total_events: 42,
    by_action: {
        RECORD_CREATED: { count: 18, label: 'Tworzenie rekordu', color: 'emerald' },
        RECORD_UPDATED: { count: 12, label: 'Modyfikacja rekordu', color: 'blue' },
        RECORD_DELETED: { count: 5, label: 'Usunięcie rekordu', color: 'rose' },
        RECORDS_BATCH_DELETED: { count: 3, label: 'Masowe usunięcie rekordów', color: 'rose' },
        CSV_IMPORT_PROCESSED: { count: 3, label: 'Zakończono import CSV', color: 'cyan' },
        CSV_IMPORT_FAILED: { count: 1, label: 'Błąd importu CSV', color: 'amber' },
        BENCHMARK_CONFIGURED: { count: 0, label: 'Konfiguracja celu', color: 'indigo' },
        BENCHMARK_RESET: { count: 0, label: 'Reset celu', color: 'indigo' },
    },
    by_category: {
        finance_records: 38,
        csv_imports: 4,
    },
    last_event_at: '2026-03-25T14:45:00Z',
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
        entity_id: 'rec-101',
        description: 'Korekta kwoty przychodu z kontraktu eksportowego',
        old_values: { amount: 150000, description: 'Stara faktura' },
        new_values: { amount: 175000, description: 'Nowa faktura z aneksem' },
        user_id: 'usr-1',
        user: { id: 'usr-1', name: 'Tomasz Nowak', email: 'tomasz@acme.com', role: 'advisor' },
        ip_address: '192.168.1.55',
        user_agent: 'Mozilla/5.0 Chrome/122.0',
        created_at: '2026-03-25T14:45:00Z',
    },
    {
        id: 'fin-log-2',
        company_id: 'comp-acme-1',
        action: 'RECORDS_BATCH_DELETED',
        action_label: 'Masowe usunięcie rekordów',
        action_color: 'rose',
        action_category: 'finance_records',
        entity_type: 'FinanceRecord',
        entity_id: 'batch-009',
        description: 'Usunięcie 4 zdublowanych transakcji bankowych',
        old_values: { count: 4, total_amount: 28400, ids: ['r1', 'r2', 'r3', 'r4'] },
        new_values: null,
        user_id: 'usr-2',
        user: { id: 'usr-2', name: 'Marta Kowalczyk', email: 'marta@acme.com', role: 'admin' },
        ip_address: '192.168.1.80',
        user_agent: 'Mozilla/5.0 Safari/17.2',
        created_at: '2026-03-25T12:00:00Z',
    },
];

const mockVdrLogs = [
    {
        id: 'vdr-log-1',
        document_id: 'doc-vdr-10',
        document_title: 'Plan Połączenia Spółek 2026.pdf',
        action: 'download',
        user: { id: 'usr-1', name: 'Tomasz Nowak', email: 'tomasz@acme.com', role: 'advisor' },
        ip_address: '192.168.1.55',
        created_at: '2026-03-25T10:30:00Z',
    },
    {
        id: 'vdr-log-2',
        document_id: 'doc-vdr-20',
        document_title: 'Opinia Biegłego Rewidenta.pdf',
        action: 'upload',
        user: { id: 'usr-2', name: 'Marta Kowalczyk', email: 'marta@acme.com', role: 'admin' },
        ip_address: '192.168.1.80',
        created_at: '2026-03-25T09:15:00Z',
    },
];

const renderComponent = () => {
    const authValue = {
        user: { id: 'usr-1', name: 'Tomasz Nowak', role: 'advisor' },
        activeCompany: mockCompany,
        companies: [mockCompany],
        switchCompany: vi.fn(),
    };

    return render(
        <AuthContext.Provider value={authValue}>
            <NotificationProvider>
                <AuditLogsView />
            </NotificationProvider>
        </AuthContext.Provider>
    );
};

describe('AuditLogsView Tooltips & Ergonomics Suite', () => {
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
                            total: 42,
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

    it('renders accessible tooltips, badge, and InfoTooltip in AuditLogsView header', async () => {
        renderComponent();

        await waitFor(() => {
            expect(screen.getByTestId('audit-stat-total')).toBeInTheDocument();
        });

        // 1. Shield icon badge with accessible role and aria-label
        const shieldIcon = screen.getByRole('img', { name: 'Rejestr nadzoru i ścieżka audytowa' });
        expect(shieldIcon).toBeInTheDocument();
        expect(shieldIcon).toHaveAttribute('tabIndex', '0');

        // 2. InfoTooltip next to title
        const headerInfoBtn = screen.getByRole('button', {
            name: 'Więcej informacji o rejestrze nadzoru i ścieżce audytowej',
        });
        expect(headerInfoBtn).toBeInTheDocument();

        // 3. Active company badge
        const companyBadge = screen.getByTestId('audit-active-company-badge');
        expect(companyBadge).toHaveTextContent('Acme Manufacturing S.A.');
        expect(companyBadge).toHaveAttribute('tabIndex', '0');

        // 4. Refresh button with accessible label
        const refreshBtn = screen.getByRole('button', { name: 'Odśwież zdarzenia audytowe' });
        expect(refreshBtn).toBeInTheDocument();
    });

    it('renders tab switchers with tooltips and accessible aria-labels', async () => {
        renderComponent();

        await waitFor(() => {
            expect(screen.getByTestId('audit-stat-total')).toBeInTheDocument();
        });

        const financeTab = screen.getByRole('button', { name: 'Audyt Transakcji Finansowych' });
        expect(financeTab).toBeInTheDocument();
        expect(financeTab).toHaveAttribute('data-testid', 'audit-tab-finance');

        const vdrTab = screen.getByRole('button', { name: 'Audyt Dokumentów VDR' });
        expect(vdrTab).toBeInTheDocument();
        expect(vdrTab).toHaveAttribute('data-testid', 'audit-tab-vdr');
    });

    it('renders Finance KPI stat cards with info tooltips and informative badges', async () => {
        renderComponent();

        await waitFor(() => {
            expect(screen.getByTestId('audit-stat-total')).toBeInTheDocument();
            expect(screen.getByText('3 MASOWE')).toBeInTheDocument();
        });

        // 1. Total events info tooltip
        expect(
            screen.getByRole('button', { name: 'Więcej informacji o łącznej liczbie zdarzeń' })
        ).toBeInTheDocument();
        expect(screen.getByText('LIVE')).toBeInTheDocument();

        // 2. Deletions info tooltip and batch badge
        expect(
            screen.getByRole('button', { name: 'Więcej informacji o usunięciach transakcji' })
        ).toBeInTheDocument();
        expect(screen.getByText('3 MASOWE')).toBeInTheDocument();

        // 3. Updates & Imports info tooltip and badge
        expect(
            screen.getByRole('button', { name: 'Więcej informacji o modyfikacjach i importach' })
        ).toBeInTheDocument();
        expect(screen.getByText('ZAPISY')).toBeInTheDocument();

        // 4. Last Event info tooltip and REAL-TIME badge
        expect(
            screen.getByRole('button', { name: 'Więcej informacji o sygnaturze czasowej' })
        ).toBeInTheDocument();
        expect(screen.getByText('REAL-TIME')).toBeInTheDocument();
    });

    it('renders action filter pills with tooltips and accessible aria-labels', async () => {
        renderComponent();

        await waitFor(() => {
            expect(screen.getByTestId('action-pill-all')).toBeInTheDocument();
        });

        expect(screen.getByRole('button', { name: 'Filtruj zdarzenia: Wszystkie' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Filtruj zdarzenia: Usunięcia' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Filtruj zdarzenia: Modyfikacje' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Filtruj zdarzenia: Tworzenie' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Filtruj zdarzenia: Importy CSV' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Filtruj zdarzenia: Cele benchmarkowe' })).toBeInTheDocument();
    });

    it('renders Finance audit table headers and row inspect button with tooltips and preserved titles', async () => {
        renderComponent();

        await waitFor(() => {
            expect(screen.getByTestId('audit-row-inspect-fin-log-1')).toBeInTheDocument();
        });

        // Column headers
        expect(screen.getByText('Sygnatura Czasowa (CET)')).toBeInTheDocument();
        expect(screen.getByText('Zdarzenie / Akcja')).toBeInTheDocument();
        expect(screen.getByText('Opis & Zasób')).toBeInTheDocument();
        expect(screen.getByText('Operator')).toBeInTheDocument();
        expect(screen.getByText('Adres IP')).toBeInTheDocument();
        expect(screen.getByText('Akcje')).toBeInTheDocument();

        // Row inspect button with title and aria-label
        const inspectBtn = screen.getByTestId('audit-row-inspect-fin-log-1');
        expect(inspectBtn).toHaveAttribute('title', 'Podgląd szczegółów i snapshotów JSON');
        expect(inspectBtn).toHaveAttribute('aria-label', 'Podgląd szczegółów i snapshotów JSON');

        // Pagination buttons
        expect(screen.getByRole('button', { name: 'Poprzednia strona' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Następna strona' })).toBeInTheDocument();
    });

    it('renders VDR audit tab with quick stat info buttons, filter action buttons, and table headers', async () => {
        renderComponent();

        await waitFor(() => {
            expect(screen.getByTestId('audit-tab-vdr')).toBeInTheDocument();
        });

        // Switch to VDR tab
        fireEvent.click(screen.getByTestId('audit-tab-vdr'));

        await waitFor(() => {
            expect(screen.getByTestId('vdr-audit-container')).toBeInTheDocument();
        });

        // Info tooltips for 3 quick stats
        expect(screen.getByRole('button', { name: 'Więcej informacji o rejestrze VDR' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Więcej informacji o pobraniach VDR' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Więcej informacji o uploadzie VDR' })).toBeInTheDocument();

        // Filter buttons
        expect(screen.getByRole('button', { name: 'Filtruj zdarzenia VDR: Pobrania' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Filtruj zdarzenia VDR: Wgrania (Upload)' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Filtruj zdarzenia VDR: Modyfikacje' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Filtruj zdarzenia VDR: Usunięcia' })).toBeInTheDocument();

        // Table headers
        expect(screen.getByText('Sygnatura Czasowa')).toBeInTheDocument();
        expect(screen.getByText('Operacja')).toBeInTheDocument();
        expect(screen.getByText('Dokument VDR')).toBeInTheDocument();
        expect(screen.getByText('Tożsamość Operatora')).toBeInTheDocument();

        // Document row title attribute
        expect(screen.getByTitle('Plan Połączenia Spółek 2026.pdf')).toBeInTheDocument();
    });

    it('renders FinancialAuditDetailModal with tooltips, info buttons, and preserved attributes', () => {
        const handleClose = vi.fn();

        render(
            <FinancialAuditDetailModal
                isOpen={true}
                onClose={handleClose}
                log={mockFinanceLogs[0]}
            />
        );

        // Header shield role and aria-label
        expect(screen.getByRole('img', { name: 'Wpis w rejestrze audytowym' })).toBeInTheDocument();

        // Header close button with title and aria-label
        const closeBtn = screen.getByTestId('audit-modal-close-btn');
        expect(closeBtn).toHaveAttribute('title', 'Zamknij');
        expect(closeBtn).toHaveAttribute('aria-label', 'Zamknij');

        // Description banner info tooltip
        expect(screen.getByRole('button', { name: 'Więcej informacji o opisie operacji' })).toBeInTheDocument();

        // Operator profile info tooltip
        expect(screen.getByRole('button', { name: 'Więcej informacji o profilu operatora' })).toBeInTheDocument();

        // Network environment info tooltip
        expect(screen.getByRole('button', { name: 'Więcej informacji o środowisku sieciowym' })).toBeInTheDocument();

        // JSON snapshots info tooltip
        expect(screen.getByRole('button', { name: 'Więcej informacji o zrzutach JSON' })).toBeInTheDocument();

        // Footer close button
        expect(screen.getByRole('button', { name: 'Zamknij podgląd wpisu audytowego' })).toBeInTheDocument();
    });

    it('displays floating tooltip on hover of inspect button in table row', async () => {
        renderComponent();

        await waitFor(() => {
            expect(screen.getByTestId('audit-row-inspect-fin-log-1')).toBeInTheDocument();
        });

        const inspectBtn = screen.getByTestId('audit-row-inspect-fin-log-1');
        fireEvent.mouseEnter(inspectBtn);

        await waitFor(() => {
            const tooltip = screen.getByTestId('floating-tooltip');
            expect(tooltip).toBeInTheDocument();
            expect(tooltip.textContent).toMatch(/Podgląd szczegółów i snapshotów JSON/i);
        });
    });
});
