import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
    id: 'comp-acme-vdr',
    name: 'Acme Advisory VDR Sp. z o.o.',
    code: 'ACME_VDR',
};

const mockVdrLogs = [
    {
        id: 'vdr-log-1',
        action: 'upload',
        document_id: 'doc-001',
        document_title: 'Sprawozdanie Finansowe 2025.pdf',
        user: { name: 'Katarzyna Nowak', email: 'katarzyna@acme.com', role: 'admin' },
        ip_address: '192.168.1.10',
        created_at: '2026-03-01T10:00:00Z',
    },
    {
        id: 'vdr-log-2',
        action: 'download',
        document_id: 'doc-002',
        document_title: 'Polityka Bezpieczeństwa VDR.pdf',
        user: { name: 'Marek Doradca', email: 'marek@helvest.pl', role: 'advisor' },
        ip_address: '10.0.0.55',
        created_at: '2026-03-02T12:00:00Z',
    },
    {
        id: 'vdr-log-3',
        action: 'archive',
        document_id: 'doc-003',
        document_title: 'Stara Umowa Pożyczki 2023.docx',
        user: { name: 'Piotr Dyrektor', email: 'piotr@acme.com', role: 'admin' },
        ip_address: '192.168.1.25',
        created_at: '2026-03-03T14:30:00Z',
    },
    {
        id: 'vdr-log-4',
        action: 'unarchive',
        document_id: 'doc-004',
        document_title: 'Archiwalny Protokół ZWZA.pdf',
        user: { name: 'Katarzyna Nowak', email: 'katarzyna@acme.com', role: 'admin' },
        ip_address: '192.168.1.10',
        created_at: '2026-03-04T16:00:00Z',
    },
];

// Helper to render AuditLogsView in VDR tab
const renderVdrAudit = () => {
    const authContextValue = {
        user: { id: 'usr-1', name: 'Marek Doradca', role: 'advisor' },
        token: 'test-token',
        activeCompany: mockCompany,
        availableCompanies: [mockCompany],
        switchCompany: vi.fn(),
        isAuthenticated: true,
        loading: false,
    };

    return render(
        <NotificationProvider>
            <AuthContext.Provider value={authContextValue}>
                <AuditLogsView />
            </AuthContext.Provider>
        </NotificationProvider>
    );
};

describe('VDR Document Audit Regression Tests: Pagination & Filtering', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        apiClient.get.mockImplementation((url, config = {}) => {
            if (url === '/documents/audit-logs') {
                let filtered = [...mockVdrLogs];
                const action = config?.params?.action;
                const search = config?.params?.search;
                const page = config?.params?.page || 1;

                if (action) {
                    filtered = filtered.filter((l) => l.action === action);
                }
                if (search) {
                    const q = search.toLowerCase();
                    filtered = filtered.filter(
                        (l) =>
                            l.document_title?.toLowerCase().includes(q) ||
                            l.user?.name?.toLowerCase().includes(q) ||
                            l.user?.email?.toLowerCase().includes(q) ||
                            l.ip_address?.includes(q)
                    );
                }

                return Promise.resolve({
                    data: {
                        data: filtered,
                        meta: {
                            current_page: page,
                            last_page: 1,
                            total: filtered.length,
                            per_page: 25,
                        },
                    },
                });
            }
            if (url === '/finance/audit-logs/stats') {
                return Promise.resolve({ data: { data: { total_events: 0, by_action: {} } } });
            }
            if (url === '/finance/audit-logs') {
                return Promise.resolve({ data: { data: [], meta: { current_page: 1, last_page: 1, total: 0 } } });
            }
            return Promise.reject(new Error(`Unhandled URL: ${url}`));
        });
    });

    it('filters VDR audit logs by action categories (Upload, Download, Archive, Unarchive)', async () => {
        renderVdrAudit();

        // Switch to VDR tab
        fireEvent.click(screen.getByTestId('audit-tab-vdr'));

        await waitFor(() => {
            expect(screen.getByText('Sprawozdanie Finansowe 2025.pdf')).toBeInTheDocument();
            expect(screen.getByText('Polityka Bezpieczeństwa VDR.pdf')).toBeInTheDocument();
            expect(screen.getByText('Stara Umowa Pożyczki 2023.docx')).toBeInTheDocument();
            expect(screen.getByText('Archiwalny Protokół ZWZA.pdf')).toBeInTheDocument();
        });

        // 1. Filter: Pobrania (download)
        fireEvent.click(screen.getByText('Pobrania'));

        await waitFor(() => {
            expect(screen.getByText('Polityka Bezpieczeństwa VDR.pdf')).toBeInTheDocument();
            expect(screen.queryByText('Sprawozdanie Finansowe 2025.pdf')).not.toBeInTheDocument();
            expect(screen.queryByText('Stara Umowa Pożyczki 2023.docx')).not.toBeInTheDocument();
            expect(screen.queryByText('Archiwalny Protokół ZWZA.pdf')).not.toBeInTheDocument();
        });

        // 2. Filter: Wgrania (Upload)
        fireEvent.click(screen.getByText('Wgrania (Upload)'));

        await waitFor(() => {
            expect(screen.getByText('Sprawozdanie Finansowe 2025.pdf')).toBeInTheDocument();
            expect(screen.queryByText('Polityka Bezpieczeństwa VDR.pdf')).not.toBeInTheDocument();
        });

        // 3. Filter: Archiwizacje
        fireEvent.click(screen.getByText('Archiwizacje'));

        await waitFor(() => {
            expect(screen.getByText('Stara Umowa Pożyczki 2023.docx')).toBeInTheDocument();
            expect(screen.queryByText('Sprawozdanie Finansowe 2025.pdf')).not.toBeInTheDocument();
        });

        // 4. Filter: Przywrócenia
        fireEvent.click(screen.getByText('Przywrócenia'));

        await waitFor(() => {
            expect(screen.getByText('Archiwalny Protokół ZWZA.pdf')).toBeInTheDocument();
            expect(screen.queryByText('Stara Umowa Pożyczki 2023.docx')).not.toBeInTheDocument();
        });

        // 5. Restore: Wszystkie Zdarzenia
        fireEvent.click(screen.getByText('Wszystkie Zdarzenia'));

        await waitFor(() => {
            expect(screen.getByText('Sprawozdanie Finansowe 2025.pdf')).toBeInTheDocument();
            expect(screen.getByText('Polityka Bezpieczeństwa VDR.pdf')).toBeInTheDocument();
            expect(screen.getByText('Stara Umowa Pożyczki 2023.docx')).toBeInTheDocument();
            expect(screen.getByText('Archiwalny Protokół ZWZA.pdf')).toBeInTheDocument();
        });
    });

    it('searches VDR audit records across title, operator, email, and IP address', async () => {
        renderVdrAudit();

        fireEvent.click(screen.getByTestId('audit-tab-vdr'));

        await waitFor(() => {
            expect(screen.getByText('Sprawozdanie Finansowe 2025.pdf')).toBeInTheDocument();
        });

        const searchInput = screen.getByPlaceholderText('Szukaj po dokumencie, użytkowniku lub IP...');

        // 1. Search by document title
        fireEvent.change(searchInput, { target: { value: 'Bezpieczeństwa' } });

        await waitFor(() => {
            expect(screen.getByText('Polityka Bezpieczeństwa VDR.pdf')).toBeInTheDocument();
            expect(screen.queryByText('Sprawozdanie Finansowe 2025.pdf')).not.toBeInTheDocument();
        });

        // 2. Search by operator email
        fireEvent.change(searchInput, { target: { value: 'katarzyna@acme.com' } });

        await waitFor(() => {
            expect(screen.getByText('Sprawozdanie Finansowe 2025.pdf')).toBeInTheDocument();
            expect(screen.getByText('Archiwalny Protokół ZWZA.pdf')).toBeInTheDocument();
            expect(screen.queryByText('Polityka Bezpieczeństwa VDR.pdf')).not.toBeInTheDocument();
        });

        // 3. Search by IP address
        fireEvent.change(searchInput, { target: { value: '10.0.0.55' } });

        await waitFor(() => {
            expect(screen.getByText('Polityka Bezpieczeństwa VDR.pdf')).toBeInTheDocument();
            expect(screen.queryByText('Sprawozdanie Finansowe 2025.pdf')).not.toBeInTheDocument();
        });

        // 4. Clear search via X button
        const clearBtn = searchInput.parentElement.querySelector('button');
        expect(clearBtn).toBeInTheDocument();
        fireEvent.click(clearBtn);

        await waitFor(() => {
            expect(searchInput).toHaveValue('');
            expect(screen.getByText('Sprawozdanie Finansowe 2025.pdf')).toBeInTheDocument();
            expect(screen.getByText('Stara Umowa Pożyczki 2023.docx')).toBeInTheDocument();
        });
    });

    it('renders empty filtered state and restores full dataset on clear filters click', async () => {
        renderVdrAudit();

        fireEvent.click(screen.getByTestId('audit-tab-vdr'));

        await waitFor(() => {
            expect(screen.getByText('Sprawozdanie Finansowe 2025.pdf')).toBeInTheDocument();
        });

        const searchInput = screen.getByPlaceholderText('Szukaj po dokumencie, użytkowniku lub IP...');
        fireEvent.change(searchInput, { target: { value: 'nieistniejacy_plik_vdr_999' } });

        await waitFor(() => {
            expect(screen.getByTestId('vdr-audit-empty')).toBeInTheDocument();
            expect(screen.getByText('Brak zdarzeń audytowych VDR pasujących do wybranych filtrów')).toBeInTheDocument();
        });

        // Click "Wyczyść filtry" button
        const clearFiltersBtn = screen.getByTestId('vdr-clear-filters-btn');
        fireEvent.click(clearFiltersBtn);

        await waitFor(() => {
            expect(screen.queryByTestId('vdr-audit-empty')).not.toBeInTheDocument();
            expect(screen.getByText('Sprawozdanie Finansowe 2025.pdf')).toBeInTheDocument();
            expect(screen.getByText('Polityka Bezpieczeństwa VDR.pdf')).toBeInTheDocument();
        });
    });

    it('executes multi-page pagination navigation and enforces boundary controls', async () => {
        const page1Records = Array.from({ length: 25 }, (_, i) => ({
            id: `vdr-p1-${i + 1}`,
            action: 'download',
            document_id: `doc-${i + 1}`,
            document_title: `Dokument Strony 1 #${i + 1}.pdf`,
            user: { name: 'Jan Audytor', email: 'jan@acme.com', role: 'advisor' },
            ip_address: '10.0.0.1',
            created_at: '2026-03-01T10:00:00Z',
        }));

        const page2Records = Array.from({ length: 25 }, (_, i) => ({
            id: `vdr-p2-${i + 1}`,
            action: 'upload',
            document_id: `doc-p2-${i + 1}`,
            document_title: `Dokument Strony 2 #${i + 1}.pdf`,
            user: { name: 'Anna Dyrektor', email: 'anna@acme.com', role: 'admin' },
            ip_address: '10.0.0.2',
            created_at: '2026-03-02T11:00:00Z',
        }));

        const page3Records = Array.from({ length: 10 }, (_, i) => ({
            id: `vdr-p3-${i + 1}`,
            action: 'archive',
            document_id: `doc-p3-${i + 1}`,
            document_title: `Dokument Strony 3 #${i + 1}.pdf`,
            user: { name: 'Piotr Zarząd', email: 'piotr@acme.com', role: 'admin' },
            ip_address: '10.0.0.3',
            created_at: '2026-03-03T12:00:00Z',
        }));

        apiClient.get.mockImplementation((url, config = {}) => {
            if (url === '/documents/audit-logs') {
                const page = config.params?.page || 1;
                let data = page1Records;
                if (page === 2) data = page2Records;
                if (page === 3) data = page3Records;

                return Promise.resolve({
                    data: {
                        data,
                        meta: {
                            current_page: page,
                            last_page: 3,
                            total: 60,
                            per_page: 25,
                        },
                    },
                });
            }
            if (url === '/finance/audit-logs/stats') {
                return Promise.resolve({ data: { data: { total_events: 0, by_action: {} } } });
            }
            if (url === '/finance/audit-logs') {
                return Promise.resolve({ data: { data: [], meta: { current_page: 1, last_page: 1, total: 0 } } });
            }
            return Promise.reject(new Error(`Unhandled URL: ${url}`));
        });

        renderVdrAudit();

        fireEvent.click(screen.getByTestId('audit-tab-vdr'));

        await waitFor(() => {
            expect(apiClient.get).toHaveBeenCalledWith('/documents/audit-logs', expect.anything());
        });

        // 1. Page 1 initial assertions
        await waitFor(() => {
            expect(screen.getByText('Dokument Strony 1 #1.pdf')).toBeInTheDocument();
            expect(screen.getByText('Strona 1 z 3')).toBeInTheDocument();
            expect(screen.getByText(/Wpisy audytowe:/)).toHaveTextContent('60');
        });

        const prevButton = screen.getByText('Poprzednia');
        const nextButton = screen.getByText('Następna');

        // On page 1: previous button is disabled, next is enabled
        expect(prevButton).toBeDisabled();
        expect(nextButton).not.toBeDisabled();

        // 2. Click "Następna" to go to Page 2
        fireEvent.click(nextButton);

        await waitFor(() => {
            expect(apiClient.get).toHaveBeenCalledWith('/documents/audit-logs', {
                params: { page: 2, per_page: 25, company_id: 'comp-acme-vdr' },
            });
            expect(screen.getByText('Dokument Strony 2 #1.pdf')).toBeInTheDocument();
            expect(screen.getByText('Strona 2 z 3')).toBeInTheDocument();
        });

        // On page 2: both previous and next buttons are enabled
        expect(prevButton).not.toBeDisabled();
        expect(nextButton).not.toBeDisabled();

        // 3. Click "Następna" to go to Page 3 (last page)
        fireEvent.click(nextButton);

        await waitFor(() => {
            expect(apiClient.get).toHaveBeenCalledWith('/documents/audit-logs', {
                params: { page: 3, per_page: 25, company_id: 'comp-acme-vdr' },
            });
            expect(screen.getByText('Dokument Strony 3 #1.pdf')).toBeInTheDocument();
            expect(screen.getByText('Strona 3 z 3')).toBeInTheDocument();
        });

        // On page 3: next button is disabled, previous is enabled
        expect(nextButton).toBeDisabled();
        expect(prevButton).not.toBeDisabled();

        // 4. Click "Poprzednia" to navigate back to Page 2
        fireEvent.click(prevButton);

        await waitFor(() => {
            expect(apiClient.get).toHaveBeenCalledWith('/documents/audit-logs', {
                params: { page: 2, per_page: 25, company_id: 'comp-acme-vdr' },
            });
            expect(screen.getByText('Dokument Strony 2 #1.pdf')).toBeInTheDocument();
            expect(screen.getByText('Strona 2 z 3')).toBeInTheDocument();
        });
    });
});
