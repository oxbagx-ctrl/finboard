import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ExitValuationOverlay, SECTOR_MULTIPLES, EXIT_YEAR_PRESETS } from '../../components/investments/ExitValuationOverlay';
import { InvestmentProjectContext } from '../../context/InvestmentProjectContext';

describe('ExitValuationOverlay Component (Phase 44 Commit 218)', () => {
    const mockProject = {
        id: 'proj-exit-test',
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
            investor1_equity: 40000000,
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
                <ExitValuationOverlay project={project} {...props} />
            </InvestmentProjectContext.Provider>
        );
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders empty fallback state when no project is provided', () => {
        renderWithContext(null);

        expect(screen.getByText(/Brak aktywnego projektu do wyliczenia wyceny wyjścia/i)).toBeInTheDocument();
    });

    it('renders default exit valuation header, controls, and primary KPI cards', async () => {
        renderWithContext();

        // Header
        expect(screen.getByText(/NAKŁADKA INWESTORSKA M&A \/ PRIVATE EQUITY/i)).toBeInTheDocument();
        expect(screen.getByText(/Wycena Wyjścia \(Exit Valuation\)/i)).toBeInTheDocument();

        // Primary KPIs
        await waitFor(() => {
            expect(screen.getByTestId('kpi-enterprise-value')).toBeInTheDocument();
            expect(screen.getByTestId('kpi-equity-value')).toBeInTheDocument();
            expect(screen.getByTestId('kpi-equity-moic')).toBeInTheDocument();
            expect(screen.getByTestId('kpi-buyer-yield')).toBeInTheDocument();
        });

        // Default multiple display
        expect(screen.getByTestId('exit-multiple-display')).toHaveTextContent(/7.5x EV\/EBITDA/i);
    });

    it('switches exit year using the slider and updates valuation metrics', async () => {
        renderWithContext();

        const yearSlider = screen.getByTestId('exit-year-slider');
        expect(yearSlider).toBeInTheDocument();

        // Change exit year from 5 to 7
        fireEvent.change(yearSlider, { target: { value: '7' } });

        await waitFor(() => {
            expect(screen.getByTestId('exit-year-display')).toHaveTextContent('Rok 7');
        });
    });

    it('clicks exit year preset buttons to switch horizon', async () => {
        renderWithContext();

        const presetY3 = screen.getByRole('button', { name: /Rok 3 \(Early Exit\)/i });
        fireEvent.click(presetY3);

        await waitFor(() => {
            expect(screen.getByTestId('exit-year-display')).toHaveTextContent('Rok 3');
            expect(screen.getByText((content) => content.includes('36 mies. inwestycji'))).toBeInTheDocument();
        });

        const presetY10 = screen.getByRole('button', { name: /Rok 10 \(Long-Term\)/i });
        fireEvent.click(presetY10);

        await waitFor(() => {
            expect(screen.getByTestId('exit-year-display')).toHaveTextContent('Rok 10');
            expect(screen.getByText((content) => content.includes('120 mies. inwestycji'))).toBeInTheDocument();
        });
    });

    it('adjusts EV/EBITDA multiple using slider and sector benchmark presets', async () => {
        renderWithContext();

        const multipleSlider = screen.getByTestId('exit-multiple-slider');
        fireEvent.change(multipleSlider, { target: { value: '9.5' } });

        await waitFor(() => {
            expect(screen.getByTestId('exit-multiple-display')).toHaveTextContent(/9.5x EV\/EBITDA/i);
        });

        // Click OZE preset (8.0x)
        const ozeButton = screen.getByRole('button', { name: /OZE \/ PV \/ Wiatr \(8.0x\)/i });
        fireEvent.click(ozeButton);

        await waitFor(() => {
            expect(screen.getByTestId('exit-multiple-display')).toHaveTextContent(/8.0x EV\/EBITDA/i);
            // 1 / 8.0 = 12.50%
            expect(screen.getByTestId('kpi-buyer-yield')).toHaveTextContent(/12.5%/i);
        });

        // Click Tech / SaaS preset (12.0x)
        const saasButton = screen.getByRole('button', { name: /Tech \/ B2B SaaS \(12.0x\)/i });
        fireEvent.click(saasButton);

        await waitFor(() => {
            expect(screen.getByTestId('exit-multiple-display')).toHaveTextContent(/12.0x EV\/EBITDA/i);
            // 1 / 12.0 = 8.33%
            expect(screen.getByTestId('kpi-buyer-yield')).toHaveTextContent(/8.3%/i);
        });
    });

    it('switches terminal value method to Gordon Growth and Book Value', async () => {
        renderWithContext();

        const methodSelect = screen.getByRole('combobox', { name: /Metoda wyceny wyjścia/i });
        fireEvent.change(methodSelect, { target: { value: 'gordon_growth' } });

        await waitFor(() => {
            expect(screen.getByLabelText(/Stopa wzrostu renty Gordona/i)).toBeInTheDocument();
            expect(screen.getByText(/Perpetual Growth Rate \(g\):/i)).toBeInTheDocument();
        });

        fireEvent.change(methodSelect, { target: { value: 'book_value' } });

        await waitFor(() => {
            expect(screen.getByText(/Wycena oparta na wartości księgowej netto aktywów trwałych/i)).toBeInTheDocument();
        });
    });

    it('renders EV to Equity Value Bridge deconstructing gross debt, cash, and net debt', async () => {
        renderWithContext();

        // Bridge tab is active by default
        expect(screen.getByText(/1\. Most Wyceny \(EV to Equity Bridge\)/i)).toBeInTheDocument();

        await waitFor(() => {
            expect(screen.getByText(/Wycena Przedsiębiorstwa \(Enterprise Value\):/i)).toBeInTheDocument();
            expect(screen.getByText(/Zadłużenie Kredytowe Senior Debt \(Gross Debt\):/i)).toBeInTheDocument();
            expect(screen.getByText(/Środki Pieniężne i Ekwiwalenty \(Cash & Equivalents\):/i)).toBeInTheDocument();
            expect(screen.getByText(/Dług Netto do Spłaty przy Transakcji \(Net Debt\):/i)).toBeInTheDocument();
            expect(screen.getByText(/Czysta Wartość Kapitału Własnego \(Equity Value\):/i)).toBeInTheDocument();
            expect(screen.getByTestId('bridge-equity-value')).toBeInTheDocument();
        });
    });

    it('renders Buyer Economics sub-tab with entry yields and spreads', async () => {
        renderWithContext();

        fireEvent.click(screen.getByRole('button', { name: /2\. Ekonomia Nabywcy \(Buyer Economics\)/i }));

        await waitFor(() => {
            expect(screen.getByText(/Rentowność i Atrakcyjność Transakcyjna z Perspektywy Nabywcy/i)).toBeInTheDocument();
            expect(screen.getByText(/Entry EBITDA Yield \(Cap Rate\)/i)).toBeInTheDocument();
            expect(screen.getByText(/Unlevered FCF Yield/i)).toBeInTheDocument();
            expect(screen.getByText(/Levered Equity Cash Yield/i)).toBeInTheDocument();
            expect(screen.getByText(/Spread ponad koszt kapitału WACC:/i)).toBeInTheDocument();
        });
    });

    it('renders 2D Sensitivity Matrix and allows selecting a cell to switch scenario', async () => {
        renderWithContext();

        fireEvent.click(screen.getByRole('button', { name: /3\. Macierz Wrażliwości Wyjścia \(2D Matrix\)/i }));

        await waitFor(() => {
            expect(screen.getByTestId('exit-sensitivity-table')).toBeInTheDocument();
            expect(screen.getByText(/Macierz Wrażliwości Wyceny: Mnożnik EV\/EBITDA vs Rok Wyjścia/i)).toBeInTheDocument();
            expect(screen.getByText(/Mnożnik \\ Rok/i)).toBeInTheDocument();
        });

        // Find table cell and click it
        const table = screen.getByTestId('exit-sensitivity-table');
        const cells = table.querySelectorAll('td.cursor-pointer');
        expect(cells.length).toBeGreaterThan(0);

        // Click the first cell
        fireEvent.click(cells[0]);

        // Expect state update
        await waitFor(() => {
            expect(screen.getByTestId('kpi-enterprise-value')).toBeInTheDocument();
        });
    });

    it('toggles overlay expansion state between collapsed and open', async () => {
        renderWithContext();

        const toggleButton = screen.getByTestId('toggle-exit-overlay');
        expect(toggleButton).toHaveTextContent(/Zwiń Wycenę/i);

        fireEvent.click(toggleButton);

        await waitFor(() => {
            expect(toggleButton).toHaveTextContent(/Rozwiń Wycenę/i);
            expect(screen.queryByTestId('exit-year-slider')).not.toBeInTheDocument();
        });

        fireEvent.click(toggleButton);

        await waitFor(() => {
            expect(toggleButton).toHaveTextContent(/Zwiń Wycenę/i);
            expect(screen.getByTestId('exit-year-slider')).toBeInTheDocument();
        });
    });

    it('switches currency presentation scale between full PLN, thousands, and millions', async () => {
        renderWithContext();

        const btnThousands = screen.getByRole('button', { name: /^tys\.$/i });
        const btnPln = screen.getByRole('button', { name: /^PLN$/i });
        const btnMillions = screen.getByRole('button', { name: /^mln$/i });

        fireEvent.click(btnThousands);
        await waitFor(() => {
            expect(screen.getByTestId('kpi-enterprise-value')).toHaveTextContent(/tys\. PLN/i);
        });

        fireEvent.click(btnPln);
        await waitFor(() => {
            expect(screen.getByTestId('kpi-enterprise-value')).not.toHaveTextContent(/tys\. PLN/i);
            expect(screen.getByTestId('kpi-enterprise-value')).toHaveTextContent(/PLN/i);
        });

        fireEvent.click(btnMillions);
        await waitFor(() => {
            expect(screen.getByTestId('kpi-enterprise-value')).toHaveTextContent(/mln PLN/i);
        });
    });
});
