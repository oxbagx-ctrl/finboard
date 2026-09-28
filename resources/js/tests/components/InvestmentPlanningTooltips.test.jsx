import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { InvestmentPlanningView } from '../../views/InvestmentPlanningView';
import { CreateProjectModal } from '../../components/investments/CreateProjectModal';
import { CapexScheduleManager } from '../../components/investments/CapexScheduleManager';
import { FinancingStructureConfigurator } from '../../components/investments/FinancingStructureConfigurator';
import { ReinvestmentManager } from '../../components/investments/ReinvestmentManager';
import { OperatingAssumptionsForm } from '../../components/investments/OperatingAssumptionsForm';
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

const mockProjectWithFullData = {
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
        senior_debt_interest_rate: 6.5,
        senior_debt_tenor_months: 120,
        senior_debt_grace_period_months: 12,
        senior_debt_repayment_profile: 'annuity',
    },
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
            grant_eligible_amount: '2500000.00',
            stage_order: 1,
        },
        {
            id: 'stage-2',
            stage_name: 'Hala i instalacje CNC',
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
    reinvestment_assumptions: {
        multiplier: 1.0,
        programs: {
            A: { name: 'Program A', enabled: true, unit_cost: 500000, frequency_years: 3, first_year: 3, kst_rate: 10.0 },
            B: { name: 'Program B', enabled: true, unit_cost: 1000000, frequency_years: 5, first_year: 5, kst_rate: 14.0 },
            C: { name: 'Program C', enabled: false, unit_cost: 2000000, frequency_years: 7, first_year: 7, kst_rate: 20.0 },
        },
    },
    operating_assumptions: {
        revenue_lines: [
            { id: 'rev-1', name: 'Usługi magazynowe', unit: 'paleta', volume: 5000, price: 100, total: 500000 },
        ],
        revenue_growth_rate_percent: 2.5,
        capacity_ramp_up: { 1: 60, 2: 85, 3: 100 },
        variable_cost_percent: 15.0,
        annual_fixed_costs_base: 150000,
        fixed_cost_growth_rate_percent: 2.5,
        dso: 30,
        dpo: 30,
        dio: 15,
        headcount_matrix: [
            { id: 'hc-1', role: 'Kierownik Operacyjny', fte: 1, grossSalary: 12000, employerCostRate: 20.48, annualCost: 173491 },
        ],
        payroll_growth_rate_percent: 3.0,
        cit_rate_percent: 19.0,
        tax_loss_carry_forward_enabled: true,
        tax_loss_offset_cap_percent: 50.0,
        tax_loss_settlement_mode: 'standard_loss_cap',
        tax_loss_one_off_cap_amount: 5000000.0,
    },
};

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
            data: { status: 'success', data: [mockProjectWithFullData] },
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
            data: { status: 'success', data: [mockProjectWithFullData] },
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
            data: { status: 'success', data: [mockProjectWithFullData] },
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
            data: { status: 'success', data: [mockProjectWithFullData] },
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

describe('CapexScheduleManager - Accessible Tooltips Integration (Tab 1)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders accessible tooltips on Add Stage button, summary cards, and stage row actions', async () => {
        apiClient.get.mockResolvedValueOnce({
            data: { status: 'success', data: [mockProjectWithFullData] },
        });

        renderWithProviders(<CapexScheduleManager />);

        await waitFor(() => {
            expect(screen.getAllByText('Prace ziemne i fundamenty')[0]).toBeInTheDocument();
        });

        // Add stage button
        const addBtn = screen.getByRole('button', { name: /Dodaj Etap CAPEX/i });
        expect(addBtn).toBeInTheDocument();

        // Stage table headers
        expect(screen.getByText('NAZWA ETAPU')).toBeInTheDocument();
        expect(screen.getByText('KWOTA NETTO')).toBeInTheDocument();
        expect(screen.getByText('KLASYFIKACJA KŚT')).toBeInTheDocument();

        // Action buttons on stage rows
        const editButtons = screen.getAllByRole('button', { name: /Edytuj etap/i });
        expect(editButtons.length).toBeGreaterThan(0);

        const deleteButtons = screen.getAllByRole('button', { name: /Usuń etap/i });
        expect(deleteButtons.length).toBeGreaterThan(0);
    });
});

describe('FinancingStructureConfigurator - Accessible Tooltips Integration (Tab 1)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders accessible tooltips on KPI metrics, quick ratio buttons, and amortization modes', async () => {
        apiClient.get.mockResolvedValueOnce({
            data: { status: 'success', data: [mockProjectWithFullData] },
        });

        renderWithProviders(<FinancingStructureConfigurator />);

        await waitFor(() => {
            expect(screen.getByText('Montaż Finansowy & Struktura Długu')).toBeInTheDocument();
        });

        // Section header and balance status
        expect(screen.getByLabelText('Informacje o montażu finansowym i strukturze długu')).toBeInTheDocument();

        // Quick ratio buttons
        expect(screen.getByRole('button', { name: '20% CAPEX' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '30% CAPEX' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '50% LTV' })).toBeInTheDocument();

        // Amortization buttons
        expect(screen.getByRole('button', { name: 'Annuity Równe raty' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Linear Równy kapitał' })).toBeInTheDocument();

        // Footer buttons
        expect(screen.getByRole('button', { name: 'Resetuj parametry montażu finansowego' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Zapisz montaż finansowy' })).toBeInTheDocument();
    });
});

describe('ReinvestmentManager - Accessible Tooltips Integration (Tab 1)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders accessible tooltips on timeline view tabs, KPI summaries, and multiplier slider', async () => {
        apiClient.get.mockResolvedValueOnce({
            data: { status: 'success', data: [mockProjectWithFullData] },
        });

        renderWithProviders(<ReinvestmentManager />);

        await waitFor(() => {
            expect(screen.getByText('Harmonogram Nakładów Odtworzeniowych (Reinvestment CAPEX)')).toBeInTheDocument();
        });

        // Timeline view mode tabs
        expect(screen.getByRole('tab', { name: 'Siatka kalendarzowa 15 lat' })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: 'Wykres słupkowy nakładów rocznych' })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: 'Wykres łączony S-Curve' })).toBeInTheDocument();

        // Multiplier slider label
        expect(screen.getByText('Skala What-If:')).toBeInTheDocument();

        // Action buttons
        expect(screen.getByRole('button', { name: 'Przywróć domyślne A, B, C' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Zapisz założenia reinvestmentu' })).toBeInTheDocument();
    });
});

describe('OperatingAssumptionsForm - Accessible Tooltips Integration (Tab 1)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders accessible tooltips on header, 4 KPI cards, 5 subtab buttons, and action buttons', async () => {
        apiClient.get.mockResolvedValueOnce({
            data: { status: 'success', data: [mockProjectWithFullData] },
        });

        renderWithProviders(<OperatingAssumptionsForm />);

        await waitFor(() => {
            expect(screen.getByText('Założenia Operacyjne & Model P&L')).toBeInTheDocument();
        });

        // Subtabs navigation buttons
        expect(screen.getByRole('button', { name: '1. Przychody & Ramp-Up' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '2. Koszty OPEX' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '3. Kapitał Obrotowy (NWC)' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '4. Matryca Etatów' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '5. Podatki & CIT' })).toBeInTheDocument();

        // Subtab 1: Add revenue line button
        expect(screen.getByRole('button', { name: 'Dodaj strumień przychodowy' })).toBeInTheDocument();

        // Bottom action buttons
        expect(screen.getByRole('button', { name: 'Resetuj założenia operacyjne' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Zapisz założenia operacyjne' })).toBeInTheDocument();
    });
});
