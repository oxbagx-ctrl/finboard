import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CreateCompanyModal } from '../../components/advisors/CreateCompanyModal';
import { NotificationProvider } from '../../context/NotificationContext';
import { AuthContext } from '../../context/AuthContext';
import apiClient from '../../api/client';

// Mock apiClient
vi.mock('../../api/client', () => ({
    default: {
        get: vi.fn(),
        post: vi.fn(),
    },
}));

const mockAdvisors = [
    {
        id: 'user-adv-1',
        name: 'Krzysztof Kowalczyk',
        email: 'krzysztof@helvest.com',
        role: 'advisor',
        is_active: true,
    },
    {
        id: 'user-adv-2',
        name: 'Janina Lewandowska',
        email: 'janina@helvest.com',
        role: 'advisor',
        is_active: true,
    },
    {
        id: 'user-admin-1',
        name: 'Super Admin Helvest',
        email: 'admin@helvest.com',
        role: 'super_admin',
        is_active: true,
    },
];

const renderModal = ({
    isOpen = true,
    onClose = vi.fn(),
    onSuccess = vi.fn(),
} = {}) => {
    return render(
        <NotificationProvider>
            <AuthContext.Provider
                value={{
                    user: mockAdvisors[2],
                    isAdmin: true,
                    isSuperAdmin: true,
                    isAdvisor: false,
                    isClient: false,
                }}
            >
                <CreateCompanyModal
                    isOpen={isOpen}
                    onClose={onClose}
                    onSuccess={onSuccess}
                />
            </AuthContext.Provider>
        </NotificationProvider>
    );
};

describe('CreateCompanyModal Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        apiClient.get.mockResolvedValue({ data: { data: mockAdvisors } });
    });

    it('does not render when isOpen is false', () => {
        renderModal({ isOpen: false });
        expect(screen.queryByText('Dodaj Nową Spółkę Portfelową')).not.toBeInTheDocument();
    });

    it('renders modal dialog with inputs and loads active advisors', async () => {
        renderModal();

        expect(screen.getByText('Dodaj Nową Spółkę Portfelową')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('np. Acme Manufacturing S.A.')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('np. ACME')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('np. PL5250011222')).toBeInTheDocument();

        // Advisors list loaded
        await waitFor(() => {
            expect(apiClient.get).toHaveBeenCalledWith('/admin/advisors');
            expect(screen.getByText('Krzysztof Kowalczyk')).toBeInTheDocument();
            expect(screen.getByText('Janina Lewandowska')).toBeInTheDocument();
            // super_admin filtered out from assignable advisors
            expect(screen.queryByText('Super Admin Helvest')).not.toBeInTheDocument();
        });
    });

    it('validates required fields on submit', async () => {
        renderModal();

        const submitBtn = screen.getByRole('button', { name: /Utwórz Spółkę/i });

        await waitFor(() => {
            expect(submitBtn).not.toBeDisabled();
        });

        fireEvent.click(submitBtn);

        await waitFor(() => {
            expect(screen.getByText('Pełna nazwa spółki jest wymagana.')).toBeInTheDocument();
            expect(screen.getByText('Kod identyfikacyjny (ticker) jest wymagany.')).toBeInTheDocument();
        });

        expect(apiClient.post).not.toHaveBeenCalled();
    });

    it('automatically uppercases company code input', async () => {
        renderModal();

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /Utwórz Spółkę/i })).not.toBeDisabled();
        });

        const codeInput = screen.getByPlaceholderText('np. ACME');
        fireEvent.change(codeInput, { target: { value: 'nordic_log' } });

        expect(codeInput.value).toBe('NORDIC_LOG');
    });

    it('submits valid company without advisors', async () => {
        const handleSuccess = vi.fn();
        const handleClose = vi.fn();

        apiClient.post.mockResolvedValueOnce({
            data: {
                message: 'Spółka została pomyślnie utworzona.',
                data: {
                    id: 'comp-new-1',
                    name: 'Nordic Logistics Sp. z o.o.',
                    code: 'NORDIC',
                    tax_id: 'PL5251234567',
                    assigned_advisors_count: 0,
                    clients_count: 0,
                    assigned_advisors: [],
                },
            },
        });

        renderModal({ onSuccess: handleSuccess, onClose: handleClose });

        const submitBtn = screen.getByRole('button', { name: /Utwórz Spółkę/i });

        await waitFor(() => {
            expect(submitBtn).not.toBeDisabled();
        });

        const nameInput = screen.getByPlaceholderText('np. Acme Manufacturing S.A.');
        const codeInput = screen.getByPlaceholderText('np. ACME');
        const taxInput = screen.getByPlaceholderText('np. PL5250011222');

        fireEvent.change(nameInput, { target: { value: 'Nordic Logistics Sp. z o.o.' } });
        fireEvent.change(codeInput, { target: { value: 'nordic' } });
        fireEvent.change(taxInput, { target: { value: 'PL5251234567' } });

        fireEvent.click(submitBtn);

        await waitFor(() => {
            expect(apiClient.post).toHaveBeenCalledWith('/admin/companies', {
                name: 'Nordic Logistics Sp. z o.o.',
                code: 'NORDIC',
                tax_id: 'PL5251234567',
                assigned_advisor_ids: [],
            });
        });

        expect(handleSuccess).toHaveBeenCalledTimes(1);
        expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('submits valid company with selected initial advisors', async () => {
        const handleSuccess = vi.fn();
        const handleClose = vi.fn();

        apiClient.post.mockResolvedValueOnce({
            data: {
                message: 'Spółka została pomyślnie utworzona.',
                data: {
                    id: 'comp-new-2',
                    name: 'Baltic Energy S.A.',
                    code: 'BALTIC',
                    tax_id: null,
                    assigned_advisors_count: 1,
                    clients_count: 0,
                    assigned_advisors: [mockAdvisors[0]],
                },
            },
        });

        renderModal({ onSuccess: handleSuccess, onClose: handleClose });

        await waitFor(() => {
            expect(screen.getByText('Krzysztof Kowalczyk')).toBeInTheDocument();
        });

        fireEvent.change(screen.getByPlaceholderText('np. Acme Manufacturing S.A.'), {
            target: { value: 'Baltic Energy S.A.' },
        });
        fireEvent.change(screen.getByPlaceholderText('np. ACME'), {
            target: { value: 'BALTIC' },
        });

        // Click advisor to toggle assignment
        fireEvent.click(screen.getByText('Krzysztof Kowalczyk'));

        expect(screen.getByText('PRZYPISANY')).toBeInTheDocument();
        expect(screen.getByText('1', { selector: 'strong' })).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /Utwórz Spółkę/i }));

        await waitFor(() => {
            expect(apiClient.post).toHaveBeenCalledWith('/admin/companies', {
                name: 'Baltic Energy S.A.',
                code: 'BALTIC',
                tax_id: null,
                assigned_advisor_ids: ['user-adv-1'],
            });
        });

        expect(handleSuccess).toHaveBeenCalled();
    });

    it('displays server validation errors on 422 duplicate code response', async () => {
        apiClient.post.mockRejectedValueOnce({
            response: {
                status: 422,
                data: {
                    errors: {
                        code: ['Spółka o podanym kodzie już istnieje w systemie.'],
                    },
                },
            },
        });

        renderModal();

        const submitBtn = screen.getByRole('button', { name: /Utwórz Spółkę/i });

        await waitFor(() => {
            expect(submitBtn).not.toBeDisabled();
        });

        fireEvent.change(screen.getByPlaceholderText('np. Acme Manufacturing S.A.'), {
            target: { value: 'Acme Duplicate Sp. z o.o.' },
        });
        fireEvent.change(screen.getByPlaceholderText('np. ACME'), {
            target: { value: 'ACME' },
        });

        fireEvent.click(submitBtn);

        await waitFor(() => {
            expect(screen.getByText('Spółka o podanym kodzie już istnieje w systemie.')).toBeInTheDocument();
        });
    });

    it('closes on Anuluj click or Escape key', async () => {
        const handleClose = vi.fn();
        renderModal({ onClose: handleClose });

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /Utwórz Spółkę/i })).not.toBeDisabled();
        });

        fireEvent.click(screen.getByRole('button', { name: /Anuluj/i }));
        expect(handleClose).toHaveBeenCalledTimes(1);

        fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
        expect(handleClose).toHaveBeenCalledTimes(2);
    });
});
