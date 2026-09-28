import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Sidebar } from '../../components/layout/Sidebar';
import { renderWithRouter } from '../utils/renderWithRouter';
import { ROUTES } from '../../constants/routes';
import { AuthContext } from '../../context/AuthContext';
import { NotificationProvider } from '../../context/NotificationContext';

describe('Sidebar Navigation Suite (Phase 59 Commit 292)', () => {
    it('renders institutional branding, logo, and active company details', () => {
        renderWithRouter(<Sidebar isOpen={false} />, {
            route: ROUTES.DASHBOARD,
            authContext: {
                activeCompany: { code: 'HELV', name: 'Helvest Capital Sp. z o.o.' },
                user: { name: 'Aleksandra Nowak', role: 'admin' },
                isAdmin: true,
            },
        });

        expect(screen.getByText('FB')).toBeInTheDocument();
        expect(screen.getByText('FinBoard')).toBeInTheDocument();
        expect(screen.getByText('HELVEST ADVISORY')).toBeInTheDocument();
        expect(screen.getByText('ENTERPRISE')).toBeInTheDocument();
        expect(screen.getByText('HELV')).toBeInTheDocument();
        expect(screen.getByText('Helvest Capital Sp. z o.o.')).toBeInTheDocument();
        expect(screen.getByText('Aleksandra Nowak')).toBeInTheDocument();
        expect(screen.getByText('ROLA: ADMIN / DORADCA')).toBeInTheDocument();
    });

    it('renders all 8 base analytical modules as semantic NavLink anchor elements with href', () => {
        renderWithRouter(<Sidebar isOpen={false} />, {
            route: ROUTES.DASHBOARD,
            authContext: {
                isAdmin: false,
                isAdvisor: false,
                user: { role: 'client' },
            },
        });

        const links = [
            { text: 'Executive Dashboard', href: ROUTES.DASHBOARD, code: 'DSH' },
            { text: 'Analiza P&L i Wskaźniki', href: ROUTES.ANALYTICS, code: 'ANL' },
            { text: 'Ewidencja Operacji', href: ROUTES.RECORDS, code: 'REC' },
            { text: 'Planowanie Inwestycji', href: ROUTES.INVESTMENTS, code: 'PRJ' },
            { text: 'Import Danych Finansowych', href: ROUTES.IMPORT, code: 'IMP' },
            { text: 'Virtual Data Room (VDR)', href: ROUTES.DATA_ROOM, code: 'VDR' },
            { text: 'Raporty Zarządcze & PDF', href: ROUTES.REPORTS, code: 'REP' },
            { text: 'Dziennik Nadzoru & Audyt', href: ROUTES.AUDIT_LOGS, code: 'AUD' },
        ];

        for (const item of links) {
            const anchor = screen.getByRole('link', {
                name: (name) => name.includes(item.text),
            });
            expect(anchor).toBeInTheDocument();
            expect(anchor).toHaveAttribute('href', item.href);
            expect(screen.getByText(item.code)).toBeInTheDocument();
        }

        // Standard client should NOT see advisors link
        expect(screen.queryByText('Doradcy & Przypisania')).not.toBeInTheDocument();
        expect(screen.queryByText('Zaproszenia Klientów')).not.toBeInTheDocument();
    });

    it('applies active styling to the NavLink matching the current location', () => {
        renderWithRouter(<Sidebar isOpen={false} />, {
            route: ROUTES.ANALYTICS,
        });

        const activeLink = screen.getByRole('link', { name: /Analiza P&L i Wskaźniki/i });
        const inactiveLink = screen.getByRole('link', { name: /Ewidencja Operacji/i });

        // Active link should have institutional left border and highlight
        expect(activeLink.className).toContain('border-l-2');
        expect(activeLink.className).toContain('border-zinc-100');
        expect(activeLink.className).toContain('bg-zinc-850');

        // Inactive link should have zinc-400 text
        expect(inactiveLink.className).not.toContain('border-l-2');
        expect(inactiveLink.className).toContain('text-zinc-400');
    });

    it('renders advisors management link for admin role', () => {
        renderWithRouter(<Sidebar isOpen={false} />, {
            route: ROUTES.DASHBOARD,
            authContext: {
                isAdmin: true,
                isAdvisor: false,
                user: { role: 'admin' },
            },
        });

        const advisorLink = screen.getByRole('link', { name: /Doradcy & Przypisania/i });
        expect(advisorLink).toBeInTheDocument();
        expect(advisorLink).toHaveAttribute('href', ROUTES.ADVISORS);
        expect(screen.getByText('ADV')).toBeInTheDocument();
    });

    it('renders client invitations link for advisor role', () => {
        renderWithRouter(<Sidebar isOpen={false} />, {
            route: ROUTES.DASHBOARD,
            authContext: {
                isAdmin: false,
                isAdvisor: true,
                user: { role: 'advisor' },
            },
        });

        const inviteLink = screen.getByRole('link', { name: /Zaproszenia Klientów/i });
        expect(inviteLink).toBeInTheDocument();
        expect(inviteLink).toHaveAttribute('href', ROUTES.ADVISORS);
        expect(screen.getByText('INV')).toBeInTheDocument();
    });

    it('calls onClose callback when a navigation item is clicked', () => {
        const handleClose = vi.fn();
        renderWithRouter(<Sidebar isOpen={true} onClose={handleClose} />, {
            route: ROUTES.DASHBOARD,
        });

        const targetLink = screen.getByRole('link', { name: /Analiza P&L i Wskaźniki/i });
        fireEvent.click(targetLink);

        expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('triggers logout and navigates to login when logout button is clicked', async () => {
        const mockLogout = vi.fn().mockResolvedValue(true);
        const { unmount } = renderWithRouter(<Sidebar isOpen={false} />, {
            route: ROUTES.DASHBOARD,
            authContext: {
                logout: mockLogout,
            },
        });

        const logoutBtn = screen.getByRole('button', { name: 'Zakończ sesję' });
        expect(logoutBtn).toBeInTheDocument();

        fireEvent.click(logoutBtn);

        await waitFor(() => {
            expect(mockLogout).toHaveBeenCalledTimes(1);
        });

        unmount();
    });

    it('renders fallback buttons gracefully when rendered outside of a router context', () => {
        // Plain render without MemoryRouter
        render(
            <NotificationProvider>
                <AuthContext.Provider
                    value={{
                        user: { name: 'Test User', role: 'admin' },
                        activeCompany: { code: 'TST', name: 'Test Company' },
                        isAdmin: true,
                        isSuperAdmin: false,
                        isAdvisor: false,
                        logout: vi.fn(),
                    }}
                >
                    <Sidebar currentRoute="analytics" onRouteChange={vi.fn()} isOpen={false} />
                </AuthContext.Provider>
            </NotificationProvider>
        );

        // Outside router, buttons are rendered instead of links
        expect(screen.queryByRole('link', { name: /Analiza P&L i Wskaźniki/i })).not.toBeInTheDocument();
        const button = screen.getByRole('button', { name: /Analiza P&L i Wskaźniki/i });
        expect(button).toBeInTheDocument();
        expect(button.className).toContain('border-l-2');
    });
});
