import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AdvisorsManagementView } from '../../views/AdvisorsManagementView';
import { AdvisorAssignmentModal } from '../../components/advisors/AdvisorAssignmentModal';
import { CreateCompanyModal } from '../../components/advisors/CreateCompanyModal';
import { InviteUserModal } from '../../components/advisors/InviteUserModal';
import { SmtpStatusWidget } from '../../components/advisors/SmtpStatusWidget';
import { TestMailModal } from '../../components/advisors/TestMailModal';
import { AuthContext } from '../../context/AuthContext';
import { NotificationProvider } from '../../context/NotificationContext';
import apiClient from '../../api/client';

// Mock apiClient
vi.mock('../../api/client', () => ({
    default: {
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        patch: vi.fn(),
        delete: vi.fn(),
    },
}));

const mockSuperAdmin = {
    id: 'usr-admin-1',
    name: 'Super Partner Helvest',
    email: 'admin@helvest.com',
    role: 'super_admin',
};

const mockCompanies = [
    {
        id: 'comp-1',
        name: 'Acme Poland Sp. z o.o.',
        code: 'ACME',
        tax_id: '5252525252',
        assigned_advisors_count: 1,
        clients_count: 3,
        assigned_advisors: [
            { id: 'adv-1', name: 'Jan Kowalski', email: 'jan@helvest.com', is_active: true }
        ],
    },
    {
        id: 'comp-2',
        name: 'Beta Biotech S.A.',
        code: 'BETA',
        tax_id: '7778889900',
        assigned_advisors_count: 0,
        clients_count: 1,
        assigned_advisors: [],
    }
];

const mockAdvisors = [
    {
        id: 'usr-admin-1',
        name: 'Super Partner Helvest',
        email: 'admin@helvest.com',
        role: 'super_admin',
        is_active: true,
        created_at: '2026-01-10T10:00:00Z',
        assigned_companies: [],
    },
    {
        id: 'adv-1',
        name: 'Jan Kowalski',
        email: 'jan@helvest.com',
        role: 'advisor',
        is_active: true,
        created_at: '2026-02-15T12:00:00Z',
        assigned_companies: [mockCompanies[0]],
    },
    {
        id: 'adv-2',
        name: 'Marek Nowak',
        email: 'marek@helvest.com',
        role: 'advisor',
        is_active: false,
        created_at: '2026-03-01T09:30:00Z',
        assigned_companies: [],
    }
];

const mockInvitations = [
    {
        id: 'inv-1',
        email: 'cfo@acme.com',
        role: 'client',
        status: 'pending',
        expires_at: '2026-03-30T10:00:00Z',
        company: mockCompanies[0],
        inviter: { name: 'Super Partner Helvest', email: 'admin@helvest.com' },
        activation_url: 'https://finboard.app/activate?token=tok-12345',
        created_at: '2026-03-28T10:00:00Z',
    },
    {
        id: 'inv-2',
        email: 'analityk@helvest.com',
        role: 'advisor',
        status: 'accepted',
        expires_at: '2026-03-25T10:00:00Z',
        assigned_companies_count: 2,
        inviter: { name: 'Super Partner Helvest', email: 'admin@helvest.com' },
        created_at: '2026-03-23T10:00:00Z',
    }
];

const mockSmtpStatus = {
    socket: {
        connected: true,
        latency_ms: 124,
        banner: '220 smtp2go.com ESMTP Exim',
    },
    is_port_25_warning: true,
    is_secure_port: true,
    port: 587,
    host: 'mail.smtp2go.com',
    auth_configured: true,
    from_address: 'system@finboard.app',
};

const renderWithProviders = (ui, authValue = {}) => {
    const defaultAuth = {
        user: mockSuperAdmin,
        isSuperAdmin: true,
        isAdvisor: false,
        isAdmin: true,
        availableCompanies: mockCompanies,
        activeCompany: mockCompanies[0],
        refreshUser: vi.fn(),
        ...authValue,
    };

    return render(
        <NotificationProvider>
            <AuthContext.Provider value={defaultAuth}>
                {ui}
            </AuthContext.Provider>
        </NotificationProvider>
    );
};

describe('AdvisorsManagement Tooltips & Accessibility Suite (Commit 280)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        apiClient.get.mockImplementation((url) => {
            if (url === '/admin/advisors') {
                return Promise.resolve({ data: { data: mockAdvisors } });
            }
            if (url === '/admin/companies') {
                return Promise.resolve({ data: { data: mockCompanies } });
            }
            if (url === '/invitations') {
                return Promise.resolve({ data: { data: mockInvitations } });
            }
            if (url === '/admin/mail/status') {
                return Promise.resolve({ data: { data: mockSmtpStatus } });
            }
            return Promise.resolve({ data: { data: [] } });
        });
    });

    it('renders header tooltips and InfoTooltip in AdvisorsManagementView', async () => {
        renderWithProviders(<AdvisorsManagementView />);

        // InfoTooltip in header
        const headerInfoBtn = screen.getByRole('button', {
            name: /Więcej informacji o zarządzaniu doradcami i przypisaniach wielonajemczych/i,
        });
        expect(headerInfoBtn).toBeInTheDocument();

        // Hover or focus to reveal tooltip
        fireEvent.mouseEnter(headerInfoBtn);
        await waitFor(() => {
            expect(screen.getByRole('tooltip')).toBeInTheDocument();
            expect(screen.getByText(/Moduł zarządzania strukturą Deal Advisory w modelu Multi-Tenant RBAC/i)).toBeInTheDocument();
        });

        // Icon has accessible role and tabIndex
        const shieldIcon = screen.getByRole('img', { name: /Doradcy i przypisania portfelowe/i });
        expect(shieldIcon).toHaveAttribute('tabIndex', '0');
    });

    it('renders KPI metric cards with InfoTooltip explanations', async () => {
        renderWithProviders(<AdvisorsManagementView />);

        await waitFor(() => {
            expect(screen.getByText('Doradcy & Partnerzy')).toBeInTheDocument();
        });

        const kpiAdvisorsInfo = screen.getByRole('button', { name: /Informacje o: Doradcy & Partnerzy/i });
        expect(kpiAdvisorsInfo).toBeInTheDocument();

        fireEvent.mouseEnter(kpiAdvisorsInfo);
        await waitFor(() => {
            expect(screen.getByRole('tooltip')).toBeInTheDocument();
            expect(screen.getByText(/Łączna liczba doradców M&A oraz super-administratorów/i)).toBeInTheDocument();
        });

        const kpiCompaniesInfo = screen.getByRole('button', { name: /Informacje o: Spółki w Portfelu/i });
        expect(kpiCompaniesInfo).toBeInTheDocument();
    });

    it('renders accessible tooltips on tab switcher buttons', async () => {
        renderWithProviders(<AdvisorsManagementView />);

        const advisorsTab = screen.getByRole('button', { name: 'Rejestr Doradców' });
        const companiesTab = screen.getByRole('button', { name: 'Matryca Spółek Portfelowych' });
        const invitationsTab = screen.getByRole('button', { name: 'Wysłane Zaproszenia' });

        expect(advisorsTab).toBeInTheDocument();
        expect(companiesTab).toBeInTheDocument();
        expect(invitationsTab).toBeInTheDocument();

        fireEvent.mouseEnter(companiesTab);
        await waitFor(() => {
            expect(screen.getByRole('tooltip')).toBeInTheDocument();
            expect(screen.getByText(/Matryca obsady analitycznej i pokrycia spółek przez doradców/i)).toBeInTheDocument();
        });
    });

    it('renders table headers with keyboard accessible tooltips in Tab 1 (Advisors)', async () => {
        renderWithProviders(<AdvisorsManagementView />);

        await waitFor(() => {
            expect(screen.getByText('Jan Kowalski')).toBeInTheDocument();
        });

        const doradcaHeader = screen.getByText('Doradca / Użytkownik');
        expect(doradcaHeader).toHaveAttribute('tabIndex', '0');
        expect(doradcaHeader).toHaveClass('cursor-help');

        fireEvent.focus(doradcaHeader);
        await waitFor(() => {
            expect(screen.getByRole('tooltip')).toBeInTheDocument();
            expect(screen.getByText(/Imię, nazwisko oraz adres e-mail doradcy/i)).toBeInTheDocument();
        });
    });

    it('renders accessible tooltips and info buttons in AdvisorAssignmentModal', async () => {
        renderWithProviders(
            <AdvisorAssignmentModal
                isOpen={true}
                onClose={vi.fn()}
                advisor={mockAdvisors[1]}
                companies={mockCompanies}
            />
        );

        expect(screen.getByText('Przypisanie Spółek Portfelowych')).toBeInTheDocument();

        // Briefcase icon has accessible img role
        const headerIcon = screen.getByRole('img', { name: /Zarządzanie zakresem dostępu doradcy do spółek portfelowych/i });
        expect(headerIcon).toBeInTheDocument();

        // Audit notice has tabIndex and cursor-help
        const auditNotice = screen.getByText(/AUDYT: Rejestracja zdarzeń Tenant \/ RBAC/i);
        expect(auditNotice).toHaveAttribute('tabIndex', '0');

        fireEvent.mouseEnter(auditNotice);
        await waitFor(() => {
            expect(screen.getByRole('tooltip')).toBeInTheDocument();
            expect(screen.getByText(/niezmiennym rejestrze audytowym WORM/i)).toBeInTheDocument();
        });
    });

    it('renders accessible tooltips in CreateCompanyModal', async () => {
        renderWithProviders(
            <CreateCompanyModal
                isOpen={true}
                onClose={vi.fn()}
                onSuccess={vi.fn()}
            />
        );

        expect(screen.getByText('Dodaj Nową Spółkę Portfelową')).toBeInTheDocument();

        // InfoTooltip on tenant isolation banner
        const isolationInfoBtn = screen.getByRole('button', { name: /Szczegóły o izolacji danych podmiotu portfelowego/i });
        expect(isolationInfoBtn).toBeInTheDocument();

        fireEvent.mouseEnter(isolationInfoBtn);
        await waitFor(() => {
            expect(screen.getByRole('tooltip')).toBeInTheDocument();
            expect(screen.getByText(/W modelu wielonajemczym FinBoard podmioty gospodarcze mają odseparowane rekordy/i)).toBeInTheDocument();
        });

        // Company code InfoTooltip
        const codeInfoBtn = screen.getByRole('button', { name: /Informacje o kodzie spółki/i });
        expect(codeInfoBtn).toBeInTheDocument();
    });

    it('renders accessible tooltips in SmtpStatusWidget', async () => {
        renderWithProviders(
            <SmtpStatusWidget
                compact={false}
                onOpenTestModal={vi.fn()}
            />
        );

        await waitFor(() => {
            expect(screen.getByText('POŁĄCZENIE AKTYWNE')).toBeInTheDocument();
        });

        // Port 25 InfoTooltip
        const port25InfoBtn = screen.getByRole('button', { name: /Szczegóły o blokadzie portu 25/i });
        expect(port25InfoBtn).toBeInTheDocument();

        fireEvent.mouseEnter(port25InfoBtn);
        await waitFor(() => {
            expect(screen.getByRole('tooltip')).toBeInTheDocument();
            expect(screen.getByText(/Blokada portu 25 dotyczy ruchu wychodzącego do zewnętrznych serwerów pocztowych/i)).toBeInTheDocument();
        });

        // Terminal banner InfoTooltip
        const bannerInfoBtn = screen.getByRole('button', { name: /Informacje o banerze SMTP/i });
        expect(bannerInfoBtn).toBeInTheDocument();
    });

    it('renders accessible tooltips in TestMailModal', async () => {
        renderWithProviders(
            <TestMailModal
                isOpen={true}
                onClose={vi.fn()}
            />
        );

        expect(screen.getByText('Diagnostyka Połączenia SMTP')).toBeInTheDocument();

        // InfoTooltip about SMTP handshake
        const testInfoBtn = screen.getByRole('button', { name: /Szczegóły o teście SMTP/i });
        expect(testInfoBtn).toBeInTheDocument();

        fireEvent.mouseEnter(testInfoBtn);
        await waitFor(() => {
            expect(screen.getByRole('tooltip')).toBeInTheDocument();
            expect(screen.getByText(/Wysyłka testowa pozwala potwierdzić/i)).toBeInTheDocument();
        });
    });
});
