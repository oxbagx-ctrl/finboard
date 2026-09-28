import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App } from '../../App';
import apiClient from '../../api/client';
import { ROUTES } from '../../constants/routes';

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
    name: 'Jan Kowalski',
    email: 'jan.kowalski@finboard.test',
    role: 'admin',
    company: {
        id: 'comp-1',
        name: 'Acme Advisory S.A.',
        code: 'ACME',
    },
};

const mockClientUser = {
    id: 'user-client-1',
    name: 'Piotr Klient',
    email: 'piotr.klient@acme.com',
    role: 'client',
    company: {
        id: 'comp-1',
        name: 'Acme Advisory S.A.',
        code: 'ACME',
    },
};

const setupApiMocks = () => {
    apiClient.get.mockImplementation((url) => {
        if (url === '/auth/me') {
            return Promise.resolve({ data: { user: mockAdminUser } });
        }
        if (url.startsWith('/finance/analytics')) {
            return Promise.resolve({
                data: {
                    metrics: {
                        revenue: 2500000,
                        ebitda: 600000,
                        net_profit: 450000,
                        cash: 1200000,
                    },
                    historical: [],
                },
            });
        }
        if (url.startsWith('/finance/records')) {
            return Promise.resolve({
                data: {
                    data: [],
                    current_page: 1,
                    last_page: 1,
                    total: 0,
                },
            });
        }
        if (url.startsWith('/finance/imports/history')) {
            return Promise.resolve({ data: { data: [] } });
        }
        if (url.startsWith('/documents/matrix') || url.startsWith('/documents')) {
            return Promise.resolve({ data: { data: [] } });
        }
        if (url.startsWith('/finance/audit-logs')) {
            return Promise.resolve({
                data: {
                    data: [],
                    total: 0,
                    stats: { total: 0, created: 0, updated: 0, deleted: 0 },
                },
            });
        }
        if (url.startsWith('/tenant/advisors') || url.startsWith('/tenant/invitations')) {
            return Promise.resolve({ data: { data: [] } });
        }
        if (url.startsWith('/tenant/companies')) {
            return Promise.resolve({ data: { data: [mockAdminUser.company] } });
        }
        if (url.startsWith('/investment-projects')) {
            return Promise.resolve({ data: { data: [] } });
        }
        return Promise.resolve({ data: {} });
    });

    apiClient.post.mockImplementation((url) => {
        if (url === '/auth/login') {
            return Promise.resolve({
                data: {
                    token: 'valid-test-token',
                    user: mockAdminUser,
                    available_companies: [mockAdminUser.company],
                },
            });
        }
        if (url === '/auth/logout') {
            return Promise.resolve({ data: { message: 'Logged out successfully' } });
        }
        return Promise.resolve({ data: {} });
    });
};

describe('SPA Routing & End-to-End Navigation Integration Suite (Phase 59 Commit 293)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        setupApiMocks();
    });

    afterEach(() => {
        localStorage.clear();
    });

    it('redirects unauthenticated visitor from /dashboard to /login and renders LoginView', async () => {
        render(
            <MemoryRouter initialEntries={[ROUTES.DASHBOARD]}>
                <App />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /Uwierzytelnij w portalu/i })).toBeInTheDocument();
        });

        expect(screen.getByPlaceholderText('analityk@helvest.com')).toBeInTheDocument();
    });

    it('preserves deep-link location and redirects user after successful authentication', async () => {
        const { container } = render(
            <MemoryRouter initialEntries={['/records']}>
                <App />
            </MemoryRouter>
        );

        // 1. Should be redirected to /login with state.from = /records
        await waitFor(() => {
            expect(screen.getByRole('button', { name: /Uwierzytelnij w portalu/i })).toBeInTheDocument();
        });

        // 2. Fill login form
        fireEvent.change(screen.getByPlaceholderText('analityk@helvest.com'), {
            target: { value: 'jan.kowalski@finboard.test' },
        });
        fireEvent.change(container.querySelector('input[type="password"]'), {
            target: { value: 'SecretPassword123!' },
        });

        // 3. Submit login
        fireEvent.click(screen.getByRole('button', { name: /Uwierzytelnij w portalu/i }));

        // 4. User should transition to the deep-linked destination /records
        await waitFor(() => {
            expect(screen.getByText('Księga Transakcji Finansowych')).toBeInTheDocument();
        });
    });

    it('navigates seamlessly across multiple analytical modules via Sidebar NavLinks with active indicators', async () => {
        // Preset authenticated state in localStorage
        localStorage.setItem('finboard_token', 'mock-valid-jwt');
        localStorage.setItem('finboard_user', JSON.stringify(mockAdminUser));
        localStorage.setItem('finboard_active_company', JSON.stringify(mockAdminUser.company));

        render(
            <MemoryRouter initialEntries={[ROUTES.DASHBOARD]}>
                <App />
            </MemoryRouter>
        );

        // Verify Dashboard view loaded
        await waitFor(() => {
            expect(screen.getByText('Pulpit Zarządczy (Executive Overview)')).toBeInTheDocument();
        });

        // 1. Navigate to Analytics via Sidebar link
        const analyticsLink = screen.getByRole('link', { name: /Analiza P&L i Wskaźniki/i });
        fireEvent.click(analyticsLink);

        await waitFor(() => {
            expect(screen.getByText('Analityka P&L, Marże i Wskaźniki Płynności')).toBeInTheDocument();
        });
        expect(analyticsLink.className).toContain('border-l-2');

        // 2. Navigate to Records view
        const recordsLink = screen.getByRole('link', { name: /Ewidencja Operacji/i });
        fireEvent.click(recordsLink);

        await waitFor(() => {
            expect(screen.getByText('Księga Transakcji Finansowych')).toBeInTheDocument();
        });
        expect(recordsLink.className).toContain('border-l-2');

        // 3. Navigate to Reports view
        const reportsLink = screen.getByRole('link', { name: /Raporty Zarządcze & PDF/i });
        fireEvent.click(reportsLink);

        await waitFor(() => {
            expect(screen.getByText('Raporty Zarządcze & Generator PDF')).toBeInTheDocument();
        });
        expect(reportsLink.className).toContain('border-l-2');
    });

    it('enforces RBAC on protected route /advisors and blocks unauthorized client role', async () => {
        // Authenticated as standard client (no super_admin, admin or advisor permissions)
        localStorage.setItem('finboard_token', 'mock-client-jwt');
        localStorage.setItem('finboard_user', JSON.stringify(mockClientUser));
        localStorage.setItem('finboard_active_company', JSON.stringify(mockClientUser.company));

        apiClient.get.mockImplementation((url) => {
            if (url === '/auth/me') {
                return Promise.resolve({ data: { user: mockClientUser } });
            }
            return Promise.resolve({ data: { data: [] } });
        });

        render(
            <MemoryRouter initialEntries={[ROUTES.ADVISORS]}>
                <App />
            </MemoryRouter>
        );

        // Client should be denied access and bounced to /dashboard
        await waitFor(() => {
            expect(screen.getByText('Pulpit Zarządczy (Executive Overview)')).toBeInTheDocument();
        });

        // Warning notification should be visible on screen
        expect(screen.getByText('Brak uprawnień do przeglądania wybranego modułu.')).toBeInTheDocument();
    });

    it('renders dedicated NotFoundView with URI diagnostics when navigating to an unregistered route', async () => {
        localStorage.setItem('finboard_token', 'mock-valid-jwt');
        localStorage.setItem('finboard_user', JSON.stringify(mockAdminUser));
        localStorage.setItem('finboard_active_company', JSON.stringify(mockAdminUser.company));

        render(
            <MemoryRouter initialEntries={['/nieistniejaca-sciezka-404']}>
                <App />
            </MemoryRouter>
        );

        // Should render institutional 404 terminal
        await waitFor(() => {
            expect(screen.getByText('404: Zasób Nie Został Odnaleziony')).toBeInTheDocument();
        });

        // Should display the requested invalid path
        expect(screen.getByTestId('404-requested-path')).toHaveTextContent('/nieistniejaca-sciezka-404');

        // Clicking "Pulpit Zarządczy" should navigate back to dashboard
        const dashboardBtn = screen.getByRole('link', { name: /Pulpit Zarządczy/i });
        fireEvent.click(dashboardBtn);

        await waitFor(() => {
            expect(screen.getByText('Pulpit Zarządczy (Executive Overview)')).toBeInTheDocument();
        });
    });

    it('terminates user session on logout and redirects cleanly to /login', async () => {
        localStorage.setItem('finboard_token', 'mock-valid-jwt');
        localStorage.setItem('finboard_user', JSON.stringify(mockAdminUser));
        localStorage.setItem('finboard_active_company', JSON.stringify(mockAdminUser.company));

        render(
            <MemoryRouter initialEntries={[ROUTES.DASHBOARD]}>
                <App />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('Pulpit Zarządczy (Executive Overview)')).toBeInTheDocument();
        });

        // Click logout button in sidebar
        const logoutBtn = screen.getByRole('button', { name: 'Zakończ sesję' });
        fireEvent.click(logoutBtn);

        // Verify redirect to LoginView
        await waitFor(() => {
            expect(screen.getByRole('button', { name: /Uwierzytelnij w portalu/i })).toBeInTheDocument();
        });

        // Token should be removed from localStorage
        expect(localStorage.getItem('finboard_token')).toBeNull();
    });
});
