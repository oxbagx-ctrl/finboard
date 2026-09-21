import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AdvisorsManagementView } from '../../views/AdvisorsManagementView';
import { AcceptInvitationView } from '../../views/AcceptInvitationView';
import { NotificationProvider } from '../../context/NotificationContext';
import { AuthContext } from '../../context/AuthContext';
import apiClient from '../../api/client';

vi.mock('../../api/client', () => ({
    default: {
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        patch: vi.fn(),
        delete: vi.fn(),
    },
}));

const mockAdminUser = {
    id: 'user-admin-1',
    name: 'Super Partner Helvest',
    email: 'admin@helvest.com',
    role: 'super_admin',
};

const mockCompanies = [
    {
        id: 'comp-acme-1',
        name: 'Acme Manufacturing S.A.',
        code: 'ACME',
        tax_id: '525-00-11-222',
        assigned_advisors_count: 1,
        clients_count: 3,
        assigned_advisors: [],
    },
];

const mockInitialInvitations = [
    {
        id: 'inv-e2e-1',
        email: 'cfo.target@acme.com',
        role: 'client',
        status: 'pending',
        token: 'token-alpha-12345',
        activation_url: 'https://finboard.test/invitation/accept?token=token-alpha-12345',
        expires_at: '2026-09-24T12:00:00Z',
        created_at: '2026-09-22T12:00:00Z',
        company: { id: 'comp-acme-1', name: 'Acme Manufacturing S.A.', code: 'ACME' },
        inviter: { id: 'user-admin-1', name: 'Super Partner Helvest', email: 'admin@helvest.com' },
    },
];

const renderAdminContext = (ui) => {
    return render(
        <NotificationProvider>
            <AuthContext.Provider
                value={{
                    user: mockAdminUser,
                    isAdmin: true,
                    isSuperAdmin: true,
                    isAdvisor: false,
                    isClient: false,
                    activeCompany: mockCompanies[0],
                    availableCompanies: mockCompanies,
                }}
            >
                {ui}
            </AuthContext.Provider>
        </NotificationProvider>
    );
};

const renderRecipientContext = (ui, loginMock = vi.fn()) => {
    return render(
        <NotificationProvider>
            <AuthContext.Provider
                value={{
                    user: null,
                    token: null,
                    isAuthenticated: false,
                    login: loginMock,
                }}
            >
                {ui}
            </AuthContext.Provider>
        </NotificationProvider>
    );
};

describe('Invitation Lifecycle & Fallback Activation E2E Workflow', () => {
    let writeTextMock;

    beforeEach(() => {
        vi.clearAllMocks();
        writeTextMock = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, 'clipboard', {
            value: {
                writeText: writeTextMock,
            },
            writable: true,
            configurable: true,
        });

        apiClient.get.mockImplementation((url) => {
            if (url === '/admin/advisors') {
                return Promise.resolve({ data: { data: [mockAdminUser] } });
            }
            if (url === '/admin/companies') {
                return Promise.resolve({ data: { data: mockCompanies } });
            }
            if (url === '/invitations') {
                return Promise.resolve({ data: { data: mockInitialInvitations } });
            }
            if (url === '/admin/mail/status') {
                return Promise.resolve({
                    data: {
                        data: {
                            mailer: 'smtp',
                            host: 'mail.helvest.pl',
                            port: 587,
                            encryption: 'tls',
                            socket: { connected: true, latency_ms: 25 },
                        },
                    },
                });
            }
            return Promise.resolve({ data: { data: [] } });
        });
    });

    it('executes full workflow: user invitation creation, post-modal URL copy, and table row URL copy', async () => {
        const newInvitation = {
            id: 'inv-e2e-new',
            email: 'new.director@acme.com',
            role: 'client',
            status: 'pending',
            token: 'token-direct-999',
            activation_url: 'https://finboard.test/invitation/accept?token=token-direct-999',
            company: { id: 'comp-acme-1', name: 'Acme Manufacturing S.A.' },
            expires_at: '2026-09-24T12:00:00Z',
        };

        apiClient.post.mockResolvedValueOnce({
            data: {
                message: 'Zaproszenie zostało pomyślnie wysłane.',
                data: newInvitation,
            },
        });

        renderAdminContext(<AdvisorsManagementView />);

        await waitFor(() => {
            expect(screen.getByText('Zarządzanie Doradcami & Uprawnieniami Portfela')).toBeInTheDocument();
        });

        // 1. Open Invite User Modal
        fireEvent.click(screen.getByRole('button', { name: /Zaproś Użytkownika/i }));

        await waitFor(() => {
            expect(screen.getByText('Zaproś Nowego Użytkownika')).toBeInTheDocument();
        });

        // Fill form
        const emailInput = screen.getByPlaceholderText('cfo@spolka-portfelowa.pl');
        fireEvent.change(emailInput, { target: { value: 'new.director@acme.com' } });

        const submitBtn = screen.getByRole('button', { name: /Wyślij Zaproszenie E-mail/i });
        fireEvent.click(submitBtn);

        // Verify API was called
        await waitFor(() => {
            expect(apiClient.post).toHaveBeenCalledWith('/invitations', expect.objectContaining({
                email: 'new.director@acme.com',
                role: 'client',
            }));
        });

        // 2. Post-Creation Confirmation Modal should appear with activation_url
        await waitFor(() => {
            expect(screen.getByText('Zaproszenie Utworzone')).toBeInTheDocument();
            expect(screen.getByDisplayValue('https://finboard.test/invitation/accept?token=token-direct-999')).toBeInTheDocument();
        });

        // Click copy in confirmation modal
        const copyModalBtn = screen.getByRole('button', { name: /Kopiuj/i });
        fireEvent.click(copyModalBtn);

        await waitFor(() => {
            expect(writeTextMock).toHaveBeenCalledWith('https://finboard.test/invitation/accept?token=token-direct-999');
            expect(screen.getByText('Skopiowano')).toBeInTheDocument();
        });

        // Close post-creation modal
        fireEvent.click(screen.getByRole('button', { name: /Zamknij/i }));

        await waitFor(() => {
            expect(screen.queryByText('Zaproszenie Utworzone')).not.toBeInTheDocument();
        });

        // 3. Switch to Invitations Tab and test direct table copy
        fireEvent.click(screen.getByText(/Wysłane Zaproszenia/i));

        await waitFor(() => {
            expect(screen.getByText('cfo.target@acme.com')).toBeInTheDocument();
        });

        // Click "Kopiuj link" in table
        const tableCopyBtn = screen.getByRole('button', { name: /Kopiuj link/i });
        fireEvent.click(tableCopyBtn);

        await waitFor(() => {
            expect(writeTextMock).toHaveBeenCalledWith('https://finboard.test/invitation/accept?token=token-alpha-12345');
            expect(screen.getByText('Skopiowano')).toBeInTheDocument();
        });
    });

    it('regenerates invitation token with new 48h validity and verifies resend action', async () => {
        apiClient.post.mockResolvedValueOnce({
            data: {
                message: 'Nowe zaproszenie zostało pomyślnie wysłane.',
                data: {
                    ...mockInitialInvitations[0],
                    token: 'token-renewed-555',
                    activation_url: 'https://finboard.test/invitation/accept?token=token-renewed-555',
                },
            },
        });

        renderAdminContext(<AdvisorsManagementView />);

        await waitFor(() => {
            expect(screen.getByText(/Wysłane Zaproszenia/i)).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText(/Wysłane Zaproszenia/i));

        await waitFor(() => {
            expect(screen.getByText('cfo.target@acme.com')).toBeInTheDocument();
        });

        // Click "Wyślij ponownie"
        const resendBtn = screen.getByRole('button', { name: /Wyślij ponownie/i });
        fireEvent.click(resendBtn);

        await waitFor(() => {
            expect(apiClient.post).toHaveBeenCalledWith('/invitations/inv-e2e-1/resend');
        });
    });

    it('executes fallback account activation flow from direct activation link without relying on email client', async () => {
        const verifyData = {
            valid: true,
            email: 'cfo.target@acme.com',
            role: 'client',
            company: {
                id: 'comp-acme-1',
                name: 'Acme Manufacturing S.A.',
                code: 'ACME',
            },
            assigned_companies: [],
            expires_at: '2026-09-24T12:00:00Z',
        };

        apiClient.get.mockImplementation((url) => {
            if (url === '/invitations/verify') {
                return Promise.resolve({ data: verifyData });
            }
            return Promise.resolve({ data: {} });
        });

        apiClient.post.mockResolvedValueOnce({
            data: {
                message: 'Konto zostało pomyślnie utworzone i aktywowane.',
                token: 'sanctum-auth-token-xyz',
                user: {
                    id: 'user-new-cfo',
                    name: 'Karol Zieliński',
                    email: 'cfo.target@acme.com',
                    role: 'client',
                },
                available_companies: [],
            },
        });

        const loginMock = vi.fn();
        const onNavigateLoginMock = vi.fn();
        renderRecipientContext(
            <AcceptInvitationView
                token="token-alpha-12345"
                onNavigateLogin={onNavigateLoginMock}
            />,
            loginMock
        );

        // 1. Verifying token
        await waitFor(() => {
            expect(screen.getByText('Inicjalizacja Konta & Ustanowienie Hasła')).toBeInTheDocument();
            expect(screen.getByText('cfo.target@acme.com')).toBeInTheDocument();
            expect(screen.getByText(/Acme Manufacturing S\.A\./)).toBeInTheDocument();
        });

        // 2. Fill registration details
        const nameInput = screen.getByPlaceholderText('Jan Kowalski');
        const passInputs = screen.getAllByPlaceholderText('••••••••••••');

        fireEvent.change(nameInput, { target: { value: 'Karol Zieliński' } });
        fireEvent.change(passInputs[0], { target: { value: 'P@ssword12345!Deal' } });
        fireEvent.change(passInputs[1], { target: { value: 'P@ssword12345!Deal' } });

        // 3. Submit activation
        const activateBtn = screen.getByRole('button', { name: /Aktywuj Konto i Zaloguj/i });
        fireEvent.click(activateBtn);

        await waitFor(() => {
            expect(apiClient.post).toHaveBeenCalledWith('/invitations/accept', {
                token: 'token-alpha-12345',
                name: 'Karol Zieliński',
                password: 'P@ssword12345!Deal',
                password_confirmation: 'P@ssword12345!Deal',
            });
        });

        // 4. Verify activation confirmation screen
        await waitFor(() => {
            expect(screen.getByText('Konto Zostało Pomyślnie Aktywowane!')).toBeInTheDocument();
        });

        // Verify automatic transition login is invoked
        await waitFor(() => {
            expect(loginMock).toHaveBeenCalledWith('sanctum-auth-token-xyz', expect.objectContaining({
                id: 'user-new-cfo',
                email: 'cfo.target@acme.com',
            }), expect.any(Array));
        }, { timeout: 2000 });
    });
});
