import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
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
    { id: 'cat-rev-1', code: 'REV-01', name: 'Sprzedaż maszyn', type: 'INCOME' },
    { id: 'cat-opex-1', code: 'OPEX-01', name: 'Wynagrodzenia', type: 'EXPENSE' },
];

const mockRecords = [
    {
        id: 'rec-001',
        company_id: 'comp-acme-1',
        record_date: '2026-03-01',
        category_id: 'cat-rev-1',
        category: mockCategories[0],
        record_type: 'INCOME',
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
        record_type: 'EXPENSE',
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
            record_type: 'INCOME',
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
});
