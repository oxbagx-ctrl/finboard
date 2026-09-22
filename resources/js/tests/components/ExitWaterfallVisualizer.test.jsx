import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ExitWaterfallVisualizer, WATERFALL_EXIT_PRESETS } from '../../components/investments/ExitWaterfallVisualizer';
import { InvestmentProjectContext } from '../../context/InvestmentProjectContext';

describe('ExitWaterfallVisualizer Component (Phase 44 Commit 219)', () => {
    const mockProject = {
        id: 'proj-waterfall-test',
        name: 'Fabryka Półprzewodników 300mm',
        currency: 'PLN',
        start_date: '2026-01-01',
        commercial_operation_date: '2027-01-01',
        planning_horizon_years: 15,
        capex_stages: [
            {
                id: 'stage-1',
                stage_name: 'Budowa Hali Fabrycznej',
                net_amount: 40000000,
                start_date: '2026-01-01',
                duration_months: 10,
                kst_code: 'KST_1',
                kst_annual_rate: 2.5,
            },
            {
                id: 'stage-2',
                stage_name: 'Linia Technologiczna',
                net_amount: 60000000,
                start_date: '2026-03-01',
                duration_months: 8,
                kst_code: 'KST_4',
                kst_annual_rate: 10.0,
            },
        ],
        debt_facility: {
            principal_amount: 60000000,
            base_interest_rate_percent: 5.75,
            margin_percent: 2.25,
            upfront_fee_percent: 1.0,
            tenor_months: 120,
            grace_period_months: 12,
            repayment_type: 'annuity',
        },
        financing_structure: {
            investor1_equity: 24000000,
            investor2_equity: 16000000,
            debt_facility_amount: 60000000,
        },
        operating_assumptions: {
            annual_revenue_base: 50000000,
            revenue_growth_rate_percent: 4.0,
            variable_cost_percent: 38.0,
            annual_fixed_costs_base: 6000000,
            fixed_cost_growth_rate_percent: 2.5,
            annual_payroll_base: 8000000,
            payroll_growth_rate_percent: 3.5,
            capacity_ramp_up: {
                year1_percent: 75.0,
                year2_percent: 90.0,
                year3_percent: 100.0,
            },
            cit_rate_percent: 19.0,
            tax_loss_carry_forward_enabled: true,
            tax_loss_offset_cap_percent: 50.0,
            dso: 40,
            dpo: 30,
            dio: 25,
        },
        valuation_multiple: {
            multiple: 7.5,
            multiple_type: 'ev_ebitda',
        },
        wacc_parameters: {
            risk_free_rate_percent: 5.50,
            equity_risk_premium_percent: 6.00,
            levered_beta: 1.20,
            cost_of_equity_percent: 12.70,
            target_debt_ratio_percent: 60.0,
        },
    };

    const renderWithContext = (project = mockProject, props = {}) => {
        const contextValue = {
            selectedProject: project,
            selectedProjectId: project?.id || null,
            loading: false,
        };

        return render(
            <InvestmentProjectContext.Provider value={contextValue}>
                <ExitWaterfallVisualizer project={project} {...props} />
            </InvestmentProjectContext.Provider>
        );
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders empty fallback state when no project is provided', () => {
        renderWithContext(null);

        expect(screen.getByText(/Brak aktywnego projektu do kalkulacji kaskady wyjścia/i)).toBeInTheDocument();
    });

    it('renders default waterfall visualizer header, controls, and waterfall steps', async () => {
        renderWithContext();

        // Header
        expect(screen.getByText(/ROZLICZENIE TRANSAKCJI M&A \/ PRIVATE EQUITY/i)).toBeInTheDocument();
        expect(screen.getByText(/Wizualizator Kaskady Wyjścia \(Exit Waterfall\)/i)).toBeInTheDocument();

        // Waterfall steps container
        await waitFor(() => {
            expect(screen.getByTestId('waterfall-bars-container')).toBeInTheDocument();
            expect(screen.getByText('Enterprise Value (EV)')).toBeInTheDocument();
            expect(screen.getByText('Spłata Długu Bankowego')).toBeInTheDocument();
            expect(screen.getByText('Uwolniona Gotówka')).toBeInTheDocument();
            expect(screen.getByText('Wartość Kapitału (EqV)')).toBeInTheDocument();
        });

        // Displays
        expect(screen.getByTestId('waterfall-exit-year-display')).toHaveTextContent('Rok 5');
        expect(screen.getByTestId('waterfall-multiple-display')).toHaveTextContent('7.5x');
        expect(screen.getByTestId('waterfall-share-display')).toHaveTextContent('60% / 40%');
    });

    it('switches exit year using the slider and preset buttons', async () => {
        renderWithContext();

        const yearSlider = screen.getByTestId('waterfall-year-slider');
        fireEvent.change(yearSlider, { target: { value: '7' } });

        await waitFor(() => {
            expect(screen.getByTestId('waterfall-exit-year-display')).toHaveTextContent('Rok 7');
        });

        // Click preset Y3
        const presetY3 = screen.getByRole('button', { name: /^Y3$/i });
        fireEvent.click(presetY3);

        await waitFor(() => {
            expect(screen.getByTestId('waterfall-exit-year-display')).toHaveTextContent('Rok 3');
        });

        // Click preset Y10
        const presetY10 = screen.getByRole('button', { name: /^Y10$/i });
        fireEvent.click(presetY10);

        await waitFor(() => {
            expect(screen.getByTestId('waterfall-exit-year-display')).toHaveTextContent('Rok 10');
        });
    });

    it('adjusts EV/EBITDA multiple using slider', async () => {
        renderWithContext();

        const multipleSlider = screen.getByTestId('waterfall-multiple-slider');
        fireEvent.change(multipleSlider, { target: { value: '9.0' } });

        await waitFor(() => {
            expect(screen.getByTestId('waterfall-multiple-display')).toHaveTextContent('9.0x');
        });
    });

    it('switches distribution structure between Pari Passu and Two-Tier Hurdle', async () => {
        renderWithContext();

        const select = screen.getByTestId('waterfall-structure-select');
        expect(select).toHaveValue('pari_passu');

        fireEvent.change(select, { target: { value: 'two_tier_hurdle' } });

        await waitFor(() => {
            expect(select).toHaveValue('two_tier_hurdle');
            expect(screen.getByText(/Hurdle: 8.0%/i)).toBeInTheDocument();
            expect(screen.getByText(/Carry: 80% GP/i)).toBeInTheDocument();
        });
    });

    it('adjusts Sponsor and LP equity share using slider', async () => {
        renderWithContext();

        const shareSlider = screen.getByTestId('waterfall-share-slider');
        fireEvent.change(shareSlider, { target: { value: '75' } });

        await waitFor(() => {
            expect(screen.getByTestId('waterfall-share-display')).toHaveTextContent('75% / 25%');
            expect(screen.getByText(/Sponsor: 75%/i)).toBeInTheDocument();
            expect(screen.getByText(/Partner: 25%/i)).toBeInTheDocument();
        });
    });

    it('renders comparison sub-tab with Sponsor and LP return cards', async () => {
        renderWithContext();

        fireEvent.click(screen.getByRole('button', { name: /2\. Zwroty Inwestorów \(Sponsor vs LP\)/i }));

        await waitFor(() => {
            expect(screen.getByTestId('sponsor-card')).toBeInTheDocument();
            expect(screen.getByTestId('partner-card')).toBeInTheDocument();
            expect(screen.getByTestId('sponsor-moic')).toBeInTheDocument();
            expect(screen.getByTestId('sponsor-irr')).toBeInTheDocument();
            expect(screen.getByTestId('partner-moic')).toBeInTheDocument();
            expect(screen.getByTestId('partner-irr')).toBeInTheDocument();
        });
    });

    it('renders annual schedule sub-tab with year-by-year cash distributions', async () => {
        renderWithContext();

        fireEvent.click(screen.getByRole('button', { name: /3\. Harmonogram Wypłat Kaskadowych/i }));

        await waitFor(() => {
            expect(screen.getByTestId('waterfall-schedule-table')).toBeInTheDocument();
            expect(screen.getByText(/t=0 \(Wkład\)/i)).toBeInTheDocument();
            expect(screen.getByText(/Rok 1/i)).toBeInTheDocument();
            expect(screen.getByText(/Wpływy ze Sprzedaży \(Exit\)/i)).toBeInTheDocument();
        });
    });

    it('toggles visualizer expansion between collapsed and open', async () => {
        renderWithContext();

        const toggleBtn = screen.getByTestId('toggle-waterfall-visualizer');
        expect(toggleBtn).toHaveTextContent(/Zwiń Kaskadę/i);

        fireEvent.click(toggleBtn);

        await waitFor(() => {
            expect(toggleBtn).toHaveTextContent(/Rozwiń Kaskadę/i);
            expect(screen.queryByTestId('waterfall-year-slider')).not.toBeInTheDocument();
        });

        fireEvent.click(toggleBtn);

        await waitFor(() => {
            expect(toggleBtn).toHaveTextContent(/Zwiń Kaskadę/i);
            expect(screen.getByTestId('waterfall-year-slider')).toBeInTheDocument();
        });
    });

    it('switches currency presentation scale between full PLN, thousands, and millions', async () => {
        renderWithContext();

        const btnThousands = screen.getByRole('button', { name: /^tys\.$/i });
        const btnPln = screen.getByRole('button', { name: /^PLN$/i });
        const btnMillions = screen.getByRole('button', { name: /^mln$/i });

        fireEvent.click(btnThousands);
        await waitFor(() => {
            expect(screen.getByTestId('waterfall-bars-container')).toHaveTextContent(/tys\. PLN/i);
        });

        fireEvent.click(btnPln);
        await waitFor(() => {
            expect(screen.getByTestId('waterfall-bars-container')).not.toHaveTextContent(/tys\. PLN/i);
            expect(screen.getByTestId('waterfall-bars-container')).toHaveTextContent(/PLN/i);
        });

        fireEvent.click(btnMillions);
        await waitFor(() => {
            expect(screen.getByTestId('waterfall-bars-container')).toHaveTextContent(/mln PLN/i);
        });
    });
});
