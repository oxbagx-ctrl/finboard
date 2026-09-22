import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { CapexScheduleManager } from '../../components/investments/CapexScheduleManager';
import { InvestmentProjectProvider } from '../../context/InvestmentProjectContext';
import { NotificationProvider } from '../../context/NotificationContext';
import { AuthContext } from '../../context/AuthContext';
import apiClient from '../../api/client';

// Mock apiClient
vi.mock('../../api/client', () => ({
    default: {
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
    },
}));

const mockCompany = {
    id: 'comp-acme-1',
    name: 'Acme Manufacturing S.A.',
    code: 'ACME',
};

const mockUser = {
    id: 'user-cfo-1',
    name: 'Jan Kowalski (CFO)',
    role: 'client',
};

const mockProjectWithStages = {
    id: 'proj-acme-1',
    name: 'Budowa Nowego Zakładu Produkcyjnego',
    currency: 'PLN',
    start_date: '2026-04-01',
    planning_horizon_years: 15,
    capex_stages: [
        {
            id: 'stage-1',
            stage_name: 'Prace ziemne i fundamenty',
            net_amount: '4000000.00',
            currency: 'PLN',
            start_date: '2026-04-01',
            duration_months: 6,
            completion_date: '2026-10-01',
            kst_code: 'KST_2',
            kst_annual_rate: 4.5,
            eligible_for_grant: true,
            grant_eligible_amount: '4000000.00',
            stage_order: 1,
        },
        {
            id: 'stage-2',
            stage_name: 'Zakup i montaż maszyn CNC',
            net_amount: '6000000.00',
            currency: 'PLN',
            start_date: '2026-10-01',
            duration_months: 12,
            completion_date: '2027-10-01',
            kst_code: 'KST_4',
            kst_annual_rate: 10.0,
            eligible_for_grant: false,
            grant_eligible_amount: null,
            stage_order: 2,
        },
    ],
};

const renderWithProviders = (ui, projectData = mockProjectWithStages) => {
    apiClient.get.mockImplementation((url) => {
        if (url === '/investment-projects') {
            return Promise.resolve({
                data: { status: 'success', data: projectData ? [projectData] : [] },
            });
        }
        if (url.startsWith('/investment-projects/')) {
            return Promise.resolve({
                data: { status: 'success', data: projectData },
            });
        }
        return Promise.resolve({ data: { status: 'success', data: {} } });
    });

    const authValue = {
        user: mockUser,
        activeCompany: mockCompany,
        isAuthenticated: true,
        loading: false,
        isAdmin: false,
        isAdvisor: false,
        logout: vi.fn(),
    };

    return render(
        <NotificationProvider>
            <AuthContext.Provider value={authValue}>
                <InvestmentProjectProvider>
                    {ui}
                </InvestmentProjectProvider>
            </AuthContext.Provider>
        </NotificationProvider>
    );
};

describe('CapexScheduleManager Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders empty state when project has no capex stages', async () => {
        const emptyProject = {
            id: 'proj-empty-1',
            name: 'Projekt bez etapów',
            currency: 'PLN',
            start_date: '2026-01-01',
            capex_stages: [],
        };

        renderWithProviders(<CapexScheduleManager />, emptyProject);

        await waitFor(() => {
            expect(screen.getByText('Brak zdefiniowanych etapów CAPEX w tym projekcie')).toBeInTheDocument();
        });

        expect(screen.getByRole('button', { name: /Dodaj Pierwszy Etap CAPEX/i })).toBeInTheDocument();
        expect(screen.getByText('BRAK ETAPÓW')).toBeInTheDocument();
    });

    it('renders table of stages with proper names, amounts, dates, and KŚT rates', async () => {
        renderWithProviders(<CapexScheduleManager />);

        await waitFor(() => {
            expect(screen.getAllByText('Prace ziemne i fundamenty')[0]).toBeInTheDocument();
        });

        expect(screen.getAllByText('Zakup i montaż maszyn CNC')[0]).toBeInTheDocument();
        expect(screen.getByText('KST_2')).toBeInTheDocument();
        expect(screen.getByText('KST_4')).toBeInTheDocument();
        expect(screen.getByText('4.5%')).toBeInTheDocument();
        expect(screen.getByText('10%')).toBeInTheDocument();
    });

    it('correctly calculates total net CAPEX, grant eligible amount, and weighted KŚT rate', async () => {
        renderWithProviders(<CapexScheduleManager />);

        await waitFor(() => {
            expect(screen.getAllByText('Prace ziemne i fundamenty')[0]).toBeInTheDocument();
        });

        // Total Net CAPEX = 4M + 6M = 10,000,000 PLN
        expect(screen.getByText(/10.*000.*000,00 PLN/)).toBeInTheDocument();

        // Grant eligible = 4M PLN
        expect(screen.getAllByText(/4.*000.*000,00 PLN/)[0]).toBeInTheDocument();
        expect(screen.getByText('40.0% bazy dotacyjnej')).toBeInTheDocument();

        // Weighted KŚT rate: (4M * 4.5% + 6M * 10%) / 10M = (18 + 60) / 10 = 7.80%
        expect(screen.getByText('7.80% / ROK')).toBeInTheDocument();
    });

    it('validates required fields before adding a new stage', async () => {
        renderWithProviders(<CapexScheduleManager />);

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /Dodaj Etap CAPEX/i })).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', { name: /Dodaj Etap CAPEX/i }));

        expect(screen.getByText('Nowy Etap Nakładów CAPEX')).toBeInTheDocument();

        // Try submitting empty form
        fireEvent.click(screen.getByRole('button', { name: /Dodaj Etap$/i }));

        expect(screen.getByText('Nazwa etapu jest wymagana.')).toBeInTheDocument();
        expect(screen.getByText('Kwota nakładów netto musi być większa od zera.')).toBeInTheDocument();
        expect(apiClient.post).not.toHaveBeenCalled();
    });

    it('successfully adds a new capex stage via API', async () => {
        apiClient.post.mockResolvedValueOnce({
            data: { status: 'success', data: { id: 'stage-3' } },
        });

        renderWithProviders(<CapexScheduleManager />);

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /Dodaj Etap CAPEX/i })).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', { name: /Dodaj Etap CAPEX/i }));

        const nameInput = screen.getByLabelText(/Nazwa Etapu CAPEX/i);
        const amountInput = screen.getByLabelText(/Kwota Netto/i);

        fireEvent.change(nameInput, { target: { value: 'Infrastruktura IT i serwerownia' } });
        fireEvent.change(amountInput, { target: { value: '500000' } });

        fireEvent.click(screen.getByRole('button', { name: /Dodaj Etap$/i }));

        await waitFor(() => {
            expect(apiClient.post).toHaveBeenCalledWith(
                '/investment-projects/proj-acme-1/capex-stages',
                expect.objectContaining({
                    stage_name: 'Infrastruktura IT i serwerownia',
                    net_amount: '500000',
                })
            );
        });
    });

    it('opens CapexStageModal for editing an existing stage and submits PUT request', async () => {
        apiClient.put.mockResolvedValueOnce({
            data: { status: 'success', data: { id: 'stage-1' } },
        });

        renderWithProviders(<CapexScheduleManager />);

        await waitFor(() => {
            expect(screen.getAllByText('Prace ziemne i fundamenty')[0]).toBeInTheDocument();
        });

        // Click edit on the first stage
        const editButtons = screen.getAllByTitle('Edytuj etap');
        fireEvent.click(editButtons[0]);

        expect(screen.getByText('Edycja Etapu CAPEX')).toBeInTheDocument();

        const amountInput = screen.getByLabelText(/Kwota Netto/i);
        fireEvent.change(amountInput, { target: { value: '4500000' } });

        fireEvent.click(screen.getByRole('button', { name: /Zapisz Zmiany/i }));

        await waitFor(() => {
            expect(apiClient.put).toHaveBeenCalledWith(
                '/investment-projects/proj-acme-1/capex-stages/stage-1',
                expect.objectContaining({
                    stage_name: 'Prace ziemne i fundamenty',
                    net_amount: '4500000',
                })
            );
        });
    });

    it('opens delete confirmation modal and deletes stage via API', async () => {
        apiClient.delete.mockResolvedValueOnce({
            data: { status: 'success' },
        });

        renderWithProviders(<CapexScheduleManager />);

        await waitFor(() => {
            expect(screen.getAllByText('Prace ziemne i fundamenty')[0]).toBeInTheDocument();
        });

        // Click delete on first stage
        const deleteButtons = screen.getAllByTitle('Usuń etap');
        fireEvent.click(deleteButtons[0]);

        expect(screen.getByText('Usunięcie Etapu CAPEX')).toBeInTheDocument();
        expect(screen.getByText(/Czy na pewno chcesz usunąć etap/i)).toBeInTheDocument();

        // Confirm delete
        const confirmDeleteBtn = screen.getByTestId('confirm-delete-stage-btn');
        fireEvent.click(confirmDeleteBtn);

        await waitFor(() => {
            expect(apiClient.delete).toHaveBeenCalledWith(
                '/investment-projects/proj-acme-1/capex-stages/stage-1'
            );
        });
    });

    it('renders visual stage breakdown bar and legend', async () => {
        renderWithProviders(<CapexScheduleManager />);

        await waitFor(() => {
            expect(screen.getByText('Struktura Nakładów CAPEX wg Etapów')).toBeInTheDocument();
        });

        expect(screen.getByText('(40.0%)')).toBeInTheDocument();
        expect(screen.getByText('(60.0%)')).toBeInTheDocument();
    });
});
