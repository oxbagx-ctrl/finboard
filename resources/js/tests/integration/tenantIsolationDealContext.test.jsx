import React, { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuthContext } from '../../context/AuthContext';
import { DealProvider, useDeal } from '../../context/DealContext';
import { NotificationProvider } from '../../context/NotificationContext';
import { AuditLogsView } from '../../views/AuditLogsView';
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

// Demo companies
const companyAlpha = {
    id: 'comp-alpha-1',
    name: 'Alpha Corp S.A.',
    code: 'ALPHA',
};

const companyBeta = {
    id: 'comp-beta-2',
    name: 'Beta Holdings Sp. z o.o.',
    code: 'BETA',
};

// Alpha mock data
const alphaAuditLogs = [
    {
        id: 'log-alpha-1',
        company_id: 'comp-alpha-1',
        action: 'RECORD_CREATED',
        action_label: 'Utworzenie faktury Alpha',
        action_color: 'emerald',
        action_category: 'financial_record',
        entity_type: 'financial_record',
        entity_id: 'rec-a-1',
        description: 'Wystawiono fakturę sprzedaży Alpha FV/01/2026',
        old_values: null,
        new_values: { amount: 50000, description: 'FV Alpha' },
        user: { name: 'Jan Alpha', email: 'jan@alpha.com', role: 'admin' },
        ip_address: '10.0.1.1',
        created_at: '2026-03-10T10:00:00Z',
    },
    {
        id: 'log-alpha-2',
        company_id: 'comp-alpha-1',
        action: 'RECORD_DELETED',
        action_label: 'Usunięcie rekordu Alpha',
        action_color: 'rose',
        action_category: 'financial_record',
        entity_type: 'financial_record',
        entity_id: 'rec-a-2',
        description: 'Usunięto stary koszt transportu Alpha',
        old_values: { amount: 12000, category: 'Logistyka' },
        new_values: null,
        user: { name: 'Adam Doradca', email: 'adam@helvest.pl', role: 'advisor' },
        ip_address: '10.0.1.2',
        created_at: '2026-03-11T12:00:00Z',
    },
];

const alphaStats = {
    total_events: 2,
    deletions_count: 1,
    batch_deletions_count: 0,
    by_action: {
        RECORD_CREATED: { count: 1 },
        RECORD_DELETED: { count: 1 },
    },
};

// Beta mock data
const betaAuditLogs = [
    {
        id: 'log-beta-1',
        company_id: 'comp-beta-2',
        action: 'RECORD_UPDATED',
        action_label: 'Modyfikacja wyceny Beta',
        action_color: 'blue',
        action_category: 'financial_record',
        entity_type: 'financial_record',
        entity_id: 'rec-b-1',
        description: 'Zaktualizowano marżę EBITDA dla Beta Holdings',
        old_values: { ebitda: 15.2 },
        new_values: { ebitda: 18.5 },
        user: { name: 'Marek Partner', email: 'marek@helvest.pl', role: 'advisor' },
        ip_address: '10.0.2.1',
        created_at: '2026-03-12T14:00:00Z',
    },
];

const betaStats = {
    total_events: 1,
    deletions_count: 0,
    batch_deletions_count: 0,
    by_action: {
        RECORD_UPDATED: { count: 1 },
    },
};

// Alpha VDR logs
const alphaVdrLogs = [
    {
        id: 'vdr-a-1',
        action: 'upload',
        document_id: 'doc-a-1',
        document_title: 'Sprawozdanie Finansowe Alpha 2025.pdf',
        user: { name: 'Jan Alpha', email: 'jan@alpha.com', role: 'admin' },
        ip_address: '10.0.1.1',
        created_at: '2026-03-01T09:00:00Z',
    },
];

// Beta VDR logs
const betaVdrLogs = [
    {
        id: 'vdr-b-1',
        action: 'download',
        document_id: 'doc-b-1',
        document_title: 'Model LBO Beta Holdings.xlsx',
        user: { name: 'Marek Partner', email: 'marek@helvest.pl', role: 'advisor' },
        ip_address: '10.0.2.1',
        created_at: '2026-03-02T11:30:00Z',
    },
];

// Test Harness Component combining AuthContext, DealProvider, Switcher controls and AuditLogsView
const TenantWorkspaceHarness = ({ initialCompany = companyAlpha }) => {
    const [currentCompany, setCurrentCompany] = useState(initialCompany);

    const switchCompany = (comp) => {
        setCurrentCompany(comp);
        window.dispatchEvent(new CustomEvent('finboard:company-changed', { detail: comp }));
    };

    const authContextValue = {
        user: { id: 'usr-1', name: 'Adam Doradca', role: 'advisor' },
        token: 'mock-jwt-token',
        activeCompany: currentCompany,
        availableCompanies: [companyAlpha, companyBeta],
        switchCompany,
        isAuthenticated: true,
        loading: false,
    };

    return (
        <NotificationProvider>
            <AuthContext.Provider value={authContextValue}>
                <DealProvider>
                    <TenantWorkspaceInner />
                </DealProvider>
            </AuthContext.Provider>
        </NotificationProvider>
    );
};

// Inner component with access to DealContext
const TenantWorkspaceInner = () => {
    const { activeCompany, switchCompany, dealMetadata } = useDeal();

    return (
        <div>
            {/* Deal Context Info & Company Switcher */}
            <div className="flex items-center gap-4 p-2 bg-zinc-900 border-b border-zinc-800 text-xs">
                <span data-testid="deal-project-code">{dealMetadata.code}</span>
                <span data-testid="deal-active-company">{activeCompany?.name || 'Brak'}</span>
                <button
                    onClick={() => switchCompany(companyBeta)}
                    data-testid="switch-to-beta-btn"
                >
                    Przełącz na Beta
                </button>
                <button
                    onClick={() => switchCompany(companyAlpha)}
                    data-testid="switch-to-alpha-btn"
                >
                    Przełącz na Alpha
                </button>
                <button
                    onClick={() => switchCompany(null)}
                    data-testid="switch-to-null-btn"
                >
                    Odłącz Spółkę
                </button>
            </div>

            {/* Audit Logs View Component */}
            <AuditLogsView />
        </div>
    );
};

describe('Tenant Isolation and Company Switching via DealContext Integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Default mock routing based on company_id param
        apiClient.get.mockImplementation((url, config = {}) => {
            const params = config.params || {};
            const companyId = params.company_id;

            if (url === '/finance/analytics/years') {
                return Promise.resolve({ data: { data: ['2026', '2025'] } });
            }

            if (url === '/finance/audit-logs/stats') {
                if (companyId === 'comp-alpha-1') {
                    return Promise.resolve({ data: { data: alphaStats } });
                }
                if (companyId === 'comp-beta-2') {
                    return Promise.resolve({ data: { data: betaStats } });
                }
                return Promise.resolve({ data: { data: null } });
            }

            if (url === '/finance/audit-logs') {
                if (companyId === 'comp-alpha-1') {
                    return Promise.resolve({
                        data: {
                            data: alphaAuditLogs,
                            meta: { current_page: 1, last_page: 1, total: 2, per_page: 25 },
                        },
                    });
                }
                if (companyId === 'comp-beta-2') {
                    return Promise.resolve({
                        data: {
                            data: betaAuditLogs,
                            meta: { current_page: 1, last_page: 1, total: 1, per_page: 25 },
                        },
                    });
                }
                return Promise.resolve({ data: { data: [], meta: null } });
            }

            if (url === '/documents/audit-logs') {
                if (companyId === 'comp-alpha-1') {
                    return Promise.resolve({
                        data: {
                            data: alphaVdrLogs,
                            meta: { current_page: 1, last_page: 1, total: 1, per_page: 25 },
                        },
                    });
                }
                if (companyId === 'comp-beta-2') {
                    return Promise.resolve({
                        data: {
                            data: betaVdrLogs,
                            meta: { current_page: 1, last_page: 1, total: 1, per_page: 25 },
                        },
                    });
                }
                return Promise.resolve({ data: { data: [], meta: null } });
            }

            return Promise.reject(new Error(`Unhandled URL: ${url}`));
        });
    });

    it('orchestrates complete tenant isolation when switching from Alpha to Beta in DealContext', async () => {
        render(<TenantWorkspaceHarness initialCompany={companyAlpha} />);

        // 1. Initial State: Company Alpha is active
        expect(screen.getByTestId('deal-active-company')).toHaveTextContent('Alpha Corp S.A.');
        expect(screen.getByTestId('audit-active-company-badge')).toHaveTextContent('Alpha Corp S.A.');

        await waitFor(() => {
            expect(screen.getByTestId('finance-audit-row-log-alpha-1')).toBeInTheDocument();
            expect(screen.getByTestId('finance-audit-row-log-alpha-2')).toBeInTheDocument();
        });

        expect(screen.getByText('Wystawiono fakturę sprzedaży Alpha FV/01/2026')).toBeInTheDocument();
        expect(screen.getByText('Usunięto stary koszt transportu Alpha')).toBeInTheDocument();
        expect(screen.getByTestId('audit-stat-total')).toHaveTextContent('2');

        // Verify API was called strictly with company_id: comp-alpha-1
        expect(apiClient.get).toHaveBeenCalledWith(
            '/finance/audit-logs',
            expect.objectContaining({ params: expect.objectContaining({ company_id: 'comp-alpha-1' }) })
        );

        // 2. Open Detail Modal for Alpha log
        fireEvent.click(screen.getByTestId('audit-row-inspect-log-alpha-1'));
        expect(screen.getByTestId('financial-audit-detail-modal')).toBeInTheDocument();
        expect(screen.getByTestId('audit-modal-action-badge')).toHaveTextContent('Utworzenie faktury Alpha');

        // 3. Switch Tenant to Company Beta via DealContext button
        fireEvent.click(screen.getByTestId('switch-to-beta-btn'));

        // 4. Verify Immediate Modal Cleanup & State Cleansing
        await waitFor(() => {
            // Modal for Alpha must be closed immediately
            expect(screen.queryByTestId('financial-audit-detail-modal')).not.toBeInTheDocument();
            // Active company badge reflects Beta
            expect(screen.getByTestId('audit-active-company-badge')).toHaveTextContent('Beta Holdings Sp. z o.o.');
            expect(screen.getByTestId('deal-project-code')).toHaveTextContent('PROJECT-BETA');
        });

        // 5. Verify Table strictly renders Beta logs and completely unmounts Alpha logs
        await waitFor(() => {
            expect(screen.getByTestId('finance-audit-row-log-beta-1')).toBeInTheDocument();
            expect(screen.queryByTestId('finance-audit-row-log-alpha-1')).not.toBeInTheDocument();
            expect(screen.queryByTestId('finance-audit-row-log-alpha-2')).not.toBeInTheDocument();
        });

        expect(screen.getByText('Zaktualizowano marżę EBITDA dla Beta Holdings')).toBeInTheDocument();
        expect(screen.queryByText('Wystawiono fakturę sprzedaży Alpha FV/01/2026')).not.toBeInTheDocument();

        // 6. Verify KPI stat cards update to Beta metrics
        expect(screen.getByTestId('audit-stat-total')).toHaveTextContent('1');

        // 7. Verify API was called strictly with company_id: comp-beta-2
        expect(apiClient.get).toHaveBeenCalledWith(
            '/finance/audit-logs',
            expect.objectContaining({ params: expect.objectContaining({ company_id: 'comp-beta-2' }) })
        );
        expect(apiClient.get).toHaveBeenCalledWith(
            '/finance/audit-logs/stats',
            expect.objectContaining({ params: expect.objectContaining({ company_id: 'comp-beta-2' }) })
        );
    });

    it('isolates VDR document audit records across companies upon switching', async () => {
        render(<TenantWorkspaceHarness initialCompany={companyAlpha} />);

        // Switch to VDR tab
        fireEvent.click(screen.getByTestId('audit-tab-vdr'));

        await waitFor(() => {
            expect(screen.getByText('Sprawozdanie Finansowe Alpha 2025.pdf')).toBeInTheDocument();
        });

        expect(apiClient.get).toHaveBeenCalledWith(
            '/documents/audit-logs',
            expect.objectContaining({ params: expect.objectContaining({ company_id: 'comp-alpha-1' }) })
        );

        // Switch company to Beta while in VDR tab
        fireEvent.click(screen.getByTestId('switch-to-beta-btn'));

        await waitFor(() => {
            expect(screen.getByText('Model LBO Beta Holdings.xlsx')).toBeInTheDocument();
            expect(screen.queryByText('Sprawozdanie Finansowe Alpha 2025.pdf')).not.toBeInTheDocument();
        });

        expect(apiClient.get).toHaveBeenCalledWith(
            '/documents/audit-logs',
            expect.objectContaining({ params: expect.objectContaining({ company_id: 'comp-beta-2' }) })
        );
    });

    it('clears all data and displays prominent warning when activeCompany becomes null', async () => {
        render(<TenantWorkspaceHarness initialCompany={companyAlpha} />);

        await waitFor(() => {
            expect(screen.getByTestId('finance-audit-row-log-alpha-1')).toBeInTheDocument();
        });

        // Disconnect / De-select company
        fireEvent.click(screen.getByTestId('switch-to-null-btn'));

        await waitFor(() => {
            expect(screen.getByTestId('audit-no-company-state')).toBeInTheDocument();
            expect(screen.queryByTestId('finance-audit-row-log-alpha-1')).not.toBeInTheDocument();
            expect(screen.queryByTestId('finance-audit-row-log-alpha-2')).not.toBeInTheDocument();
        });

        expect(screen.getByText('Brak wybranego podmiotu (spółki portfelowej)')).toBeInTheDocument();
        expect(screen.getByTestId('audit-active-company-badge')).toHaveTextContent('Brak wybranej spółki');
    });

    it('gracefully handles 403 Forbidden cross-tenant access rejection without data leakage', async () => {
        // Mock 403 Access Denied for companyBeta
        apiClient.get.mockImplementation((url, config = {}) => {
            const params = config.params || {};
            if (params.company_id === 'comp-beta-2') {
                return Promise.reject({
                    response: {
                        status: 403,
                        data: { message: 'Doradca nie jest przypisany do wskazanej firmy.' },
                    },
                });
            }
            if (params.company_id === 'comp-alpha-1') {
                return Promise.resolve({
                    data: {
                        data: alphaAuditLogs,
                        meta: { current_page: 1, last_page: 1, total: 2, per_page: 25 },
                    },
                });
            }
            return Promise.resolve({ data: { data: [] } });
        });

        render(<TenantWorkspaceHarness initialCompany={companyAlpha} />);

        await waitFor(() => {
            expect(screen.getByTestId('finance-audit-row-log-alpha-1')).toBeInTheDocument();
        });

        // Switch to unauthorized Beta company
        fireEvent.click(screen.getByTestId('switch-to-beta-btn'));

        // Alpha records must be cleared immediately, no Beta records rendered
        await waitFor(() => {
            expect(screen.queryByTestId('finance-audit-row-log-alpha-1')).not.toBeInTheDocument();
            expect(screen.queryByTestId('finance-audit-row-log-beta-1')).not.toBeInTheDocument();
        });

        // Notification error is rendered
        await waitFor(() => {
            expect(screen.getByText('Nie udało się pobrać księgi audytowej transakcji finansowych.')).toBeInTheDocument();
        });
    });
});

