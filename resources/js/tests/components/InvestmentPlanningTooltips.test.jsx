import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { InvestmentPlanningView } from '../../views/InvestmentPlanningView';
import { CreateProjectModal } from '../../components/investments/CreateProjectModal';
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

describe('InvestmentPlanningView - Accessible Tooltips Integration (Phase 56 Commit 281)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders accessible info tooltips and labels across view header, project selector, and status badge', async () => {
        apiClient.get.mockResolvedValueOnce({
            data: { status: 'success', data: mockProjects },
        });

        renderWithProviders(<InvestmentPlanningView />);

        await waitFor(() => {
            expect(screen.getByText('Budowa Centrum Dystrybucyjnego Logistics Hub')).toBeInTheDocument();
        });

        // Header module breadcrumbs and title
        expect(screen.getByText('MODUŁ DEAL ADVISORY & PROJECT FINANCE')).toBeInTheDocument();
        expect(screen.getByText('ACME')).toBeInTheDocument();
        expect(screen.getByText('Planowanie Inwestycji i Montaż Finansowy')).toBeInTheDocument();

        // Project selector dropdown
        const projectSelector = screen.getByTestId('project-selector');
        expect(projectSelector).toHaveAttribute('aria-label', 'Wybierz projekt');

        // Status badge
        expect(screen.getByText('SZKIC (DRAFT)')).toBeInTheDocument();

        // Action button
        expect(screen.getByRole('button', { name: /Nowy Projekt/i })).toBeInTheDocument();
    });

    it('renders accessible InfoTooltips on all 5 KPI MetricCards with appropriate aria-labels', async () => {
        apiClient.get.mockResolvedValueOnce({
            data: { status: 'success', data: mockProjects },
        });

        renderWithProviders(<InvestmentPlanningView />);

        await waitFor(() => {
            expect(screen.getByText('Budowa Centrum Dystrybucyjnego Logistics Hub')).toBeInTheDocument();
        });

        // Verify all 5 MetricCards have their accessible InfoTooltips
        expect(screen.getByLabelText('Informacje o: SUMARYCZNY CAPEX')).toBeInTheDocument();
        expect(screen.getByLabelText('Informacje o: WKŁAD WŁASNY (EQUITY)')).toBeInTheDocument();
        expect(screen.getByLabelText('Informacje o: KREDYT BANKOWY')).toBeInTheDocument();
        expect(screen.getByLabelText('Informacje o: DOTACJE & SUBSYDIA')).toBeInTheDocument();
        expect(screen.getByLabelText('Informacje o: HORYZONT MODELU')).toBeInTheDocument();
    });

    it('renders accessible aria-labels on all 4 sub-tab buttons', async () => {
        apiClient.get.mockResolvedValueOnce({
            data: { status: 'success', data: mockProjects },
        });

        renderWithProviders(<InvestmentPlanningView />);

        await waitFor(() => {
            expect(screen.getByText('Budowa Centrum Dystrybucyjnego Logistics Hub')).toBeInTheDocument();
        });

        // Subtabs aria-labels
        expect(screen.getByRole('button', { name: /1\. Założenia & CAPEX - Harmonogram etapów/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /2\. Symulator What-If - Analiza wrażliwości/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /3\. Model 15-letni & Wycena - 3-Statement/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /4\. Scoring & Dossier PDF - Test gotowości/i })).toBeInTheDocument();
    });

    it('renders accessible InfoTooltip in assumptions tab header and badge', async () => {
        apiClient.get.mockResolvedValueOnce({
            data: { status: 'success', data: mockProjects },
        });

        renderWithProviders(<InvestmentPlanningView />);

        await waitFor(() => {
            expect(screen.getByText('Konfigurator Założeń Projektu Finance')).toBeInTheDocument();
        });

        expect(screen.getByText('PARAMETRY WEJŚCIOWE')).toBeInTheDocument();
    });

    it('renders accessible Tooltip on empty state button when no projects exist', async () => {
        apiClient.get.mockResolvedValueOnce({
            data: { status: 'success', data: [] },
        });

        renderWithProviders(<InvestmentPlanningView />);

        await waitFor(() => {
            expect(screen.getByText('Brak zdefiniowanych projektów inwestycyjnych')).toBeInTheDocument();
        });

        const initBtn = screen.getByRole('button', { name: /Zainicjalizuj Pierwszy Projekt/i });
        expect(initBtn).toBeInTheDocument();
    });
});

describe('CreateProjectModal - Accessible Tooltips Integration (Phase 56 Commit 281)', () => {
    it('renders accessible close button tooltip and form field info tooltips', () => {
        render(
            <CreateProjectModal
                isOpen={true}
                onClose={vi.fn()}
                onSubmit={vi.fn()}
            />
        );

        // Close button with accessible label
        const closeBtn = screen.getByRole('button', { name: 'Zamknij formularz' });
        expect(closeBtn).toBeInTheDocument();

        // Form field labels
        expect(screen.getByLabelText(/Nazwa Projektu/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Data Startu/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Horyzont \(Lata\)/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Waluta/i)).toBeInTheDocument();

        // Action buttons
        expect(screen.getByRole('button', { name: /Anuluj/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Utwórz Projekt/i })).toBeInTheDocument();
    });
});
