import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TestMailModal } from '../../components/advisors/TestMailModal';
import { SmtpStatusWidget } from '../../components/advisors/SmtpStatusWidget';
import { NotificationProvider } from '../../context/NotificationContext';
import { AuthContext } from '../../context/AuthContext';
import apiClient from '../../api/client';

vi.mock('../../api/client', () => ({
    default: {
        get: vi.fn(),
        post: vi.fn(),
    },
}));

const mockUser = {
    id: 'user-admin-1',
    name: 'Super Partner Helvest',
    email: 'admin@helvest.com',
    role: 'super_admin',
};

const renderWithContext = (ui, user = mockUser) => {
    return render(
        <NotificationProvider>
            <AuthContext.Provider
                value={{
                    user,
                    isAdmin: true,
                    isSuperAdmin: true,
                    isAdvisor: false,
                    activeCompany: { id: 'comp-1', name: 'Acme Corp' },
                }}
            >
                {ui}
            </AuthContext.Provider>
        </NotificationProvider>
    );
};

describe('TestMailModal Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders nothing when isOpen is false', () => {
        renderWithContext(
            <TestMailModal isOpen={false} onClose={vi.fn()} />
        );
        expect(screen.queryByText('Diagnostyka Połączenia SMTP')).not.toBeInTheDocument();
    });

    it('renders modal with default recipient from current user', () => {
        renderWithContext(<TestMailModal isOpen={true} onClose={vi.fn()} />);

        expect(screen.getByText('Diagnostyka Połączenia SMTP')).toBeInTheDocument();
        const input = screen.getByPlaceholderText('np. admin@helvest.com');
        expect(input).toBeInTheDocument();
        expect(input.value).toBe('admin@helvest.com');
    });

    it('validates email format before sending', async () => {
        renderWithContext(<TestMailModal isOpen={true} onClose={vi.fn()} />);

        const input = screen.getByPlaceholderText('np. admin@helvest.com');
        fireEvent.change(input, { target: { value: 'not-an-email' } });

        const submitBtn = screen.getByRole('button', { name: /Wyślij Email Testowy/i });
        fireEvent.click(submitBtn);

        expect(await screen.findByText('Wprowadzono niepoprawny format adresu e-mail.')).toBeInTheDocument();
        expect(apiClient.post).not.toHaveBeenCalled();
    });

    it('successfully sends test email and displays response with latency', async () => {
        apiClient.post.mockResolvedValueOnce({
            data: {
                status: 'success',
                latency_ms: 145,
                message: 'Wiadomość testowa została pomyślnie wysłana do: test@helvest.pl.',
                recipient: 'test@helvest.pl',
            },
        });

        const onSuccessMock = vi.fn();
        renderWithContext(
            <TestMailModal
                isOpen={true}
                onClose={vi.fn()}
                onSuccess={onSuccessMock}
            />
        );

        const input = screen.getByPlaceholderText('np. admin@helvest.com');
        fireEvent.change(input, { target: { value: 'test@helvest.pl' } });

        const submitBtn = screen.getByRole('button', { name: /Wyślij Email Testowy/i });
        fireEvent.click(submitBtn);

        await waitFor(() => {
            expect(apiClient.post).toHaveBeenCalledWith('/admin/mail/test', {
                recipient: 'test@helvest.pl',
            });
        });

        expect(await screen.findByText('Wysyłka Zakończona Sukcesem')).toBeInTheDocument();
        expect(screen.getAllByText(/145 ms/i).length).toBeGreaterThan(0);
        expect(onSuccessMock).toHaveBeenCalledWith(
            expect.objectContaining({ success: true, latency_ms: 145 })
        );
    });

    it('handles SMTP connection failure and displays error message with OCI guidance', async () => {
        apiClient.post.mockRejectedValueOnce({
            response: {
                data: {
                    status: 'error',
                    message: 'Connection timed out on host mail.helvest.pl:25',
                    latency_ms: 5002,
                },
            },
        });

        renderWithContext(<TestMailModal isOpen={true} onClose={vi.fn()} />);

        const submitBtn = screen.getByRole('button', { name: /Wyślij Email Testowy/i });
        fireEvent.click(submitBtn);

        expect(await screen.findByText('Błąd Dostarczenia Wiadomości')).toBeInTheDocument();
        expect(screen.getAllByText(/Connection timed out on host mail.helvest.pl:25/i).length).toBeGreaterThan(0);
        expect(screen.getByText(/Oracle Cloud OCI/i)).toBeInTheDocument();
    });

    it('triggers onClose callback when clicking close button', () => {
        const handleClose = vi.fn();
        renderWithContext(<TestMailModal isOpen={true} onClose={handleClose} />);

        const closeBtns = screen.getAllByRole('button', { name: /Zamknij/i });
        fireEvent.click(closeBtns[0]);
        expect(handleClose).toHaveBeenCalledTimes(1);
    });
});

describe('SmtpStatusWidget Component', () => {
    const mockStatusSuccess = {
        mailer: 'smtp',
        host: 'mail.helvest.pl',
        port: 587,
        encryption: 'tls',
        username: 'invitations@helvest.pl',
        has_password: true,
        from_address: 'deal-advisory@helvest.pl',
        from_name: 'FinBoard Deal Advisory',
        timeout: 15,
        is_port_25_warning: false,
        is_secure_port: true,
        socket: {
            connected: true,
            latency_ms: 42,
            banner: '220 mail.helvest.pl ESMTP Postfix',
            error_code: null,
            error_message: null,
        },
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('loads and renders full SMTP status information and banner', async () => {
        apiClient.get.mockResolvedValueOnce({
            data: { data: mockStatusSuccess },
        });

        const handleOpenTest = vi.fn();
        renderWithContext(
            <SmtpStatusWidget onOpenTestModal={handleOpenTest} />
        );

        await waitFor(() => {
            expect(apiClient.get).toHaveBeenCalledWith('/admin/mail/status');
        });

        expect(await screen.findByText('POŁĄCZENIE AKTYWNE')).toBeInTheDocument();
        expect(screen.getByText('mail.helvest.pl:587')).toBeInTheDocument();
        expect(screen.getByText(/Szyfrowanie:/i)).toBeInTheDocument();
        expect(screen.getByText(/TLS/i)).toBeInTheDocument();
        expect(screen.getByText('deal-advisory@helvest.pl')).toBeInTheDocument();
        expect(screen.getByText(/POŁĄCZONO \(42 ms\)/i)).toBeInTheDocument();
        expect(screen.getByText(/220 mail.helvest.pl ESMTP Postfix/i)).toBeInTheDocument();

        // Clicking test button triggers onOpenTestModal
        const testBtn = screen.getByRole('button', { name: /Wyślij Test SMTP/i });
        fireEvent.click(testBtn);
        expect(handleOpenTest).toHaveBeenCalledTimes(1);
    });

    it('displays warning when port 25 is configured', async () => {
        const mockStatusPort25 = {
            ...mockStatusSuccess,
            port: 25,
            is_port_25_warning: true,
            is_secure_port: false,
        };

        apiClient.get.mockResolvedValueOnce({
            data: { data: mockStatusPort25 },
        });

        renderWithContext(<SmtpStatusWidget onOpenTestModal={vi.fn()} />);

        expect(await screen.findByText(/Uwaga: Wykryto port 25/i)).toBeInTheDocument();
        expect(screen.getByText(/Oracle Cloud Infrastructure OCI/i)).toBeInTheDocument();
    });

    it('renders compact mode with offline/online badge', async () => {
        apiClient.get.mockResolvedValueOnce({
            data: { data: mockStatusSuccess },
        });

        const handleOpenTest = vi.fn();
        renderWithContext(
            <SmtpStatusWidget compact={true} onOpenTestModal={handleOpenTest} />
        );

        expect(await screen.findByText('ONLINE (42ms)')).toBeInTheDocument();
        expect(screen.getByText('mail.helvest.pl:587')).toBeInTheDocument();

        const testBtn = screen.getByRole('button', { name: /Testuj SMTP/i });
        fireEvent.click(testBtn);
        expect(handleOpenTest).toHaveBeenCalledTimes(1);
    });
});
