import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AdvisorsManagementView } from '../../views/AdvisorsManagementView';
import { AdvisorAssignmentModal } from '../../components/advisors/AdvisorAssignmentModal';
import { NotificationProvider } from '../../context/NotificationContext';
import { AuthContext } from '../../context/AuthContext';
import apiClient from '../../api/client';

// Mock apiClient
vi.mock('../../api/client', () => ({
    default: {
        get: vi.fn(),
        put: vi.fn(),
        patch: vi.fn(),
    },
}));

const mockCurrentUser = {
    id: 'user-admin-1',
    name: 'Super Partner Helvest',
    email: 'admin@helvest.com',
    role: 'super_admin',
};

const mockAdvisors = [
    {
        id: 'user-admin-1',
        name: 'Super Partner Helvest',
        email: 'admin@helvest.com',
        role: 'super_admin',
        is_active: true,
        created_at: '2026-01-10T12:00:00Z',
        assigned_companies: [],
        assigned_companies_count: 0,
    },
    {
        id: 'user-adv-2',
        name: 'Krzysztof Kowalczyk',
        email: 'krzysztof.kowalczyk@helvest.com',
        role: 'advisor',
        is_active: true,
        created_at: '2026-02-15T09:30:00Z',
        assigned_companies: [
            { id: 'comp-acme-1', name: 'Acme Manufacturing S.A.', code: 'ACME', tax_id: '525-00-11-222' }
        ],
        assigned_companies_count: 1,
    },
    {
        id: 'user-adv-3',
        name: 'Marek Nowak',
        email: 'marek.nowak@helvest.com',
        role: 'advisor',
        is_active: false,
        created_at: '2026-03-01T14:15:00Z',
        assigned_companies: [],
        assigned_companies_count: 0,
    }
];

const mockCompanies = [
    {
        id: 'comp-acme-1',
        name: 'Acme Manufacturing S.A.',
        code: 'ACME',
        tax_id: '525-00-11-222',
        assigned_advisors_count: 1,
        clients_count: 3,
        assigned_advisors: [
            { id: 'user-adv-2', name: 'Krzysztof Kowalczyk', email: 'krzysztof.kowalczyk@helvest.com', is_active: true }
        ],
    },
    {
        id: 'comp-helvest-2',
        name: 'Helvest Advisory Sp. z o.o.',
        code: 'HELVEST',
        tax_id: '701-99-88-777',
        assigned_advisors_count: 0,
        clients_count: 1,
        assigned_advisors: [],
    },
];

const renderWithContext = (ui, user = mockCurrentUser) => {
    return render(
        <NotificationProvider>
            <AuthContext.Provider
                value={{
                    user,
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

describe('AdvisorAssignmentModal Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        apiClient.get.mockResolvedValue({ data: { data: mockCompanies } });
    });

    it('renders nothing when isOpen is false or advisor is null', () => {
        renderWithContext(
            <AdvisorAssignmentModal
                isOpen={false}
                onClose={vi.fn()}
                advisor={mockAdvisors[1]}
                onSaved={vi.fn()}
            />
        );

        expect(screen.queryByText('Przypisanie Spółek Portfelowych')).not.toBeInTheDocument();
    });

    it('renders modal with advisor details and company options', async () => {
        renderWithContext(
            <AdvisorAssignmentModal
                isOpen={true}
                onClose={vi.fn()}
                advisor={mockAdvisors[1]}
                onSaved={vi.fn()}
            />
        );

        expect(screen.getByText('Przypisanie Spółek Portfelowych')).toBeInTheDocument();
        expect(screen.getByText('Krzysztof Kowalczyk')).toBeInTheDocument();
        expect(screen.getByText(/krzysztof\.kowalczyk@helvest\.com/i)).toBeInTheDocument();

        await waitFor(() => {
            expect(apiClient.get).toHaveBeenCalledWith('/admin/companies');
            expect(screen.getByText('Acme Manufacturing S.A.')).toBeInTheDocument();
            expect(screen.getByText('Helvest Advisory Sp. z o.o.')).toBeInTheDocument();
        });
    });

    it('submits updated company assignments via PUT API', async () => {
        apiClient.put.mockResolvedValueOnce({
            data: {
                message: 'Zapisano',
                data: { ...mockAdvisors[1], assigned_companies: mockCompanies, assigned_companies_count: 2 },
            },
        });

        const handleSaved = vi.fn();
        const handleClose = vi.fn();

        renderWithContext(
            <AdvisorAssignmentModal
                isOpen={true}
                onClose={handleClose}
                advisor={mockAdvisors[1]}
                onSaved={handleSaved}
            />
        );

        await waitFor(() => {
            expect(screen.getByText('Helvest Advisory Sp. z o.o.')).toBeInTheDocument();
        });

        // Click select all
        fireEvent.click(screen.getByText('Zaznacz wszystkie'));

        // Save
        const saveBtn = screen.getByRole('button', { name: /Zapisz przypisania/i });
        fireEvent.click(saveBtn);

        await waitFor(() => {
            expect(apiClient.put).toHaveBeenCalledWith(
                `/admin/advisors/${mockAdvisors[1].id}/companies`,
                { company_ids: ['comp-acme-1', 'comp-helvest-2'] }
            );
        });

        expect(handleSaved).toHaveBeenCalledTimes(1);
        expect(handleClose).toHaveBeenCalledTimes(1);
    });
});

describe('AdvisorsManagementView (SuperAdmin Dashboard)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        apiClient.get.mockImplementation((url) => {
            if (url === '/admin/advisors') {
                return Promise.resolve({ data: { data: mockAdvisors } });
            }
            if (url === '/admin/companies') {
                return Promise.resolve({ data: { data: mockCompanies } });
            }
            return Promise.resolve({ data: { data: [] } });
        });
    });

    it('loads and renders KPI metric cards and advisors table', async () => {
        renderWithContext(<AdvisorsManagementView />);

        await waitFor(() => {
            expect(apiClient.get).toHaveBeenCalledWith('/admin/advisors', expect.any(Object));
            expect(apiClient.get).toHaveBeenCalledWith('/admin/companies');
        });

        // Top titles and badges
        expect(screen.getByText('Zarządzanie Doradcami & Uprawnieniami Portfela')).toBeInTheDocument();
        expect(screen.getByText('SUPER ADMIN ACCESS')).toBeInTheDocument();

        // Check advisors rendered
        expect(screen.getByText('Super Partner Helvest')).toBeInTheDocument();
        expect(screen.getByText('Krzysztof Kowalczyk')).toBeInTheDocument();
        expect(screen.getByText('Marek Nowak')).toBeInTheDocument();

        // Roles and statuses
        expect(screen.getAllByText('DORADCA M&A').length).toBeGreaterThan(0);
        expect(screen.getByText('NIEAKTYWNY')).toBeInTheDocument();
    });

    it('switches between Advisors list and Companies matrix tabs', async () => {
        renderWithContext(<AdvisorsManagementView />);

        await waitFor(() => {
            expect(screen.getByText('Krzysztof Kowalczyk')).toBeInTheDocument();
        });

        // Switch to companies matrix tab
        const companiesTabBtn = screen.getByText(/Matryca Spółek Portfelowych/i);
        fireEvent.click(companiesTabBtn);

        expect(screen.getByText('Matryca Pokrycia Spółek Przez Doradców')).toBeInTheDocument();
        expect(screen.getByText('Brak dedykowanego doradcy')).toBeInTheDocument();
    });

    it('toggles advisor active status', async () => {
        apiClient.patch.mockResolvedValueOnce({
            data: {
                message: 'Konto doradcy zostało pomyślnie aktywowane.',
                data: { ...mockAdvisors[2], is_active: true },
            },
        });

        renderWithContext(<AdvisorsManagementView />);

        await waitFor(() => {
            expect(screen.getByText('Marek Nowak')).toBeInTheDocument();
        });

        // Click Aktywuj button for Marek Nowak
        const activateBtn = screen.getByRole('button', { name: 'Aktywuj' });
        fireEvent.click(activateBtn);

        await waitFor(() => {
            expect(apiClient.patch).toHaveBeenCalledWith(
                `/admin/advisors/${mockAdvisors[2].id}/toggle-status`
            );
        });
    });

    it('prevents current admin from deactivating own account', async () => {
        renderWithContext(<AdvisorsManagementView />);

        await waitFor(() => {
            expect(screen.getByText('Super Partner Helvest')).toBeInTheDocument();
        });

        // Current user row has disabled deactivate button
        const deactivateBtns = screen.getAllByRole('button', { name: /Dezaktywuj/i });
        // The first advisor is Super Partner Helvest (currentUser), button should be disabled
        expect(deactivateBtns[0]).toBeDisabled();
    });

    it('opens company assignment modal when clicking Spółki button', async () => {
        renderWithContext(<AdvisorsManagementView />);

        await waitFor(() => {
            expect(screen.getByText('Krzysztof Kowalczyk')).toBeInTheDocument();
        });

        const assignBtns = screen.getAllByRole('button', { name: /Spółki/i });
        fireEvent.click(assignBtns[1]); // for Krzysztof Kowalczyk

        await waitFor(() => {
            expect(screen.getByText('Przypisanie Spółek Portfelowych')).toBeInTheDocument();
        });
    });
});
