import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RecordsView } from '../../views/RecordsView';
import { NotificationProvider } from '../../context/NotificationContext';
import { AuthContext } from '../../context/AuthContext';
import { DealProvider } from '../../context/DealContext';
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

const mockCategories = [
    { id: 'cat-rev-1', code: 'REV-01', name: 'Sprzedaż maszyn', type: 'revenue' },
    { id: 'cat-opex-1', code: 'OPEX-01', name: 'Wynagrodzenia', type: 'expense' },
];

const mockRecords = [
    {
        id: 'rec-001',
        company_id: 'comp-acme-1',
        record_date: '2026-03-01',
        category_id: 'cat-rev-1',
        category: mockCategories[0],
        record_type: 'revenue',
        amount: 25000,
        currency: 'PLN',
        description: 'Płatność za maszyny produkcyjne',
        source: 'manual',
    },
    {
        id: 'rec-002',
        company_id: 'comp-acme-1',
        record_date: '2026-03-05',
        category_id: 'cat-opex-1',
        category: mockCategories[1],
        record_type: 'expense',
        amount: 8000,
        currency: 'PLN',
        description: 'Wynagrodzenia działu technicznego',
        source: 'manual',
    },
];

const renderWithProviders = (ui) => {
    return render(
        <NotificationProvider>
            <AuthContext.Provider
                value={{
                    user: { id: 'u-1', name: 'Jan Dyrektor', role: 'admin' },
                    activeCompany: mockCompany,
                    isAdmin: true,
                    isSuperAdmin: false,
                    isAdvisor: false,
                }}
            >
                <DealProvider>
                    {ui}
                </DealProvider>
            </AuthContext.Provider>
        </NotificationProvider>
    );
};

describe('RecordsView - Batch Selection and Deletion Integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        apiClient.get.mockImplementation((url) => {
            if (url === '/finance/categories') {
                return Promise.resolve({ data: { data: mockCategories } });
            }
            if (url.startsWith('/finance/records')) {
                return Promise.resolve({
                    data: {
                        data: mockRecords,
                        meta: {
                            current_page: 1,
                            last_page: 1,
                            per_page: 25,
                            total: 2,
                            from: 1,
                            to: 2,
                        },
                    },
                });
            }
            return Promise.resolve({ data: {} });
        });

        apiClient.delete.mockImplementation((url) => {
            if (url === '/finance/records/batch') {
                return Promise.resolve({
                    data: {
                        status: 'deleted',
                        count: 2,
                        total_amount: 33000,
                        message: 'Pomyślnie usunięto 2 operacji finansowych.',
                    },
                });
            }
            return Promise.resolve({ data: {} });
        });
    });

    it('loads and displays initial records and categories', async () => {
        renderWithProviders(<RecordsView />);

        await waitFor(() => {
            expect(screen.getByText('Płatność za maszyny produkcyjne')).toBeInTheDocument();
            expect(screen.getByText('Wynagrodzenia działu technicznego')).toBeInTheDocument();
        });

        expect(screen.queryByTestId('batch-action-bar')).toBeNull();
        expect(screen.getByTestId('batch-master-checkbox')).not.toBeChecked();
    });

    it('toggles single row selection and shows floating BatchActionBar', async () => {
        renderWithProviders(<RecordsView />);

        await waitFor(() => {
            expect(screen.getByText('Płatność za maszyny produkcyjne')).toBeInTheDocument();
        });

        const checkbox1 = screen.getByTestId('record-checkbox-rec-001');
        expect(checkbox1).not.toBeChecked();

        fireEvent.click(checkbox1);
        expect(checkbox1).toBeChecked();

        // Batch action bar appears
        expect(screen.getByTestId('batch-action-bar')).toBeInTheDocument();
        expect(screen.getByTestId('batch-selected-count')).toHaveTextContent('1');
        expect(screen.getByTestId('batch-total-amount')).toHaveTextContent(/25[\s\u00A0]?000,00[\s\u00A0]?zł/);

        // Uncheck row removes action bar
        fireEvent.click(checkbox1);
        expect(checkbox1).not.toBeChecked();
        expect(screen.queryByTestId('batch-action-bar')).toBeNull();
    });

    it('selects all rows with master checkbox and clears selection via action bar button', async () => {
        renderWithProviders(<RecordsView />);

        await waitFor(() => {
            expect(screen.getByText('Płatność za maszyny produkcyjne')).toBeInTheDocument();
        });

        const masterCheckbox = screen.getByTestId('batch-master-checkbox');
        fireEvent.click(masterCheckbox);

        expect(masterCheckbox).toBeChecked();
        expect(screen.getByTestId('record-checkbox-rec-001')).toBeChecked();
        expect(screen.getByTestId('record-checkbox-rec-002')).toBeChecked();

        expect(screen.getByTestId('batch-action-bar')).toBeInTheDocument();
        expect(screen.getByTestId('batch-selected-count')).toHaveTextContent('2');

        // Click Clear selection in BatchActionBar
        const clearBtn = screen.getByTestId('batch-clear-btn');
        fireEvent.click(clearBtn);

        expect(screen.queryByTestId('batch-action-bar')).toBeNull();
        expect(masterCheckbox).not.toBeChecked();
        expect(screen.getByTestId('record-checkbox-rec-001')).not.toBeChecked();
        expect(screen.getByTestId('record-checkbox-rec-002')).not.toBeChecked();
    });

    it('opens batch delete confirmation modal and can cancel it', async () => {
        renderWithProviders(<RecordsView />);

        await waitFor(() => {
            expect(screen.getByText('Płatność za maszyny produkcyjne')).toBeInTheDocument();
        });

        // Select first row
        fireEvent.click(screen.getByTestId('record-checkbox-rec-001'));

        // Click Delete button in action bar
        fireEvent.click(screen.getByTestId('batch-delete-btn'));

        // Modal is open
        expect(screen.getByTestId('batch-delete-modal')).toBeInTheDocument();
        expect(screen.getByTestId('batch-modal-count')).toHaveTextContent('1');

        // Click cancel button inside modal
        fireEvent.click(screen.getByTestId('batch-modal-cancel-btn'));

        // Modal closed
        expect(screen.queryByTestId('batch-delete-modal')).toBeNull();
        // Selection remains
        expect(screen.getByTestId('batch-action-bar')).toBeInTheDocument();
    });

    it('executes batch delete via API and applies optimistic UI update', async () => {
        renderWithProviders(<RecordsView />);

        await waitFor(() => {
            expect(screen.getByText('Płatność za maszyny produkcyjne')).toBeInTheDocument();
        });

        // Select all rows
        fireEvent.click(screen.getByTestId('batch-master-checkbox'));
        expect(screen.getByTestId('batch-selected-count')).toHaveTextContent('2');

        // Open delete modal
        fireEvent.click(screen.getByTestId('batch-delete-btn'));
        expect(screen.getByTestId('batch-delete-modal')).toBeInTheDocument();

        // Confirm deletion (count <= 10, no keyword required)
        const confirmBtn = screen.getByTestId('batch-confirm-delete-btn');
        fireEvent.click(confirmBtn);

        await waitFor(() => {
            expect(apiClient.delete).toHaveBeenCalledWith('/finance/records/batch', {
                data: { record_ids: ['rec-001', 'rec-002'] },
            });
        });

        // Modal closed and selection reset
        await waitFor(() => {
            expect(screen.queryByTestId('batch-delete-modal')).toBeNull();
            expect(screen.queryByTestId('batch-action-bar')).toBeNull();
        });
    });

    it('enforces safety keyword "USUŃ" when batch size exceeds 10 records', async () => {
        // Mock 12 records
        const manyRecords = Array.from({ length: 12 }, (_, i) => ({
            id: `rec-${i + 1}`,
            company_id: 'comp-acme-1',
            record_date: '2026-03-01',
            category_id: 'cat-rev-1',
            category: mockCategories[0],
            record_type: 'revenue',
            amount: 1000,
            currency: 'PLN',
            description: `Transakcja hurtowa #${i + 1}`,
            source: 'manual',
        }));

        apiClient.get.mockImplementation((url) => {
            if (url === '/finance/categories') {
                return Promise.resolve({ data: { data: mockCategories } });
            }
            if (url.startsWith('/finance/records')) {
                return Promise.resolve({
                    data: {
                        data: manyRecords,
                        meta: { current_page: 1, last_page: 1, per_page: 25, total: 12, from: 1, to: 12 },
                    },
                });
            }
            return Promise.resolve({ data: {} });
        });

        renderWithProviders(<RecordsView />);

        await waitFor(() => {
            expect(screen.getByText('Transakcja hurtowa #1')).toBeInTheDocument();
        });

        // Select all 12
        fireEvent.click(screen.getByTestId('batch-master-checkbox'));
        expect(screen.getByTestId('batch-selected-count')).toHaveTextContent('12');

        // Open modal
        fireEvent.click(screen.getByTestId('batch-delete-btn'));

        expect(screen.getByTestId('batch-delete-modal')).toBeInTheDocument();
        expect(screen.getByTestId('batch-keyword-section')).toBeInTheDocument();

        const confirmBtn = screen.getByTestId('batch-confirm-delete-btn');
        expect(confirmBtn).toBeDisabled();

        // Type keyword "USUŃ"
        const input = screen.getByTestId('batch-confirm-input');
        fireEvent.change(input, { target: { value: 'USUŃ' } });

        expect(confirmBtn).not.toBeDisabled();

        fireEvent.click(confirmBtn);

        await waitFor(() => {
            expect(apiClient.delete).toHaveBeenCalledWith('/finance/records/batch', {
                data: { record_ids: manyRecords.map((r) => r.id) },
            });
        });
    });

    it('maintains selections and accumulates metrics across pagination navigation', async () => {
        const page1Record = {
            id: 'rec-p1',
            company_id: 'comp-acme-1',
            record_date: '2026-03-01',
            category_id: 'cat-rev-1',
            category: mockCategories[0],
            record_type: 'revenue',
            amount: 10000,
            currency: 'PLN',
            description: 'Przychód Strona 1',
            source: 'manual',
        };

        const page2Record = {
            id: 'rec-p2',
            company_id: 'comp-acme-1',
            record_date: '2026-03-02',
            category_id: 'cat-opex-1',
            category: mockCategories[1],
            record_type: 'expense',
            amount: 4000,
            currency: 'PLN',
            description: 'Koszt Strona 2',
            source: 'manual',
        };

        apiClient.get.mockImplementation((url, config) => {
            if (url === '/finance/categories') {
                return Promise.resolve({ data: { data: mockCategories } });
            }
            if (url.startsWith('/finance/records')) {
                const requestedPage = config?.params?.page || 1;
                const data = requestedPage === 2 ? [page2Record] : [page1Record];
                return Promise.resolve({
                    data: {
                        data,
                        meta: {
                            current_page: requestedPage,
                            last_page: 2,
                            per_page: 1,
                            total: 2,
                            from: requestedPage,
                            to: requestedPage,
                        },
                    },
                });
            }
            return Promise.resolve({ data: {} });
        });

        renderWithProviders(<RecordsView />);

        // Wait for page 1 to load
        await waitFor(() => {
            expect(screen.getByText('Przychód Strona 1')).toBeInTheDocument();
        });

        // Select record on page 1
        fireEvent.click(screen.getByTestId('record-checkbox-rec-p1'));
        expect(screen.getByTestId('batch-selected-count')).toHaveTextContent('1');
        expect(screen.getByTestId('batch-total-amount')).toHaveTextContent(/10[\s\u00A0]?000,00[\s\u00A0]?zł/);

        // Navigate to page 2
        const nextBtn = screen.getByRole('button', { name: /Następna/i });
        fireEvent.click(nextBtn);

        // Wait for page 2 to load
        await waitFor(() => {
            expect(screen.getByText('Koszt Strona 2')).toBeInTheDocument();
        });

        // Selection from page 1 is preserved in action bar
        expect(screen.getByTestId('batch-action-bar')).toBeInTheDocument();
        expect(screen.getByTestId('batch-selected-count')).toHaveTextContent('1');

        // Select record on page 2
        fireEvent.click(screen.getByTestId('record-checkbox-rec-p2'));

        // Action bar now accumulates both page 1 and page 2: 10000 + 4000 = 14000
        expect(screen.getByTestId('batch-selected-count')).toHaveTextContent('2');
        expect(screen.getByTestId('batch-total-amount')).toHaveTextContent(/14[\s\u00A0]?000,00[\s\u00A0]?zł/);
    });

    it('resets selections when company context changes', async () => {
        renderWithProviders(<RecordsView />);

        await waitFor(() => {
            expect(screen.getByText('Płatność za maszyny produkcyjne')).toBeInTheDocument();
        });

        // Select a record
        fireEvent.click(screen.getByTestId('record-checkbox-rec-001'));
        expect(screen.getByTestId('batch-action-bar')).toBeInTheDocument();

        // Trigger company change event
        window.dispatchEvent(new CustomEvent('finboard:company-changed', { detail: { id: 'comp-other' } }));

        await waitFor(() => {
            expect(screen.queryByTestId('batch-action-bar')).toBeNull();
        });
    });

    it('resets selections when filters change or reset filters is clicked', async () => {
        renderWithProviders(<RecordsView />);

        await waitFor(() => {
            expect(screen.getByText('Płatność za maszyny produkcyjne')).toBeInTheDocument();
        });

        // Select a record
        fireEvent.click(screen.getByTestId('record-checkbox-rec-001'));
        expect(screen.getByTestId('batch-action-bar')).toBeInTheDocument();

        // Change search filter
        const searchInput = screen.getByPlaceholderText(/Szukaj po opisie/i);
        fireEvent.change(searchInput, { target: { value: 'maszyny' } });

        await waitFor(() => {
            expect(screen.queryByTestId('batch-action-bar')).toBeNull();
        });
    });
});

describe('RecordsView - Complete Batch Delete End-to-End Workflow', () => {
    let mockE2ERecords;
    let recordsUpdatedEventFired;

    beforeEach(() => {
        vi.clearAllMocks();
        recordsUpdatedEventFired = false;
        window.addEventListener(
            'finboard:records-updated',
            () => {
                recordsUpdatedEventFired = true;
            },
            { once: true }
        );

        mockE2ERecords = [
            {
                id: 'e2e-rec-001',
                company_id: 'comp-acme-1',
                record_date: '2026-03-01',
                category_id: 'cat-rev-1',
                category: mockCategories[0],
                record_type: 'revenue',
                amount: 30000,
                currency: 'PLN',
                description: 'Sprzedaż systemów SaaS',
                source: 'manual',
            },
            {
                id: 'e2e-rec-002',
                company_id: 'comp-acme-1',
                record_date: '2026-03-05',
                category_id: 'cat-opex-1',
                category: mockCategories[1],
                record_type: 'expense',
                amount: 12000,
                currency: 'PLN',
                description: 'Wynagrodzenia zespołu inżynierów',
                source: 'manual',
            },
            {
                id: 'e2e-rec-003',
                company_id: 'comp-acme-1',
                record_date: '2026-03-10',
                category_id: 'cat-opex-1',
                category: mockCategories[1],
                record_type: 'expense',
                amount: 5000,
                currency: 'PLN',
                description: 'Licencje chmurowe AWS',
                source: 'manual',
            },
        ];

        apiClient.get.mockImplementation((url) => {
            if (url === '/finance/categories') {
                return Promise.resolve({ data: { data: mockCategories } });
            }
            if (url.startsWith('/finance/records')) {
                return Promise.resolve({
                    data: {
                        data: mockE2ERecords,
                        meta: {
                            current_page: 1,
                            last_page: 1,
                            per_page: 25,
                            total: mockE2ERecords.length,
                            from: mockE2ERecords.length ? 1 : 0,
                            to: mockE2ERecords.length,
                        },
                    },
                });
            }
            return Promise.resolve({ data: {} });
        });

        apiClient.delete.mockImplementation((url, config) => {
            if (url === '/finance/records/batch') {
                const idsToDelete = config?.data?.record_ids || [];
                mockE2ERecords = mockE2ERecords.filter((r) => !idsToDelete.includes(r.id));
                return Promise.resolve({
                    data: {
                        status: 'deleted',
                        count: idsToDelete.length,
                        total_amount: 42000,
                        message: `Pomyślnie usunięto ${idsToDelete.length} operacji finansowych.`,
                    },
                });
            }
            return Promise.resolve({ data: {} });
        });
    });

    it('orchestrates complete end-to-end batch deletion lifecycle with metrics aggregation, confirmation modal, optimistic removal, notification toast, and domain event dispatch', async () => {
        renderWithProviders(<RecordsView />);

        // Step 1: Initial Render & Verification
        await waitFor(() => {
            expect(screen.getByText('Sprzedaż systemów SaaS')).toBeInTheDocument();
            expect(screen.getByText('Wynagrodzenia zespołu inżynierów')).toBeInTheDocument();
            expect(screen.getByText('Licencje chmurowe AWS')).toBeInTheDocument();
        });

        // Quick metrics ribbon shows total entries
        expect(screen.getByText('Łącznie Pozycji')).toBeInTheDocument();
        expect(screen.queryByTestId('batch-action-bar')).toBeNull();

        // Step 2: User selects two records (1 income, 1 expense)
        const check1 = screen.getByTestId('record-checkbox-e2e-rec-001');
        const check2 = screen.getByTestId('record-checkbox-e2e-rec-002');
        fireEvent.click(check1);
        fireEvent.click(check2);

        // Step 3: Floating Action Bar appears with correct aggregates
        expect(screen.getByTestId('batch-action-bar')).toBeInTheDocument();
        expect(screen.getByTestId('batch-selected-count')).toHaveTextContent('2');
        // 30,000 + 12,000 = 42,000
        expect(screen.getByTestId('batch-total-amount')).toHaveTextContent(/42[\s\u00A0]?000,00[\s\u00A0]?zł/);
        expect(screen.getByText(/\+30[\s\u00A0]?000,00[\s\u00A0]?zł/)).toBeInTheDocument();
        expect(screen.getByText(/-12[\s\u00A0]?000,00[\s\u00A0]?zł/)).toBeInTheDocument();

        // Step 4: User clicks batch delete button in floating action bar
        const batchDeleteBtn = screen.getByTestId('batch-delete-btn');
        fireEvent.click(batchDeleteBtn);

        // Step 5: BatchDeleteConfirmationModal opens with detailed breakdown
        expect(screen.getByTestId('batch-delete-modal')).toBeInTheDocument();
        expect(screen.getByTestId('batch-modal-count')).toHaveTextContent('2');
        expect(screen.getByTestId('batch-modal-total')).toHaveTextContent(/42[\s\u00A0]?000,00[\s\u00A0]?zł/);
        expect(screen.getByTestId('batch-modal-income')).toHaveTextContent(/30[\s\u00A0]?000,00[\s\u00A0]?zł/);
        expect(screen.getByTestId('batch-modal-expense')).toHaveTextContent(/12[\s\u00A0]?000,00[\s\u00A0]?zł/);
        // Safety keyword not required for <= 10 items
        expect(screen.queryByTestId('batch-keyword-section')).toBeNull();

        // Step 6: User clicks confirm deletion
        const confirmBtn = screen.getByTestId('batch-confirm-delete-btn');
        fireEvent.click(confirmBtn);

        // Step 7: API DELETE call is executed with exact IDs
        await waitFor(() => {
            expect(apiClient.delete).toHaveBeenCalledWith('/finance/records/batch', {
                data: { record_ids: ['e2e-rec-001', 'e2e-rec-002'] },
            });
        });

        // Step 8: Success notification toast is displayed
        await waitFor(() => {
            expect(screen.getByText('Potwierdzenie')).toBeInTheDocument();
            expect(screen.getByText('Pomyślnie usunięto 2 operacji finansowych.')).toBeInTheDocument();
        });

        // Step 9: Domain event finboard:records-updated was dispatched
        expect(recordsUpdatedEventFired).toBe(true);

        // Step 10: Optimistic & server UI update: records removed, modal & action bar unmounted
        await waitFor(() => {
            expect(screen.queryByTestId('batch-delete-modal')).toBeNull();
            expect(screen.queryByTestId('batch-action-bar')).toBeNull();
            expect(screen.queryByText('Sprzedaż systemów SaaS')).toBeNull();
            expect(screen.queryByText('Wynagrodzenia zespołu inżynierów')).toBeNull();
            expect(screen.getByText('Licencje chmurowe AWS')).toBeInTheDocument();
        });
    });

    it('executes high-volume batch deletion end-to-end requiring and validating safety keyword confirmation before deletion', async () => {
        // Setup 15 records to trigger high-volume safety threshold (> 10)
        const bulkRecords = Array.from({ length: 15 }, (_, i) => ({
            id: `bulk-rec-${i + 1}`,
            company_id: 'comp-acme-1',
            record_date: '2026-03-01',
            category_id: 'cat-rev-1',
            category: mockCategories[0],
            record_type: 'revenue',
            amount: 2000,
            currency: 'PLN',
            description: `Transakcja hurtowa #${i + 1}`,
            source: 'manual',
        }));

        apiClient.get.mockImplementation((url) => {
            if (url === '/finance/categories') return Promise.resolve({ data: { data: mockCategories } });
            if (url.startsWith('/finance/records')) {
                return Promise.resolve({
                    data: {
                        data: bulkRecords,
                        meta: { current_page: 1, last_page: 1, per_page: 25, total: 15, from: 1, to: 15 },
                    },
                });
            }
            return Promise.resolve({ data: {} });
        });

        renderWithProviders(<RecordsView />);

        await waitFor(() => {
            expect(screen.getByText('Transakcja hurtowa #1')).toBeInTheDocument();
        });

        // Master checkbox selects all 15 records
        fireEvent.click(screen.getByTestId('batch-master-checkbox'));
        expect(screen.getByTestId('batch-selected-count')).toHaveTextContent('15');

        // Open modal
        fireEvent.click(screen.getByTestId('batch-delete-btn'));
        expect(screen.getByTestId('batch-delete-modal')).toBeInTheDocument();
        expect(screen.getByTestId('batch-keyword-section')).toBeInTheDocument();

        const confirmBtn = screen.getByTestId('batch-confirm-delete-btn');
        expect(confirmBtn).toBeDisabled();

        // Type incorrect keyword -> button remains disabled
        const input = screen.getByTestId('batch-confirm-input');
        fireEvent.change(input, { target: { value: 'USUN' } });
        expect(confirmBtn).toBeDisabled();

        // Type valid keyword "USUŃ" -> button becomes enabled
        fireEvent.change(input, { target: { value: 'USUŃ' } });
        expect(confirmBtn).not.toBeDisabled();

        // Submit deletion
        fireEvent.click(confirmBtn);

        await waitFor(() => {
            expect(apiClient.delete).toHaveBeenCalledWith('/finance/records/batch', {
                data: { record_ids: bulkRecords.map((r) => r.id) },
            });
        });

        await waitFor(() => {
            expect(screen.queryByTestId('batch-delete-modal')).toBeNull();
            expect(screen.queryByTestId('batch-action-bar')).toBeNull();
        });
    });

    it('handles batch delete server errors with error toast notification and rollback resilience', async () => {
        apiClient.delete.mockImplementation(() =>
            Promise.reject({
                response: {
                    data: {
                        message: 'Błąd serwera: transakcja bazodanowa wycofana z powodu blokady tabeli.',
                    },
                },
            })
        );

        renderWithProviders(<RecordsView />);

        await waitFor(() => {
            expect(screen.getByText('Sprzedaż systemów SaaS')).toBeInTheDocument();
        });

        // Select record 1
        fireEvent.click(screen.getByTestId('record-checkbox-e2e-rec-001'));
        fireEvent.click(screen.getByTestId('batch-delete-btn'));

        // Confirm deletion
        fireEvent.click(screen.getByTestId('batch-confirm-delete-btn'));

        // Error notification toast appears
        await waitFor(() => {
            expect(screen.getByText('Błąd operacji')).toBeInTheDocument();
            expect(
                screen.getByText('Błąd serwera: transakcja bazodanowa wycofana z powodu blokady tabeli.')
            ).toBeInTheDocument();
        });

        // Record is preserved in table
        expect(screen.getByText('Sprzedaż systemów SaaS')).toBeInTheDocument();
    });

    it('allows cancelling deletion from modal and deselecting from action bar without invoking API', async () => {
        renderWithProviders(<RecordsView />);

        await waitFor(() => {
            expect(screen.getByText('Sprzedaż systemów SaaS')).toBeInTheDocument();
        });

        // Select record 1
        const check1 = screen.getByTestId('record-checkbox-e2e-rec-001');
        fireEvent.click(check1);
        expect(screen.getByTestId('batch-action-bar')).toBeInTheDocument();

        // Open modal and click cancel
        fireEvent.click(screen.getByTestId('batch-delete-btn'));
        expect(screen.getByTestId('batch-delete-modal')).toBeInTheDocument();
        fireEvent.click(screen.getByTestId('batch-modal-cancel-btn'));

        // Modal closes, selection stays
        expect(screen.queryByTestId('batch-delete-modal')).toBeNull();
        expect(screen.getByTestId('batch-action-bar')).toBeInTheDocument();

        // Click clear in action bar
        fireEvent.click(screen.getByTestId('batch-clear-btn'));
        expect(screen.queryByTestId('batch-action-bar')).toBeNull();
        expect(check1).not.toBeChecked();

        // Ensure delete API was never invoked
        expect(apiClient.delete).not.toHaveBeenCalled();
    });
});

describe('RecordsView - Non-Zero Summary Cards Calculations and Domain Contract Compliance', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('displays accurately calculated non-zero summary cards for canonical revenue and expense records', async () => {
        apiClient.get.mockImplementation((url) => {
            if (url === '/finance/categories') {
                return Promise.resolve({ data: { data: mockCategories } });
            }
            if (url.startsWith('/finance/records')) {
                return Promise.resolve({
                    data: {
                        data: mockRecords,
                        meta: {
                            current_page: 1,
                            last_page: 1,
                            per_page: 25,
                            total: 2,
                            from: 1,
                            to: 2,
                        },
                    },
                });
            }
            return Promise.resolve({ data: {} });
        });

        renderWithProviders(<RecordsView />);

        await waitFor(() => {
            expect(screen.getByText('Płatność za maszyny produkcyjne')).toBeInTheDocument();
        });

        // Verify summary cards contain non-zero formatted values
        const incomeValue = screen.getByTestId('summary-income-value');
        const expenseValue = screen.getByTestId('summary-expense-value');
        const balanceValue = screen.getByTestId('summary-balance-value');
        const totalValue = screen.getByTestId('summary-total-value');

        // Revenue: 25 000,00 zł
        expect(incomeValue.textContent.replace(/\u00a0/g, ' ')).toMatch(/25\s?000,00\s?zł/);
        // Expense: 8 000,00 zł
        expect(expenseValue.textContent.replace(/\u00a0/g, ' ')).toMatch(/8\s?000,00\s?zł/);
        // Balance: 17 000,00 zł (positive balance style)
        expect(balanceValue.textContent.replace(/\u00a0/g, ' ')).toMatch(/17\s?000,00\s?zł/);
        expect(balanceValue).toHaveClass('text-zinc-100');
        expect(totalValue).toHaveTextContent('2 wpisów');
    });

    it('correctly aggregates records using legacy income alias and renders positive balance', async () => {
        const recordsWithIncomeAlias = [
            {
                id: 'rec-inc-1',
                company_id: 'comp-acme-1',
                record_date: '2026-03-02',
                category_id: 'cat-rev-1',
                category: mockCategories[0],
                record_type: 'INCOME', // legacy uppercase alias
                amount: 15000,
                currency: 'PLN',
                description: 'Przychody konsultingowe',
                source: 'manual',
            },
            {
                id: 'rec-exp-1',
                company_id: 'comp-acme-1',
                record_date: '2026-03-03',
                category_id: 'cat-opex-1',
                category: mockCategories[1],
                record_type: 'expense',
                amount: 5000,
                currency: 'PLN',
                description: 'Koszty serwerów',
                source: 'manual',
            },
        ];

        apiClient.get.mockImplementation((url) => {
            if (url === '/finance/categories') return Promise.resolve({ data: { data: mockCategories } });
            if (url.startsWith('/finance/records')) {
                return Promise.resolve({
                    data: {
                        data: recordsWithIncomeAlias,
                        meta: { current_page: 1, last_page: 1, per_page: 25, total: 2, from: 1, to: 2 },
                    },
                });
            }
            return Promise.resolve({ data: {} });
        });

        renderWithProviders(<RecordsView />);

        await waitFor(() => {
            expect(screen.getByText('Przychody konsultingowe')).toBeInTheDocument();
        });

        const incomeValue = screen.getByTestId('summary-income-value');
        const expenseValue = screen.getByTestId('summary-expense-value');
        const balanceValue = screen.getByTestId('summary-balance-value');

        expect(incomeValue.textContent.replace(/\u00a0/g, ' ')).toMatch(/15\s?000,00\s?zł/);
        expect(expenseValue.textContent.replace(/\u00a0/g, ' ')).toMatch(/5\s?000,00\s?zł/);
        expect(balanceValue.textContent.replace(/\u00a0/g, ' ')).toMatch(/10\s?000,00\s?zł/);
    });

    it('isolates asset and liability records from operational income/expense and computes negative balance when expense exceeds revenue', async () => {
        const mixedRecords = [
            {
                id: 'rec-rev-1',
                company_id: 'comp-acme-1',
                record_date: '2026-03-01',
                category_id: 'cat-rev-1',
                category: mockCategories[0],
                record_type: 'revenue',
                amount: 10000,
                currency: 'PLN',
                description: 'Przychód z prowizji',
                source: 'manual',
            },
            {
                id: 'rec-exp-2',
                company_id: 'comp-acme-1',
                record_date: '2026-03-02',
                category_id: 'cat-opex-1',
                category: mockCategories[1],
                record_type: 'expense',
                amount: 25000,
                currency: 'PLN',
                description: 'Duży koszt operacyjny',
                source: 'manual',
            },
            {
                id: 'rec-ast-1',
                company_id: 'comp-acme-1',
                record_date: '2026-03-03',
                category_id: null,
                category: null,
                record_type: 'asset',
                amount: 50000,
                currency: 'PLN',
                description: 'Zakup środka trwałego',
                source: 'manual',
            },
            {
                id: 'rec-lia-1',
                company_id: 'comp-acme-1',
                record_date: '2026-03-04',
                category_id: null,
                category: null,
                record_type: 'liability',
                amount: 40000,
                currency: 'PLN',
                description: 'Zaciągnięty kredyt bankowy',
                source: 'manual',
            },
        ];

        apiClient.get.mockImplementation((url) => {
            if (url === '/finance/categories') return Promise.resolve({ data: { data: mockCategories } });
            if (url.startsWith('/finance/records')) {
                return Promise.resolve({
                    data: {
                        data: mixedRecords,
                        meta: { current_page: 1, last_page: 1, per_page: 25, total: 4, from: 1, to: 4 },
                    },
                });
            }
            return Promise.resolve({ data: {} });
        });

        renderWithProviders(<RecordsView />);

        await waitFor(() => {
            expect(screen.getByText('Zakup środka trwałego')).toBeInTheDocument();
        });

        const incomeValue = screen.getByTestId('summary-income-value');
        const expenseValue = screen.getByTestId('summary-expense-value');
        const balanceValue = screen.getByTestId('summary-balance-value');
        const totalValue = screen.getByTestId('summary-total-value');

        // Revenue: exactly 10 000 (asset/liability ignored)
        expect(incomeValue.textContent.replace(/\u00a0/g, ' ')).toMatch(/10\s?000,00\s?zł/);
        // Expense: exactly 25 000
        expect(expenseValue.textContent.replace(/\u00a0/g, ' ')).toMatch(/25\s?000,00\s?zł/);
        // Balance: 10 000 - 25 000 = -15 000 (negative balance style)
        expect(balanceValue.textContent.replace(/\u00a0/g, ' ')).toMatch(/-15\s?000,00\s?zł/);
        expect(balanceValue).toHaveClass('text-rose-400');
        expect(totalValue).toHaveTextContent('4 wpisów');
    });
});

describe('RecordsView - Reactive Transaction Type Filtering with Canonical Domain Values', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        apiClient.get.mockImplementation((url) => {
            if (url === '/finance/categories') {
                return Promise.resolve({ data: { data: mockCategories } });
            }
            if (url.startsWith('/finance/records')) {
                return Promise.resolve({
                    data: {
                        data: mockRecords,
                        meta: {
                            current_page: 1,
                            last_page: 1,
                            per_page: 25,
                            total: 2,
                            from: 1,
                            to: 2,
                        },
                    },
                });
            }
            return Promise.resolve({ data: {} });
        });
    });

    it('emits canonical record_type=revenue query parameter when filtering by revenue', async () => {
        renderWithProviders(<RecordsView />);

        await waitFor(() => {
            expect(screen.getByText('Płatność za maszyny produkcyjne')).toBeInTheDocument();
        });

        const typeFilter = screen.getByTestId('filter-record-type');
        expect(typeFilter.value).toBe('');

        fireEvent.change(typeFilter, { target: { value: 'revenue' } });

        await waitFor(() => {
            expect(apiClient.get).toHaveBeenCalledWith(
                '/finance/records',
                expect.objectContaining({
                    params: expect.objectContaining({
                        record_type: 'revenue',
                        page: 1,
                    }),
                })
            );
        });
    });

    it('emits canonical record_type query parameter across all domain values: expense, asset, liability', async () => {
        renderWithProviders(<RecordsView />);

        await waitFor(() => {
            expect(screen.getByText('Płatność za maszyny produkcyjne')).toBeInTheDocument();
        });

        const typeFilter = screen.getByTestId('filter-record-type');

        // Test expense
        fireEvent.change(typeFilter, { target: { value: 'expense' } });
        await waitFor(() => {
            expect(apiClient.get).toHaveBeenCalledWith(
                '/finance/records',
                expect.objectContaining({
                    params: expect.objectContaining({ record_type: 'expense' }),
                })
            );
        });

        // Test asset
        fireEvent.change(typeFilter, { target: { value: 'asset' } });
        await waitFor(() => {
            expect(apiClient.get).toHaveBeenCalledWith(
                '/finance/records',
                expect.objectContaining({
                    params: expect.objectContaining({ record_type: 'asset' }),
                })
            );
        });

        // Test liability
        fireEvent.change(typeFilter, { target: { value: 'liability' } });
        await waitFor(() => {
            expect(apiClient.get).toHaveBeenCalledWith(
                '/finance/records',
                expect.objectContaining({
                    params: expect.objectContaining({ record_type: 'liability' }),
                })
            );
        });

        // Reset to all types ("")
        fireEvent.change(typeFilter, { target: { value: '' } });
        await waitFor(() => {
            const lastCallArgs = apiClient.get.mock.calls[apiClient.get.mock.calls.length - 1];
            expect(lastCallArgs[0]).toBe('/finance/records');
            expect(lastCallArgs[1].params.record_type).toBeUndefined();
        });
    });

    it('resets selection state and floating action bar when switching transaction type filter', async () => {
        renderWithProviders(<RecordsView />);

        await waitFor(() => {
            expect(screen.getByText('Płatność za maszyny produkcyjne')).toBeInTheDocument();
        });

        // Select a record
        const check1 = screen.getByTestId('record-checkbox-rec-001');
        fireEvent.click(check1);
        expect(screen.getByTestId('batch-action-bar')).toBeInTheDocument();
        expect(screen.getByTestId('batch-selected-count')).toHaveTextContent('1');

        // Change type filter
        const typeFilter = screen.getByTestId('filter-record-type');
        fireEvent.change(typeFilter, { target: { value: 'revenue' } });

        // Floating action bar should unmount as selections are cleared
        await waitFor(() => {
            expect(screen.queryByTestId('batch-action-bar')).toBeNull();
        });
    });
});

describe('RecordsView - CSV Export Payload and Canonical Domain Types', () => {
    let originalCreateObjectURL;
    let createObjectURLMock;

    beforeEach(() => {
        vi.clearAllMocks();
        originalCreateObjectURL = window.URL.createObjectURL;
        createObjectURLMock = vi.fn().mockReturnValue('blob:http://localhost/csv-download');
        window.URL.createObjectURL = createObjectURLMock;
        window.URL.revokeObjectURL = vi.fn();
    });

    afterEach(() => {
        window.URL.createObjectURL = originalCreateObjectURL;
    });

    it('exports CSV payload with canonical headers and canonical record_type values', async () => {
        const fullRecords = [
            {
                id: 'rec-rev-101',
                company_id: 'comp-acme-1',
                record_date: '2026-03-01',
                category_id: 'cat-rev-1',
                category: mockCategories[0],
                record_type: 'revenue',
                amount: 15000,
                currency: 'PLN',
                description: 'Przychód z usług',
                source: 'manual',
            },
            {
                id: 'rec-exp-102',
                company_id: 'comp-acme-1',
                record_date: '2026-03-02',
                category_id: 'cat-opex-1',
                category: mockCategories[1],
                record_type: 'expense',
                amount: 4500,
                currency: 'PLN',
                description: 'Koszt serwerów',
                source: 'manual',
            },
            {
                id: 'rec-ast-103',
                company_id: 'comp-acme-1',
                record_date: '2026-03-03',
                category_id: null,
                category: null,
                record_type: 'asset',
                amount: 80000,
                currency: 'PLN',
                description: 'Zakup sprzętu',
                source: 'manual',
            },
            {
                id: 'rec-lia-104',
                company_id: 'comp-acme-1',
                record_date: '2026-03-04',
                category_id: null,
                category: null,
                record_type: 'liability',
                amount: 20000,
                currency: 'PLN',
                description: 'Pożyczka wspólnika',
                source: 'manual',
            },
            {
                id: 'rec-leg-105',
                company_id: 'comp-acme-1',
                record_date: '2026-03-05',
                category_id: 'cat-rev-1',
                category: mockCategories[0],
                record_type: 'INCOME', // legacy uppercase alias
                amount: 12000,
                currency: 'PLN',
                description: 'Stary format przychodu',
                source: 'manual',
            },
        ];

        apiClient.get.mockImplementation((url) => {
            if (url === '/finance/categories') return Promise.resolve({ data: { data: mockCategories } });
            if (url.startsWith('/finance/records')) {
                return Promise.resolve({
                    data: {
                        data: fullRecords,
                        meta: { current_page: 1, last_page: 1, per_page: 25, total: 5, from: 1, to: 5 },
                    },
                });
            }
            return Promise.resolve({ data: {} });
        });

        renderWithProviders(<RecordsView />);

        await waitFor(() => {
            expect(screen.getByText('Przychód z usług')).toBeInTheDocument();
        });

        // Click Export CSV button
        const exportBtn = screen.getByRole('button', { name: /Eksportuj CSV/i });
        fireEvent.click(exportBtn);

        expect(createObjectURLMock).toHaveBeenCalledTimes(1);
        const blob = createObjectURLMock.mock.calls[0][0];
        expect(blob).toBeInstanceOf(Blob);

        const csvContent = await blob.text();
        const lines = csvContent.trim().split('\n');

        // Check header row
        expect(lines[0]).toBe('ID,Data,Kategoria,Typ,Kwota,Waluta,Opis,Zrodlo');

        // Check row 1: revenue
        expect(lines[1]).toContain('"rec-rev-101"');
        expect(lines[1]).toContain('"revenue"');
        expect(lines[1]).not.toContain('"INCOME"');

        // Check row 2: expense
        expect(lines[2]).toContain('"rec-exp-102"');
        expect(lines[2]).toContain('"expense"');

        // Check row 3: asset
        expect(lines[3]).toContain('"rec-ast-103"');
        expect(lines[3]).toContain('"asset"');

        // Check row 4: liability
        expect(lines[4]).toContain('"rec-lia-104"');
        expect(lines[4]).toContain('"liability"');

        // Check row 5: legacy INCOME converted to canonical revenue
        expect(lines[5]).toContain('"rec-leg-105"');
        expect(lines[5]).toContain('"revenue"');
        expect(lines[5]).not.toContain('"INCOME"');
    });

    it('shows notification and aborts download when trying to export empty dataset', async () => {
        apiClient.get.mockImplementation((url) => {
            if (url === '/finance/categories') return Promise.resolve({ data: { data: mockCategories } });
            if (url.startsWith('/finance/records')) {
                return Promise.resolve({
                    data: {
                        data: [],
                        meta: { current_page: 1, last_page: 1, per_page: 25, total: 0, from: 0, to: 0 },
                    },
                });
            }
            return Promise.resolve({ data: {} });
        });

        renderWithProviders(<RecordsView />);

        await waitFor(() => {
            expect(screen.getByText('Brak transakcji spełniających wybrane kryteria filtrów.')).toBeInTheDocument();
        });

        const exportBtn = screen.getByRole('button', { name: /Eksportuj CSV/i });
        fireEvent.click(exportBtn);

        expect(createObjectURLMock).not.toHaveBeenCalled();
        expect(screen.getByText('Brak danych do eksportu.')).toBeInTheDocument();
    });
});

describe('RecordsView - Accessible Tooltips and InfoTooltips Integration (Phase 56 Commit 275)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        apiClient.get.mockImplementation((url) => {
            if (url === '/finance/categories') {
                return Promise.resolve({ data: { data: mockCategories } });
            }
            if (url.startsWith('/finance/records')) {
                return Promise.resolve({
                    data: {
                        data: mockRecords,
                        meta: {
                            current_page: 1,
                            last_page: 1,
                            per_page: 25,
                            total: 2,
                            from: 1,
                            to: 2,
                        },
                    },
                });
            }
            return Promise.resolve({ data: {} });
        });
    });

    it('renders accessible Tooltips and InfoTooltips across Księga Transakcji Finansowych view', async () => {
        renderWithProviders(<RecordsView />);

        await waitFor(() => {
            expect(screen.getByText('Płatność za maszyny produkcyjne')).toBeInTheDocument();
        });

        // 1. Top Ribbon & InfoTooltip
        expect(screen.getByText('Księga Operacji Finansowych (General Ledger)')).toBeInTheDocument();
        const infoButtons = screen.getAllByRole('button', { name: /Więcej informacji/i });
        expect(infoButtons.length).toBeGreaterThanOrEqual(4);

        // 2. Action buttons have accessible names
        expect(screen.getByRole('button', { name: /Eksportuj CSV/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Nowy Zapis Księgowy/i })).toBeInTheDocument();

        // 3. Quick metrics summary cards have InfoTooltips
        expect(screen.getByTestId('summary-card-total')).toBeInTheDocument();
        expect(screen.getByTestId('summary-card-income')).toBeInTheDocument();
        expect(screen.getByTestId('summary-card-expense')).toBeInTheDocument();
        expect(screen.getByTestId('summary-card-balance')).toBeInTheDocument();

        // 4. Filter bar inputs have accessible labels
        expect(screen.getByLabelText(/Szukaj po opisie, kontrahencie, fakturze/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Filtruj według typu transakcji/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Filtruj według kategorii analitycznej/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Reset Filtrów/i })).toBeInTheDocument();
        expect(screen.getByLabelText(/Początkowa data księgowania/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Końcowa data księgowania/i)).toBeInTheDocument();

        // 5. Table headers and master checkbox
        expect(screen.getByTestId('batch-master-checkbox')).toBeInTheDocument();
        expect(screen.getByText('Tytuł / Opis Transakcji')).toBeInTheDocument();
        expect(screen.getByText('Typ')).toBeInTheDocument();
        expect(screen.getByText(/Kwota \(PLN\)/i)).toBeInTheDocument();

        // 6. Action buttons on row
        expect(screen.getByRole('button', { name: /Edytuj zapis: Płatność za maszyny produkcyjne/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Usuń zapis: Płatność za maszyny produkcyjne/i })).toBeInTheDocument();

        // 7. Pagination controls
        expect(screen.getByLabelText(/Liczba transakcji na stronie/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Poprzednia strona/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Następna strona/i })).toBeInTheDocument();
    });
});




