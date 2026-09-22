import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { InvestmentPlanningView } from '../../views/InvestmentPlanningView';
import { InvestmentProjectProvider } from '../../context/InvestmentProjectContext';
import { NotificationProvider } from '../../context/NotificationContext';
import { AuthContext } from '../../context/AuthContext';
import { Sidebar } from '../../components/layout/Sidebar';
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
    tax_id: '525-00-11-222',
};

const mockUser = {
    id: 'user-cfo-1',
    name: 'Jan Kowalski (CFO)',
    email: 'cfo@acme.com',
    role: 'client',
};

const mockProjects = [
    {
        id: 'proj-logistics-1',
        name: 'Budowa Centrum Dystrybucyjnego Logistics Hub',
        description: 'Nowoczesny magazyn wysokiego składowania klasy A',
        status: 'draft',
        start_date: '2026-03-01',
        commercial_operation_date: '2027-06-01',
        planning_horizon_years: 15,
        currency: 'PLN',
        budget: {
            total_net_capex: '10000000.00',
            currency: 'PLN',
        },
        financing_structure: {
            equity_amount: '3000000.00',
            senior_debt_amount: '5000000.00',
            grant_amount: '2000000.00',
            currency: 'PLN',
        },
        capex_stages: [
            { id: 'stage-1', stage_name: 'Prace ziemne', net_amount: '4000000.00' },
            { id: 'stage-2', stage_name: 'Hala i instalacje', net_amount: '6000000.00' },
        ],
    },
    {
        id: 'proj-solar-2',
        name: 'Instalacja Fotowoltaiczna 2MW',
        description: 'Farma PV na dachach zakładu produkcyjnego',
        status: 'approved',
        start_date: '2026-05-01',
        commercial_operation_date: '2026-11-01',
        planning_horizon_years: 10,
        currency: 'PLN',
        budget: {
            total_net_capex: '4000000.00',
            currency: 'PLN',
        },
        financing_structure: {
            equity_amount: '1000000.00',
            senior_debt_amount: '2000000.00',
            grant_amount: '1000000.00',
            currency: 'PLN',
        },
        capex_stages: [
            { id: 'stage-3', stage_name: 'Panele i inwertery', net_amount: '4000000.00' },
        ],
    },
];

const renderWithProviders = (ui, authOverrides = {}) => {
    const authValue = {
        user: mockUser,
        activeCompany: mockCompany,
        isAuthenticated: true,
        loading: false,
        isAdmin: false,
        isSuperAdmin: false,
        isAdvisor: false,
        logout: vi.fn(),
        ...authOverrides,
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

describe('InvestmentPlanningView Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders empty state when company has no investment projects', async () => {
        apiClient.get.mockResolvedValueOnce({
            data: { status: 'success', data: [] },
        });

        renderWithProviders(<InvestmentPlanningView />);

        await waitFor(() => {
            expect(screen.getByText('Brak zdefiniowanych projektów inwestycyjnych')).toBeInTheDocument();
        });

        expect(screen.getByText(/Dla podmiotu/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Zainicjalizuj Pierwszy Projekt/i })).toBeInTheDocument();
    });

    it('renders project list, selector, and KPI metric cards when projects exist', async () => {
        apiClient.get.mockResolvedValueOnce({
            data: { status: 'success', data: mockProjects },
        });

        renderWithProviders(<InvestmentPlanningView />);

        await waitFor(() => {
            expect(screen.getByText('Budowa Centrum Dystrybucyjnego Logistics Hub')).toBeInTheDocument();
        });

        // Check KPI cards
        expect(screen.getByText('SUMARYCZNY CAPEX')).toBeInTheDocument();
        expect(screen.getByText('WKŁAD WŁASNY (EQUITY)')).toBeInTheDocument();
        expect(screen.getByText('KREDYT BANKOWY')).toBeInTheDocument();
        expect(screen.getByText('DOTACJE & SUBSYDIA')).toBeInTheDocument();
        expect(screen.getByText('HORYZONT MODELU')).toBeInTheDocument();
        expect(screen.getByText('15 LAT')).toBeInTheDocument();

        // Check status badge
        expect(screen.getByText('SZKIC (DRAFT)')).toBeInTheDocument();
    });

    it('switches active project when selected from the dropdown', async () => {
        apiClient.get.mockResolvedValueOnce({
            data: { status: 'success', data: mockProjects },
        });

        renderWithProviders(<InvestmentPlanningView />);

        await waitFor(() => {
            expect(screen.getByText('Budowa Centrum Dystrybucyjnego Logistics Hub')).toBeInTheDocument();
        });

        const select = screen.getByRole('combobox');
        fireEvent.change(select, { target: { value: 'proj-solar-2' } });

        await waitFor(() => {
            expect(screen.getByText('10 LAT')).toBeInTheDocument();
            expect(screen.getByText('ZATWIERDZONY')).toBeInTheDocument();
        });
    });

    it('switches sub-tabs between Assumptions, Sensitivity, Statements, and Dossier', async () => {
        apiClient.get.mockResolvedValueOnce({
            data: { status: 'success', data: mockProjects },
        });

        renderWithProviders(<InvestmentPlanningView />);

        await waitFor(() => {
            expect(screen.getByText('1. Założenia & CAPEX')).toBeInTheDocument();
        });

        // Default tab is assumptions
        expect(screen.getByText('Konfigurator Założeń Projektu Finance (Faza 42)')).toBeInTheDocument();

        // Switch to Sensitivity tab
        fireEvent.click(screen.getByText('2. Symulator What-If'));
        expect(screen.getByText('Cockpit Analizy Wrażliwości & Symulator What-If')).toBeInTheDocument();

        // Switch to Statements tab
        fireEvent.click(screen.getByText('3. Model 15-letni & Wycena'));
        expect(screen.getByText('Prezentacja 15-letnich Sprawozdań & Wycena DCF (Faza 44)')).toBeInTheDocument();

        // Switch to Dossier tab
        fireEvent.click(screen.getByText('4. Scoring & Dossier PDF'));
        expect(screen.getByText('Scoring Gotowości Inwestycyjnej & Dossier PDF (Faza 45)')).toBeInTheDocument();
    });

    it('opens and closes the CreateProjectModal', async () => {
        apiClient.get.mockResolvedValueOnce({
            data: { status: 'success', data: mockProjects },
        });

        renderWithProviders(<InvestmentPlanningView />);

        await waitFor(() => {
            expect(screen.getByText('Budowa Centrum Dystrybucyjnego Logistics Hub')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', { name: /Nowy Projekt/i }));

        expect(screen.getByText('Nowy Projekt Inwestycyjny')).toBeInTheDocument();
        expect(screen.getByLabelText(/Nazwa Projektu/i)).toBeInTheDocument();

        // Cancel closes modal
        fireEvent.click(screen.getByRole('button', { name: /Anuluj/i }));
        expect(screen.queryByText('Nowy Projekt Inwestycyjny')).not.toBeInTheDocument();
    });

    it('validates required fields before submitting create project form', async () => {
        apiClient.get.mockResolvedValueOnce({
            data: { status: 'success', data: [] },
        });

        renderWithProviders(<InvestmentPlanningView />);

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /Zainicjalizuj Pierwszy Projekt/i })).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', { name: /Zainicjalizuj Pierwszy Projekt/i }));

        // Submit with empty name
        fireEvent.click(screen.getByRole('button', { name: /Utwórz Projekt/i }));

        expect(screen.getByText('Nazwa projektu jest wymagana.')).toBeInTheDocument();
        expect(apiClient.post).not.toHaveBeenCalled();
    });

    it('successfully creates a project and refreshes project list', async () => {
        apiClient.get
            .mockResolvedValueOnce({ data: { status: 'success', data: [] } })
            .mockResolvedValueOnce({
                data: {
                    status: 'success',
                    data: [
                        {
                            id: 'proj-new-1',
                            name: 'Rozbudowa Linii Produkcyjnej CNC',
                            planning_horizon_years: 12,
                            currency: 'PLN',
                            status: 'draft',
                        },
                    ],
                },
            });

        apiClient.post.mockResolvedValueOnce({
            data: {
                status: 'success',
                data: {
                    id: 'proj-new-1',
                    name: 'Rozbudowa Linii Produkcyjnej CNC',
                },
            },
        });

        renderWithProviders(<InvestmentPlanningView />);

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /Zainicjalizuj Pierwszy Projekt/i })).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', { name: /Zainicjalizuj Pierwszy Projekt/i }));

        const nameInput = screen.getByLabelText(/Nazwa Projektu/i);
        fireEvent.change(nameInput, { target: { value: 'Rozbudowa Linii Produkcyjnej CNC' } });

        fireEvent.click(screen.getByRole('button', { name: /Utwórz Projekt/i }));

        await waitFor(() => {
            expect(apiClient.post).toHaveBeenCalledWith(
                '/investment-projects',
                expect.objectContaining({
                    name: 'Rozbudowa Linii Produkcyjnej CNC',
                    currency: 'PLN',
                })
            );
        });
    });

    it('renders Sidebar navigation item with code PRJ and icon', () => {
        const handleRouteChange = vi.fn();
        const authValue = {
            user: mockUser,
            activeCompany: mockCompany,
            isAuthenticated: true,
            isAdmin: false,
            isAdvisor: false,
            logout: vi.fn(),
        };

        render(
            <NotificationProvider>
                <AuthContext.Provider value={authValue}>
                    <Sidebar
                        currentRoute="dashboard"
                        onRouteChange={handleRouteChange}
                        isOpen={true}
                        onClose={vi.fn()}
                    />
                </AuthContext.Provider>
            </NotificationProvider>
        );

        const navBtn = screen.getByRole('button', { name: /Planowanie Inwestycji/i });
        expect(navBtn).toBeInTheDocument();
        expect(within(navBtn).getByText('PRJ')).toBeInTheDocument();

        fireEvent.click(navBtn);
        expect(handleRouteChange).toHaveBeenCalledWith('investments');
    });
});
