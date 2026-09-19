import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { InviteUserModal } from '../../components/advisors/InviteUserModal';
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

const mockCompanies = [
    {
        id: 'comp-acme-1',
        name: 'Acme Manufacturing S.A.',
        code: 'ACME',
        tax_id: '525-00-11-222',
    },
    {
        id: 'comp-helvest-2',
        name: 'Helvest Advisory Sp. z o.o.',
        code: 'HELVEST',
        tax_id: '701-99-88-777',
    },
];

const mockSuperAdminUser = {
    id: 'user-admin-1',
    name: 'Super Partner Helvest',
    email: 'admin@helvest.com',
    role: 'super_admin',
};

const mockAdvisorUser = {
    id: 'user-adv-2',
    name: 'Krzysztof Kowalczyk',
    email: 'krzysztof@helvest.com',
    role: 'advisor',
};

const renderModal = ({
    isOpen = true,
    onClose = vi.fn(),
    onSuccess = vi.fn(),
    user = mockSuperAdminUser,
    isSuperAdmin = true,
    isAdvisor = false,
    companies = mockCompanies,
} = {}) => {
    return render(
        <NotificationProvider>
            <AuthContext.Provider
                value={{
                    user,
                    isAdmin: true,
                    isSuperAdmin,
                    isAdvisor,
                    isClient: false,
                    activeCompany: companies[0],
                    availableCompanies: companies,
                }}
            >
                <InviteUserModal
                    isOpen={isOpen}
                    onClose={onClose}
                    onSuccess={onSuccess}
                />
            </AuthContext.Provider>
        </NotificationProvider>
    );
};

describe('InviteUserModal Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        apiClient.get.mockResolvedValue({ data: { data: mockCompanies } });
    });

    it('does not render when isOpen is false', () => {
        renderModal({ isOpen: false });
        expect(screen.queryByText('Zaproś Nowego Użytkownika')).not.toBeInTheDocument();
    });

    it('renders modal dialog with zero-trust callout and form inputs', async () => {
        renderModal();

        expect(screen.getByText('Zaproś Nowego Użytkownika')).toBeInTheDocument();
        expect(screen.getByText(/Zasada zerowego zaufania/i)).toBeInTheDocument();
        expect(screen.getByPlaceholderText('cfo@spolka-portfelowa.pl')).toBeInTheDocument();

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /Wyślij Zaproszenie E-mail/i })).not.toBeDisabled();
        });

        // Default role is client
        expect(screen.getByText('Przypisana Spółka Portfelowa')).toBeInTheDocument();
    });

    it('validates required email and company selection', async () => {
        renderModal();

        const submitBtn = screen.getByRole('button', { name: /Wyślij Zaproszenie E-mail/i });

        await waitFor(() => {
            expect(submitBtn).not.toBeDisabled();
        });

        fireEvent.click(submitBtn);

        // Validation error for empty email
        await waitFor(() => {
            expect(screen.getByText('Adres e-mail jest wymagany.')).toBeInTheDocument();
        });

        expect(apiClient.post).not.toHaveBeenCalled();
    });

    it('validates invalid email format', async () => {
        renderModal();

        const submitBtn = screen.getByRole('button', { name: /Wyślij Zaproszenie E-mail/i });

        await waitFor(() => {
            expect(submitBtn).not.toBeDisabled();
        });

        const emailInput = screen.getByPlaceholderText('cfo@spolka-portfelowa.pl');
        fireEvent.change(emailInput, { target: { value: 'nie-poprawny-email' } });

        fireEvent.click(submitBtn);

        await waitFor(() => {
            expect(screen.getByText('Wprowadź prawidłowy adres e-mail.')).toBeInTheDocument();
        });

        expect(apiClient.post).not.toHaveBeenCalled();
    });

    it('submits valid client invitation via API', async () => {
        const handleSuccess = vi.fn();
        const handleClose = vi.fn();

        apiClient.post.mockResolvedValueOnce({
            data: {
                message: 'Zaproszenie zostało pomyślnie utworzone i wysłane.',
                data: {
                    id: 'inv-new-1',
                    email: 'cfo@acme.com',
                    role: 'client',
                    status: 'pending',
                },
            },
        });

        renderModal({ onSuccess: handleSuccess, onClose: handleClose });

        const submitBtn = screen.getByRole('button', { name: /Wyślij Zaproszenie E-mail/i });

        await waitFor(() => {
            expect(submitBtn).not.toBeDisabled();
        });

        const emailInput = screen.getByPlaceholderText('cfo@spolka-portfelowa.pl');
        fireEvent.change(emailInput, { target: { value: 'cfo@acme.com' } });

        fireEvent.click(submitBtn);

        await waitFor(() => {
            expect(apiClient.post).toHaveBeenCalledWith('/invitations', {
                email: 'cfo@acme.com',
                role: 'client',
                company_id: 'comp-acme-1',
                validity_hours: 48,
            });
        });

        expect(handleSuccess).toHaveBeenCalledTimes(1);
        expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('allows SuperAdmin to invite an Advisor and select pre-assigned companies', async () => {
        const handleSuccess = vi.fn();
        const handleClose = vi.fn();

        apiClient.post.mockResolvedValueOnce({
            data: {
                message: 'Zaproszenie wysłane.',
                data: { id: 'inv-adv-1', email: 'analityk@helvest.com', role: 'advisor' },
            },
        });

        renderModal({ onSuccess: handleSuccess, onClose: handleClose });

        const submitBtn = screen.getByRole('button', { name: /Wyślij Zaproszenie E-mail/i });

        await waitFor(() => {
            expect(submitBtn).not.toBeDisabled();
        });

        // Switch role to advisor
        const advisorRoleBtn = screen.getByText('Doradca M&A');
        fireEvent.click(advisorRoleBtn);

        await waitFor(() => {
            expect(screen.getByText('Początkowe Przypisanie Spółek Portfelowych')).toBeInTheDocument();
        });

        // Enter email
        const emailInput = screen.getByPlaceholderText('cfo@spolka-portfelowa.pl');
        fireEvent.change(emailInput, { target: { value: 'analityk@helvest.com' } });

        // Select all companies
        fireEvent.click(screen.getByText('Wszystkie'));

        // Submit
        fireEvent.click(submitBtn);

        await waitFor(() => {
            expect(apiClient.post).toHaveBeenCalledWith('/invitations', {
                email: 'analityk@helvest.com',
                role: 'advisor',
                assigned_company_ids: ['comp-acme-1', 'comp-helvest-2'],
                validity_hours: 48,
            });
        });

        expect(handleSuccess).toHaveBeenCalled();
    });

    it('locks role to client when logged in as Advisor', async () => {
        renderModal({
            user: mockAdvisorUser,
            isSuperAdmin: false,
            isAdvisor: true,
        });

        // Role buttons for advisor / super_admin should not be interactive
        expect(screen.queryByText('Super Admin')).not.toBeInTheDocument();
        expect(screen.getByText('Uprawnienia doradcy')).toBeInTheDocument();
        expect(screen.getByText('KLIENT / CFO')).toBeInTheDocument();
    });

    it('displays server validation errors if API returns 422', async () => {
        apiClient.post.mockRejectedValueOnce({
            response: {
                status: 422,
                data: {
                    errors: {
                        email: ['Użytkownik o tym adresie e-mail jest już zarejestrowany w systemie.'],
                    },
                },
            },
        });

        renderModal();

        const submitBtn = screen.getByRole('button', { name: /Wyślij Zaproszenie E-mail/i });

        await waitFor(() => {
            expect(submitBtn).not.toBeDisabled();
        });

        const emailInput = screen.getByPlaceholderText('cfo@spolka-portfelowa.pl');
        fireEvent.change(emailInput, { target: { value: 'existing@acme.com' } });

        fireEvent.click(submitBtn);

        await waitFor(() => {
            expect(screen.getByText('Użytkownik o tym adresie e-mail jest już zarejestrowany w systemie.')).toBeInTheDocument();
        });
    });
    it('reactively updates company list when a new company is created or event dispatched', async () => {
        renderModal({
            companies: [mockCompanies[0]],
        });

        await waitFor(() => {
            expect(screen.getByText(/\[ACME\] Acme Manufacturing S.A./i)).toBeInTheDocument();
        });

        const newCompany = {
            id: 'comp-brand-new-99',
            name: 'Delta Ventures Sp. z o.o.',
            code: 'DELTA',
            tax_id: 'PL9998887766',
        };

        fireEvent(window, new CustomEvent('finboard:company-created', { detail: newCompany }));

        await waitFor(() => {
            expect(screen.getByText(/\[DELTA\] Delta Ventures Sp. z o.o./i)).toBeInTheDocument();
        });
    });
});
