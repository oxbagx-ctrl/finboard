import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FinancialRecordModal } from '../../components/finance/FinancialRecordModal';
import { DealProvider } from '../../context/DealContext';
import { NotificationProvider } from '../../context/NotificationContext';
import apiClient from '../../api/client';

// Mock apiClient
vi.mock('../../api/client', () => ({
    default: {
        post: vi.fn(),
        put: vi.fn(),
    },
}));

const mockCategories = [
    { id: 'cat-rev-1', code: 'REV_CORE', name: 'Przychody ze sprzedaży produktów', type: 'INCOME' },
    { id: 'cat-cogs-1', code: 'COGS_MAT', name: 'Materiały i surowce produkcyjne', type: 'EXPENSE' },
    { id: 'cat-opex-1', code: 'OPEX_SAL', name: 'Wynagrodzenia i narzuty', type: 'EXPENSE' },
];

const renderWithProviders = (ui) => {
    return render(
        <DealProvider>
            <NotificationProvider>
                {ui}
            </NotificationProvider>
        </DealProvider>
    );
};

describe('FinancialRecordModal (Form Validation & Submission Integration)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders nothing when isOpen is false', () => {
        renderWithProviders(
            <FinancialRecordModal
                isOpen={false}
                onClose={vi.fn()}
                onSuccess={vi.fn()}
                categories={mockCategories}
            />
        );
        expect(screen.queryByText('Nowy Zapis Księgowy')).not.toBeInTheDocument();
        expect(screen.queryByText('Edycja Zapisów Księgowych')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Utwórz Zapis/i })).not.toBeInTheDocument();
    });

    it('renders creation mode modal with default options and categories', () => {
        renderWithProviders(
            <FinancialRecordModal
                isOpen={true}
                onClose={vi.fn()}
                onSuccess={vi.fn()}
                categories={mockCategories}
            />
        );

        expect(screen.getByText('Nowy Zapis Księgowy')).toBeInTheDocument();
        expect(screen.getByText('REJESTRACJA OPERACJI W KSIĘDZE GŁÓWNEJ')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Utwórz Zapis/i })).toBeInTheDocument();

        // Check options
        expect(screen.getByText(/\[REV_CORE\] Przychody ze sprzedaży produktów/i)).toBeInTheDocument();
        expect(screen.getByText(/\[COGS_MAT\] Materiały i surowce produkcyjne/i)).toBeInTheDocument();
    });

    it('shows validation errors and halts submit when required fields are empty or invalid', async () => {
        renderWithProviders(
            <FinancialRecordModal
                isOpen={true}
                onClose={vi.fn()}
                onSuccess={vi.fn()}
                categories={mockCategories}
            />
        );

        const form = screen.getByRole('button', { name: /Utwórz Zapis/i }).closest('form');
        fireEvent.submit(form);

        // Validation errors should appear
        expect(screen.getByText('Wprowadź prawidłową kwotę dodatnią większą od zera.')).toBeInTheDocument();
        expect(screen.getByText('Opis operacji jest wymagany.')).toBeInTheDocument();
        expect(apiClient.post).not.toHaveBeenCalled();
    });

    it('rejects zero or negative amounts with an explicit validation error', async () => {
        renderWithProviders(
            <FinancialRecordModal
                isOpen={true}
                onClose={vi.fn()}
                onSuccess={vi.fn()}
                categories={mockCategories}
            />
        );

        const amountInput = screen.getByPlaceholderText('0.00');
        const descInput = screen.getByPlaceholderText(/np\. FV\/2026/i);
        const form = screen.getByRole('button', { name: /Utwórz Zapis/i }).closest('form');

        // Set negative amount
        fireEvent.change(amountInput, { target: { value: '-250.00' } });
        fireEvent.change(descInput, { target: { value: 'Test ujemnej kwoty' } });
        fireEvent.submit(form);

        expect(screen.getByText('Wprowadź prawidłową kwotę dodatnią większą od zera.')).toBeInTheDocument();
        expect(apiClient.post).not.toHaveBeenCalled();
    });

    it('submits valid payload for new record and invokes callbacks', async () => {
        apiClient.post.mockResolvedValueOnce({ data: { success: true } });
        const handleSuccess = vi.fn();
        const handleClose = vi.fn();

        renderWithProviders(
            <FinancialRecordModal
                isOpen={true}
                onClose={handleClose}
                onSuccess={handleSuccess}
                categories={mockCategories}
            />
        );

        const amountInput = screen.getByPlaceholderText('0.00');
        const descInput = screen.getByPlaceholderText(/np\. FV\/2026/i);
        const form = screen.getByRole('button', { name: /Utwórz Zapis/i }).closest('form');

        fireEvent.change(amountInput, { target: { value: '18500.50' } });
        fireEvent.change(descInput, { target: { value: 'FV/2026/09/100 Audyt prawny Due Diligence' } });
        fireEvent.submit(form);

        await waitFor(() => {
            expect(apiClient.post).toHaveBeenCalledTimes(1);
        });

        expect(apiClient.post).toHaveBeenCalledWith('/finance/records', expect.objectContaining({
            category_id: 'cat-rev-1',
            amount: 18500.5,
            currency: 'PLN',
            description: 'FV/2026/09/100 Audyt prawny Due Diligence',
            source: 'manual',
        }));

        expect(handleSuccess).toHaveBeenCalledTimes(1);
        expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('populates fields in edit mode and issues a PUT request', async () => {
        apiClient.put.mockResolvedValueOnce({ data: { success: true } });
        const handleSuccess = vi.fn();
        const handleClose = vi.fn();

        const recordToEdit = {
            id: 'rec-uuid-999',
            category_id: 'cat-cogs-1',
            amount: 42000,
            currency: 'EUR',
            record_date: '2026-07-15',
            description: 'Zakup stali konstrukcyjnej - korekta',
        };

        renderWithProviders(
            <FinancialRecordModal
                isOpen={true}
                onClose={handleClose}
                onSuccess={handleSuccess}
                categories={mockCategories}
                recordToEdit={recordToEdit}
            />
        );

        expect(screen.getByText('Edycja Zapisów Księgowych')).toBeInTheDocument();
        expect(screen.getByText('ID: rec-uuid-999')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Zapisz Zmiany/i })).toBeInTheDocument();

        // Inputs should be pre-filled
        const amountInput = screen.getByDisplayValue('42000');
        const descInput = screen.getByDisplayValue('Zakup stali konstrukcyjnej - korekta');
        expect(amountInput).toBeInTheDocument();
        expect(descInput).toBeInTheDocument();

        // Change amount and submit
        fireEvent.change(amountInput, { target: { value: '45000' } });
        const form = screen.getByRole('button', { name: /Zapisz Zmiany/i }).closest('form');
        fireEvent.submit(form);

        await waitFor(() => {
            expect(apiClient.put).toHaveBeenCalledWith(
                '/finance/records/rec-uuid-999',
                expect.objectContaining({
                    category_id: 'cat-cogs-1',
                    amount: 45000,
                    currency: 'EUR',
                    record_date: '2026-07-15',
                    description: 'Zakup stali konstrukcyjnej - korekta',
                    source: 'manual',
                })
            );
        });

        expect(handleSuccess).toHaveBeenCalledTimes(1);
        expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when cancel or close button is clicked', () => {
        const handleClose = vi.fn();

        renderWithProviders(
            <FinancialRecordModal
                isOpen={true}
                onClose={handleClose}
                onSuccess={vi.fn()}
                categories={mockCategories}
            />
        );

        const cancelBtn = screen.getByRole('button', { name: /Anuluj/i });
        fireEvent.click(cancelBtn);
        expect(handleClose).toHaveBeenCalledTimes(1);
    });
});
