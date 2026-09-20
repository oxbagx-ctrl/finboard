import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AcceptInvitationView } from '../../views/AcceptInvitationView';
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

const mockInvitationData = {
    valid: true,
    email: 'jan.nowak@acme.com',
    role: 'client',
    company: {
        id: 'comp-acme-1',
        name: 'Acme Manufacturing S.A.',
        code: 'ACME',
    },
    assigned_companies: [],
    expires_at: '2026-10-01T12:00:00Z',
};

const renderView = ({
    token = 'valid-crypto-token-12345678901234567890',
    onNavigateLogin = vi.fn(),
    loginMock = vi.fn(),
} = {}) => {
    return {
        loginMock,
        onNavigateLogin,
        ...render(
            <NotificationProvider>
                <AuthContext.Provider
                    value={{
                        user: null,
                        token: null,
                        isAuthenticated: false,
                        login: loginMock,
                    }}
                >
                    <AcceptInvitationView
                        token={token}
                        onNavigateLogin={onNavigateLogin}
                    />
                </AuthContext.Provider>
            </NotificationProvider>
        ),
    };
};

describe('AcceptInvitationView Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders missing token error when no token is provided', async () => {
        const handleLogin = vi.fn();
        renderView({ token: '', onNavigateLogin: handleLogin });

        expect(screen.getByText(/Brak tokenu zaproszenia w adresie URL/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Przejdź do strony logowania/i })).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /Przejdź do strony logowania/i }));
        expect(handleLogin).toHaveBeenCalledTimes(1);
    });

    it('performs verification call on mount with token param', async () => {
        apiClient.get.mockResolvedValueOnce({ data: mockInvitationData });

        renderView({ token: 'test-token-xyz' });

        expect(apiClient.get).toHaveBeenCalledWith('/invitations/verify', {
            params: { token: 'test-token-xyz' },
        });

        await waitFor(() => {
            expect(screen.getByText('jan.nowak@acme.com')).toBeInTheDocument();
        });

        expect(screen.getByText('KLIENT / CFO')).toBeInTheDocument();
        expect(screen.getByText(/Acme Manufacturing S\.A\./)).toBeInTheDocument();
    });

    it('displays error card when invitation token has expired or is invalid', async () => {
        apiClient.get.mockRejectedValueOnce({
            response: {
                status: 410,
                data: {
                    message: 'Link aktywacyjny zaproszenia wygasł. Poproś administratora o ponowne przesłanie zaproszenia.',
                },
            },
        });

        renderView({ token: 'expired-token' });

        await waitFor(() => {
            expect(screen.getByText(/Link aktywacyjny zaproszenia wygasł/i)).toBeInTheDocument();
        });

        expect(screen.getByText(/Nieprawidłowe lub wygasłe zaproszenie/i)).toBeInTheDocument();
        expect(screen.queryByPlaceholderText('Jan Kowalski')).not.toBeInTheDocument();
    });

    it('updates password strength indicators and checklists dynamically', async () => {
        apiClient.get.mockResolvedValueOnce({ data: mockInvitationData });

        renderView();

        await waitFor(() => {
            expect(screen.getByPlaceholderText('Jan Kowalski')).toBeInTheDocument();
        });

        const passwordInputs = screen.getAllByPlaceholderText('••••••••••••');
        const passwordInput = passwordInputs[0];
        const confirmInput = passwordInputs[1];

        // Type short password with only lowercase
        fireEvent.change(passwordInput, { target: { value: 'abc' } });
        expect(screen.getByText('Słabe')).toBeInTheDocument();

        // Add length and uppercase: Abcdefgh (>= 8 chars + upper = 2 criteria -> Średnie)
        fireEvent.change(passwordInput, { target: { value: 'Abcdefgh' } });
        expect(screen.getByText('Średnie')).toBeInTheDocument();

        // Add digit or special: Abcdefgh1! (>= 8 chars + upper + digit/special = 3 criteria -> Silne)
        fireEvent.change(passwordInput, { target: { value: 'Abcdefgh1!' } });
        expect(screen.getByText('Silne')).toBeInTheDocument();

        // Confirm password match
        fireEvent.change(confirmInput, { target: { value: 'Abcdefgh1!' } });
        expect(screen.getByText('Hasła są identyczne')).toBeInTheDocument();
    });

    it('validates required fields before submitting', async () => {
        apiClient.get.mockResolvedValueOnce({ data: mockInvitationData });

        renderView();

        await waitFor(() => {
            expect(screen.getByPlaceholderText('Jan Kowalski')).toBeInTheDocument();
        });

        const submitBtn = screen.getByRole('button', { name: /Aktywuj Konto i Zaloguj/i });
        fireEvent.click(submitBtn);

        await waitFor(() => {
            expect(screen.getByText('Imię i nazwisko jest wymagane.')).toBeInTheDocument();
            expect(screen.getByText('Hasło jest wymagane.')).toBeInTheDocument();
        });

        expect(apiClient.post).not.toHaveBeenCalled();
    });

    it('validates password confirmation mismatch', async () => {
        apiClient.get.mockResolvedValueOnce({ data: mockInvitationData });

        renderView();

        await waitFor(() => {
            expect(screen.getByPlaceholderText('Jan Kowalski')).toBeInTheDocument();
        });

        const nameInput = screen.getByPlaceholderText('Jan Kowalski');
        const passwordInputs = screen.getAllByPlaceholderText('••••••••••••');

        fireEvent.change(nameInput, { target: { value: 'Jan Nowak' } });
        fireEvent.change(passwordInputs[0], { target: { value: 'Secret123!' } });
        fireEvent.change(passwordInputs[1], { target: { value: 'DifferentSecret123!' } });

        const submitBtn = screen.getByRole('button', { name: /Aktywuj Konto i Zaloguj/i });
        fireEvent.click(submitBtn);

        await waitFor(() => {
            expect(screen.getByText('Hasła nie są identyczne.')).toBeInTheDocument();
        });

        expect(apiClient.post).not.toHaveBeenCalled();
    });

    it('submits valid activation payload and logs the user in', async () => {
        apiClient.get.mockResolvedValueOnce({ data: mockInvitationData });
        const mockAuthResponse = {
            message: 'Konto zostało pomyślnie aktywowane. Witamy w systemie FinBoard!',
            token: 'auth-jwt-token-999',
            token_type: 'Bearer',
            user: {
                id: 'user-new-1',
                name: 'Jan Nowak',
                email: 'jan.nowak@acme.com',
                role: 'client',
                company: mockInvitationData.company,
            },
            available_companies: [mockInvitationData.company],
        };
        apiClient.post.mockResolvedValueOnce({ data: mockAuthResponse });

        const { loginMock } = renderView({ token: 'secure-token-123' });

        await waitFor(() => {
            expect(screen.getByPlaceholderText('Jan Kowalski')).toBeInTheDocument();
        });

        const nameInput = screen.getByPlaceholderText('Jan Kowalski');
        const passwordInputs = screen.getAllByPlaceholderText('••••••••••••');

        fireEvent.change(nameInput, { target: { value: 'Jan Nowak' } });
        fireEvent.change(passwordInputs[0], { target: { value: 'ValidPassword123!' } });
        fireEvent.change(passwordInputs[1], { target: { value: 'ValidPassword123!' } });

        const submitBtn = screen.getByRole('button', { name: /Aktywuj Konto i Zaloguj/i });
        fireEvent.click(submitBtn);

        await waitFor(() => {
            expect(apiClient.post).toHaveBeenCalledWith('/invitations/accept', {
                token: 'secure-token-123',
                name: 'Jan Nowak',
                password: 'ValidPassword123!',
                password_confirmation: 'ValidPassword123!',
            });
        });

        // Banner displayed
        expect(await screen.findByText('Konto Zostało Pomyślnie Aktywowane!')).toBeInTheDocument();

        // Login callback triggered after timeout
        await waitFor(
            () => {
                expect(loginMock).toHaveBeenCalledWith(
                    mockAuthResponse.token,
                    mockAuthResponse.user,
                    mockAuthResponse.available_companies
                );
            },
            { timeout: 1500 }
        );
    });

    it('displays backend 422 validation errors if returned', async () => {
        apiClient.get.mockResolvedValueOnce({ data: mockInvitationData });
        apiClient.post.mockRejectedValueOnce({
            response: {
                status: 422,
                data: {
                    errors: {
                        password: ['Hasło musi zawierać co najmniej 8 znaków.'],
                    },
                },
            },
        });

        renderView({ token: 'valid-token' });

        await waitFor(() => {
            expect(screen.getByPlaceholderText('Jan Kowalski')).toBeInTheDocument();
        });

        const nameInput = screen.getByPlaceholderText('Jan Kowalski');
        const passwordInputs = screen.getAllByPlaceholderText('••••••••••••');

        fireEvent.change(nameInput, { target: { value: 'Jan Nowak' } });
        fireEvent.change(passwordInputs[0], { target: { value: 'ValidPass123!' } });
        fireEvent.change(passwordInputs[1], { target: { value: 'ValidPass123!' } });

        fireEvent.click(screen.getByRole('button', { name: /Aktywuj Konto i Zaloguj/i }));

        await waitFor(() => {
            expect(screen.getByText('Hasło musi zawierać co najmniej 8 znaków.')).toBeInTheDocument();
        });
    });
});
