import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SensitivityCockpitView } from '../../components/investments/SensitivityCockpitView';
import { InvestmentProjectContext } from '../../context/InvestmentProjectContext';
import { NotificationContext } from '../../context/NotificationContext';

// Mock Recharts ResponsiveContainer to avoid size observer issues in test DOM
vi.mock('recharts', async () => {
    const actual = await vi.importActual('recharts');
    return {
        ...actual,
        ResponsiveContainer: ({ children }) => (
            <div data-testid="responsive-container" style={{ width: '800px', height: '320px' }}>
                {children}
            </div>
        ),
    };
});

describe('SensitivityCockpitView Component (Phase 43 Commit 213)', () => {
    const mockNotify = vi.fn();
    const mockNotifyError = vi.fn();

    const notificationContextValue = {
        notify: mockNotify,
        notifyError: mockNotifyError,
        notifications: [],
    };

    const mockProject = {
        id: 'proj-battery-storage',
        name: 'Magazyn Energii BESS 100MWh',
        currency: 'PLN',
        start_date: '2026-01-01',
        commercial_operation_date: '2027-01-01',
        planning_horizon_years: 15,
        capex_stages: [
            {
                id: 'stage-1',
                stage_name: 'Kontenery bateryjne LFP',
                net_amount: 30000000,
                start_date: '2026-01-01',
                duration_months: 8,
                kst_code: 'KST_3',
                kst_annual_rate: 7.0,
            },
            {
                id: 'stage-2',
                stage_name: 'Falowniki i stacja transformatorowa',
                net_amount: 10000000,
                start_date: '2026-04-01',
                duration_months: 6,
                kst_code: 'KST_6',
                kst_annual_rate: 10.0,
            },
        ],
        debt_facility: {
            principal_amount: 24000000, // 60% LTV
            base_interest_rate_percent: 5.85,
            margin_percent: 2.15,
            upfront_fee_percent: 1.0,
            tenor_months: 120,
            grace_period_months: 12,
            repayment_type: 'annuity',
        },
        financing_structure: {
            investor1_equity: 16000000,
            debt_facility_amount: 24000000,
        },
        operating_assumptions: {
            annual_revenue_base: 18000000,
            revenue_growth_rate_percent: 3.0,
            variable_cost_percent: 35.0,
            annual_fixed_costs_base: 1800000,
            fixed_cost_growth_rate_percent: 2.5,
            annual_payroll_base: 2400000,
            payroll_growth_rate_percent: 4.0,
            capacity_ramp_up: {
                year1_percent: 80.0,
                year2_percent: 95.0,
                year3_percent: 100.0,
            },
            cit_rate_percent: 19.0,
            tax_loss_carry_forward_enabled: true,
            tax_loss_offset_cap_percent: 50.0,
            dso: 30,
            dpo: 30,
            dio: 15,
        },
        wacc_parameters: {
            risk_free_rate_percent: 5.50,
            equity_risk_premium_percent: 6.00,
            levered_beta: 1.10,
            cost_of_equity_percent: 12.10,
            target_debt_ratio_percent: 60.0,
        },
        valuation_multiple: {
            multiple: 7.5,
            multiple_type: 'ev_ebitda',
        },
    };

    const renderWithContext = (project = mockProject) => {
        const contextValue = {
            selectedProject: project,
            selectedProjectId: project?.id || null,
            loading: false,
        };

        return render(
            <NotificationContext.Provider value={notificationContextValue}>
                <InvestmentProjectContext.Provider value={contextValue}>
                    <SensitivityCockpitView />
                </InvestmentProjectContext.Provider>
            </NotificationContext.Provider>
        );
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders empty state when no project is selected', () => {
        renderWithContext(null);

        expect(screen.getByText('Brak Wybranego Projektu Inwestycyjnego')).toBeInTheDocument();
        expect(screen.getByText(/Wybierz projekt z listy powyżej/i)).toBeInTheDocument();
    });

    it('renders live cockpit with baseline KPIs and sliders when project is loaded', async () => {
        renderWithContext();

        // Header titles
        expect(screen.getByText('Cockpit Analizy Wrażliwości & Symulator What-If')).toBeInTheDocument();
        expect(screen.getByText('REAL-TIME')).toBeInTheDocument();
        expect(screen.getByText('Worker:')).toBeInTheDocument();

        // Preset buttons
        expect(screen.getByRole('button', { name: /Bazowy/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Optymistyczny/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Stres-Test Bankowy/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Stagflacja/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Presja Płacowa/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Przywróć Bazę/i })).toBeInTheDocument();

        // KPI card titles
        expect(screen.getByText('PROJECT NPV')).toBeInTheDocument();
        expect(screen.getByText('PROJECT IRR')).toBeInTheDocument();
        expect(screen.getByText('EQUITY MoIC')).toBeInTheDocument();
        expect(screen.getByText('OKRES ZWROTU')).toBeInTheDocument();
        expect(screen.getByText('KOWENANT DSCR')).toBeInTheDocument();

        // Debt Repayment Switcher Component
        expect(screen.getByText(/Profil Amortyzacji Długu Bankowego/i)).toBeInTheDocument();
        expect(screen.getByText('Raty Równe (Annuity)')).toBeInTheDocument();
        expect(screen.getByText('Raty Malejące (Linear)')).toBeInTheDocument();
        expect(screen.getByText('Spłata Balonowa (Bullet)')).toBeInTheDocument();

        // Sliders
        expect(screen.getByText('Nakłady CAPEX')).toBeInTheDocument();
        expect(screen.getByText('Przychody ze Sprzedaży')).toBeInTheDocument();
        expect(screen.getByText('Koszty Zmienne (% Rev)')).toBeInTheDocument();
        expect(screen.getByText('Koszty Stałe OPEX')).toBeInTheDocument();
        expect(screen.getByText('Fundusz Płac & Płace')).toBeInTheDocument();
        expect(screen.getByText('Stopa Dyskontowa WACC')).toBeInTheDocument();

        // Comparison table
        expect(screen.getByText('Macierz Porównawcza Wpływu Wrażliwości (Base Case vs What-If)')).toBeInTheDocument();
        expect(screen.getByText('Łączne Nakłady CAPEX')).toBeInTheDocument();
        expect(screen.getByText('Suma Przychodów (15 Lat)')).toBeInTheDocument();
        expect(screen.getByText('Wartość Bieżąca Netto (NPV Projektu)')).toBeInTheDocument();
    });

    it('updates simulation when adjusting revenue slider', async () => {
        renderWithContext();

        await waitFor(() => {
            expect(screen.getByText('PROJECT NPV')).toBeInTheDocument();
        });

        // Find the revenue slider (the second range input)
        const sliders = screen.getAllByRole('slider');
        const revenueSlider = sliders[1]; // Index 1 is Revenue slider

        // Increase revenue by +15%
        fireEvent.change(revenueSlider, { target: { value: '15' } });

        await waitFor(() => {
            expect(screen.getAllByText('+15%').length).toBeGreaterThanOrEqual(1);
        });
    });

    it('updates simulation when adjusting CAPEX slider', async () => {
        renderWithContext();

        await waitFor(() => {
            expect(screen.getByText('PROJECT NPV')).toBeInTheDocument();
        });

        // Index 0 is CAPEX slider
        const sliders = screen.getAllByRole('slider');
        const capexSlider = sliders[0];

        // Increase CAPEX by +20%
        fireEvent.change(capexSlider, { target: { value: '20' } });

        await waitFor(() => {
            expect(screen.getAllByText('+20%').length).toBeGreaterThanOrEqual(1);
            expect(screen.getByText('PRZEKROCZENIE')).toBeInTheDocument();
        });
    });

    it('applies pessimistic stress-test preset when clicked', async () => {
        renderWithContext();

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /Stres-Test Bankowy/i })).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', { name: /Stres-Test Bankowy/i }));

        await waitFor(() => {
            // Should apply +20% CAPEX, -15% Revenue, +10% VarCost, +10% FixedCost, +8% Payroll
            expect(screen.getAllByText('+20%').length).toBeGreaterThanOrEqual(1);
            expect(screen.getAllByText('-15%').length).toBeGreaterThanOrEqual(1);
            expect(screen.getAllByText('+10%').length).toBeGreaterThanOrEqual(1);
            expect(screen.getAllByText('+8%').length).toBeGreaterThanOrEqual(1);
        });
    });

    it('applies optimistic scenario preset when clicked', async () => {
        renderWithContext();

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /Optymistyczny/i })).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', { name: /Optymistyczny/i }));

        await waitFor(() => {
            // -5% CAPEX, +15% Revenue, -5% VarCost
            expect(screen.getAllByText('-5%').length).toBeGreaterThanOrEqual(1);
            expect(screen.getAllByText('+15%').length).toBeGreaterThanOrEqual(1);
        });
    });

    it('resets all sliders to base case when clicking Reset button', async () => {
        renderWithContext();

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /Przywróć Bazę/i })).toBeInTheDocument();
        });

        // First apply pessimistic scenario
        fireEvent.click(screen.getByRole('button', { name: /Stres-Test Bankowy/i }));

        await waitFor(() => {
            expect(screen.getAllByText('+20%').length).toBeGreaterThanOrEqual(1);
        });

        // Click Reset
        fireEvent.click(screen.getByRole('button', { name: /Przywróć Bazę/i }));

        await waitFor(() => {
            // All sliders back to 0%
            expect(screen.getAllByText('0%').length).toBeGreaterThanOrEqual(1);
        });
    });

    it('displays bankability covenant badge and updates status on optimistic scenario', async () => {
        renderWithContext();

        await waitFor(() => {
            expect(screen.getAllByText('KOWENANT DSCR').length).toBeGreaterThanOrEqual(1);
            expect(screen.getAllByText(/RISK \(< 1\.2x\)/i).length).toBeGreaterThanOrEqual(1);
        });

        // Switch to Optimistic scenario (+15% revenue, -5% capex)
        fireEvent.click(screen.getByRole('button', { name: /Optymistyczny/i }));

        await waitFor(() => {
            expect(screen.getAllByText(/BANKABLE/i).length).toBeGreaterThanOrEqual(1);
        });
    });

    it('switches debt repayment mode from annuity to linear in real-time', async () => {
        renderWithContext();

        await waitFor(() => {
            expect(screen.getByText('Raty Malejące (Linear)')).toBeInTheDocument();
        });

        // Click on Linear mode card
        fireEvent.click(screen.getByText('Raty Malejące (Linear)'));

        await waitFor(() => {
            expect(screen.getAllByText('SYMULACJA ALTERNATYWNA').length).toBeGreaterThanOrEqual(1);
            expect(screen.getAllByText('LINEAR').length).toBeGreaterThanOrEqual(1);
        });
    });
});
